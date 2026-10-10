import { db, transaction } from '../db/index.js';
import { badRequest, notFound } from '../utils/errors.js';
import { addMonths, todayISO } from '../utils/dates.js';
import { splitCents } from '../utils/money.js';

const PARCEL_COLS = `household_id, type, description, amount_cents, due_date, paid_date, status, category_id,
  person_id, scope, payment_method, debt_id, installment_plan_id, installment_number, created_by`;

/** Insere as parcelas como despesas; as `paidCount` primeiras já nascem pagas (na data do vencimento). */
async function insertParcels({ householdId, userId, link, name, amounts, firstDue, paidCount, categoryId, personId, paymentMethod }) {
  const sql = `INSERT INTO transactions (${PARCEL_COLS}) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, 'shared', ?, ?, ?, ?, ?)`;
  // Todas as parcelas numa única viagem ao banco.
  await db.batch(amounts.map((cents, i) => {
    const due = addMonths(firstDue, i);
    const paid = i < paidCount;
    return { sql, args: [householdId, name, cents, due, paid ? due : null, paid ? 'paid' : 'pending', categoryId,
      personId, paymentMethod ?? null, link.debt_id ?? null, link.installment_plan_id ?? null, i + 1, userId] };
  }));
}

// Progresso sempre derivado das parcelas (não é armazenado).
const PROGRESS = `
  SELECT {cols},
    COALESCE(SUM(CASE WHEN t.status = 'paid' THEN 1 END), 0) AS paid_count,
    COALESCE(SUM(CASE WHEN t.status = 'paid' THEN t.amount_cents END), 0) AS paid_cents,
    COALESCE(SUM(CASE WHEN t.status = 'pending' THEN 1 END), 0) AS pending_count,
    COALESCE(SUM(CASE WHEN t.status = 'pending' THEN t.amount_cents END), 0) AS pending_cents,
    COALESCE(SUM(CASE WHEN t.status = 'pending' AND t.due_date < ? THEN 1 END), 0) AS overdue_count,
    MIN(CASE WHEN t.status = 'pending' THEN t.due_date END) AS next_due,
    u.name AS person_name
  FROM {table} d
  LEFT JOIN transactions t ON t.{fk} = d.id
  LEFT JOIN users u ON u.id = d.person_id
  WHERE d.household_id = ? {extra}
  GROUP BY d.id ORDER BY (pending_count = 0), next_due, d.id DESC`;

const withPct = (r) => ({ ...r, percent: Math.round((r.paid_count / r.installments_count) * 100) });

async function assertPerson(householdId, personId) {
  if (personId != null && !(await db.prepare('SELECT 1 FROM users WHERE id = ? AND household_id = ?').get(personId, householdId))) {
    throw badRequest('Pessoa inválida.', { person_id: 'Pessoa inválida.' });
  }
}

// ---------------------------------------------------------------- Dívidas
const debtQuery = (extra = '') =>
  PROGRESS.replace('{cols}', 'd.*').replace('{table}', 'debts').replace('{fk}', 'debt_id').replace('{extra}', extra);

export async function listDebts(householdId) {
  return (await db.prepare(debtQuery()).all(todayISO(), householdId)).map(withPct);
}

export async function getDebt(householdId, id) {
  const row = await db.prepare(debtQuery('AND d.id = ?')).get(todayISO(), householdId, id);
  if (!row) throw notFound('Dívida não encontrada.');
  return withPct(row);
}

export const debtParcels = async (householdId, id) => {
  await getDebt(householdId, id);
  return db.prepare(`SELECT id, installment_number, amount_cents, due_date, paid_date, status,
      CASE WHEN status = 'pending' AND due_date < ? THEN 'overdue' ELSE status END AS effective_status
      FROM transactions WHERE debt_id = ? AND household_id = ? ORDER BY installment_number`).all(todayISO(), id, householdId);
};

export async function createDebt(householdId, userId, d) {
  await assertPerson(householdId, d.person_id);
  if (d.paid_installments > d.installments_count) {
    throw badRequest('Parcelas pagas excedem o total.', { paid_installments: 'Maior que o total de parcelas.' });
  }
  const installment = d.installment_cents ?? Math.ceil(d.original_cents / d.installments_count);
  return transaction(async () => {
    const r = await db.prepare(`INSERT INTO debts (household_id, name, creditor, original_cents, installments_count, installment_cents,
        interest_rate_bp, first_due_date, person_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(householdId, d.name, d.creditor ?? null, d.original_cents, d.installments_count, installment,
        Math.round((d.interest_rate ?? 0) * 100), d.first_due_date, d.person_id ?? null, d.notes ?? null);
    const id = r.lastInsertRowid;
    const cat = await db.prepare(`SELECT id FROM categories WHERE household_id = ? AND kind = 'expense' AND name = 'Dívidas'`).get(householdId);
    await insertParcels({
      householdId, userId, link: { debt_id: id }, name: d.name, amounts: Array(d.installments_count).fill(installment),
      firstDue: d.first_due_date, paidCount: d.paid_installments, categoryId: cat?.id ?? null, personId: d.person_id ?? null,
    });
    return getDebt(householdId, id);
  });
}

export async function updateDebt(householdId, id, d) {
  const cur = await getDebt(householdId, id);
  const m = { ...cur, ...d };
  await assertPerson(householdId, m.person_id);
  return transaction(async () => {
    await db.prepare('UPDATE debts SET name = ?, creditor = ?, person_id = ?, notes = ? WHERE id = ? AND household_id = ?')
      .run(m.name, m.creditor ?? null, m.person_id ?? null, m.notes ?? null, id, householdId);
    await db.prepare('UPDATE transactions SET description = ?, person_id = ? WHERE debt_id = ? AND household_id = ?')
      .run(m.name, m.person_id ?? null, id, householdId);
    return getDebt(householdId, id);
  });
}

export async function deleteDebt(householdId, id) {
  await getDebt(householdId, id);
  await transaction(async () => {
    await db.prepare('DELETE FROM transactions WHERE debt_id = ? AND household_id = ?').run(id, householdId);
    await db.prepare('DELETE FROM debts WHERE id = ? AND household_id = ?').run(id, householdId);
  });
}

// ---------------------------------------------------------------- Parcelamentos
const planQuery = (extra = '') =>
  PROGRESS.replace('{cols}', 'd.*').replace('{table}', 'installment_plans').replace('{fk}', 'installment_plan_id').replace('{extra}', extra);

const planExtras = (r) => ({
  ...withPct(r),
  installment_cents: Math.round(r.total_cents / r.installments_count),
});

export async function listPlans(householdId) {
  return (await db.prepare(planQuery()).all(todayISO(), householdId)).map(planExtras);
}

export async function getPlan(householdId, id) {
  const row = await db.prepare(planQuery('AND d.id = ?')).get(todayISO(), householdId, id);
  if (!row) throw notFound('Parcelamento não encontrado.');
  return planExtras(row);
}

export async function planParcels(householdId, id) {
  await getPlan(householdId, id);
  return db.prepare(`SELECT id, installment_number, amount_cents, due_date, paid_date, status,
      CASE WHEN status = 'pending' AND due_date < ? THEN 'overdue' ELSE status END AS effective_status
      FROM transactions WHERE installment_plan_id = ? AND household_id = ? ORDER BY installment_number`).all(todayISO(), id, householdId);
}

export async function createPlan(householdId, userId, p) {
  await assertPerson(householdId, p.person_id);
  if (p.category_id != null && !(await db.prepare('SELECT 1 FROM categories WHERE id = ? AND household_id = ?').get(p.category_id, householdId))) {
    throw badRequest('Categoria inválida.', { category_id: 'Categoria inválida.' });
  }
  if (p.paid_installments > p.installments_count) {
    throw badRequest('Parcelas pagas excedem o total.', { paid_installments: 'Maior que o total de parcelas.' });
  }
  return transaction(async () => {
    const r = await db.prepare(`INSERT INTO installment_plans (household_id, name, total_cents, installments_count, first_due_date,
        category_id, person_id, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(householdId, p.name, p.total_cents, p.installments_count, p.first_due_date, p.category_id ?? null,
        p.person_id ?? null, p.payment_method ?? null, p.notes ?? null);
    const id = r.lastInsertRowid;
    await insertParcels({
      householdId, userId, link: { installment_plan_id: id }, name: p.name, amounts: splitCents(p.total_cents, p.installments_count),
      firstDue: p.first_due_date, paidCount: p.paid_installments, categoryId: p.category_id ?? null,
      personId: p.person_id ?? null, paymentMethod: p.payment_method,
    });
    return getPlan(householdId, id);
  });
}

export async function deletePlan(householdId, id) {
  await getPlan(householdId, id);
  await transaction(async () => {
    await db.prepare('DELETE FROM transactions WHERE installment_plan_id = ? AND household_id = ?').run(id, householdId);
    await db.prepare('DELETE FROM installment_plans WHERE id = ? AND household_id = ?').run(id, householdId);
  });
}
