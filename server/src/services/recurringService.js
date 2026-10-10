import { db, transaction } from '../db/index.js';
import { badRequest, notFound } from '../utils/errors.js';
import { addDays, addMonths, shiftMonth, todayISO } from '../utils/dates.js';

const HORIZON_MONTHS = 2; // lançamentos são gerados até 2 meses à frente

const daysInMonth = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
const clampDay = (ym, day) => `${ym}-${String(Math.min(day, daysInMonth(ym))).padStart(2, '0')}`;

/** Datas de vencimento da regra dentro de [from, to]. */
export function occurrences(rule, from, to) {
  const out = [];
  const end = rule.end_date && rule.end_date < to ? rule.end_date : to;
  if (rule.frequency === 'monthly') {
    let ym = rule.start_date.slice(0, 7) > from.slice(0, 7) ? rule.start_date.slice(0, 7) : from.slice(0, 7);
    for (let i = 0; i < 40; i++, ym = shiftMonth(ym, 1)) {
      const due = clampDay(ym, rule.day_of_month);
      if (due > end) break;
      if (due >= from && due >= rule.start_date) out.push(due);
    }
  } else if (rule.frequency === 'weekly') {
    let d = rule.start_date;
    if (d < from) {
      const diff = Math.floor((new Date(`${from}T12:00:00`) - new Date(`${d}T12:00:00`)) / 86400000);
      d = addDays(d, Math.floor(diff / 7) * 7);
    }
    for (let i = 0; i < 20 && d <= end; i++, d = addDays(d, 7)) if (d >= from) out.push(d);
  } else {
    for (let k = 0; k < 5; k++) {
      const d = addMonths(rule.start_date, 12 * k);
      if (d > end) break;
      if (d >= from) out.push(d);
    }
  }
  return out;
}

/** Gera os lançamentos pendentes que faltam (idempotente: nunca duplica um vencimento já gerado). */
export async function generateRecurring(householdId, onlyRuleId) {
  const today = todayISO();
  const horizon = addMonths(today, HORIZON_MONTHS);
  const from = `${today.slice(0, 7)}-01`; // não cria retroativo de meses passados
  const rules = await db
    .prepare(`SELECT * FROM recurring_rules WHERE household_id = ? AND active = 1 ${onlyRuleId ? 'AND id = ?' : ''}`)
    .all(...(onlyRuleId ? [householdId, onlyRuleId] : [householdId]));
  const insertSql = `INSERT INTO transactions (household_id, type, description, amount_cents, due_date, status,
      category_id, person_id, scope, payment_method, income_type, recurring_id) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`;
  for (const r of rules) {
    if (r.generated_until && r.generated_until >= horizon && !onlyRuleId) continue;
    const have = new Set((await db.prepare('SELECT due_date FROM transactions WHERE recurring_id = ? AND due_date >= ?').all(r.id, from)).map((x) => x.due_date));
    const missing = occurrences(r, from, horizon).filter((due) => !have.has(due));
    await db.batch([
      ...missing.map((due) => ({ sql: insertSql, args: [householdId, r.type, r.description, r.amount_cents, due, r.category_id,
        r.person_id, r.scope, r.payment_method, r.income_type, r.id] })),
      { sql: 'UPDATE recurring_rules SET generated_until = ? WHERE id = ?', args: [horizon, r.id] },
    ]);
  }
}

const SELECT = `
  SELECT r.*, c.name AS category_name, u.name AS person_name,
    (SELECT MIN(due_date) FROM transactions t WHERE t.recurring_id = r.id AND t.status = 'pending' AND t.due_date >= ?) AS next_due
  FROM recurring_rules r
  LEFT JOIN categories c ON c.id = r.category_id
  LEFT JOIN users u ON u.id = r.person_id
  WHERE r.household_id = ?`;

export const listRules = (householdId) =>
  db.prepare(`${SELECT} ORDER BY r.active DESC, r.type, r.description`).all(todayISO(), householdId);

export async function getRule(householdId, id) {
  const r = await db.prepare(`${SELECT} AND r.id = ?`).get(todayISO(), householdId, id);
  if (!r) throw notFound('Recorrência não encontrada.');
  return r;
}

async function assertRefs(householdId, { category_id, person_id }) {
  if (category_id != null && !(await db.prepare('SELECT 1 FROM categories WHERE id = ? AND household_id = ?').get(category_id, householdId))) {
    throw badRequest('Categoria inválida.', { category_id: 'Categoria inválida.' });
  }
  if (person_id != null && !(await db.prepare('SELECT 1 FROM users WHERE id = ? AND household_id = ?').get(person_id, householdId))) {
    throw badRequest('Pessoa inválida.', { person_id: 'Pessoa inválida.' });
  }
}

function checkDates(r) {
  if (r.end_date && r.end_date < r.start_date) {
    throw badRequest('A data final deve ser depois da inicial.', { end_date: 'Anterior à data inicial.' });
  }
}

export async function createRule(householdId, d) {
  await assertRefs(householdId, d);
  checkDates(d);
  return transaction(async () => {
    const r = await db.prepare(`INSERT INTO recurring_rules (household_id, type, description, amount_cents, day_of_month, frequency,
        start_date, end_date, category_id, person_id, scope, payment_method, income_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(householdId, d.type, d.description, d.amount_cents, d.day_of_month ?? Number(d.start_date.slice(8)), d.frequency,
        d.start_date, d.end_date ?? null, d.category_id ?? null, d.person_id ?? null, d.scope,
        d.payment_method ?? null, d.income_type ?? null);
    const id = r.lastInsertRowid;
    await generateRecurring(householdId, id);
    return getRule(householdId, id);
  });
}

/** Edita a regra: os lançamentos futuros ainda pendentes são regerados com os novos dados. */
export async function updateRule(householdId, id, d) {
  const cur = await getRule(householdId, id);
  const m = { ...cur, ...d };
  await assertRefs(householdId, m);
  checkDates(m);
  return transaction(async () => {
    await db.prepare(`UPDATE recurring_rules SET description=?, amount_cents=?, day_of_month=?, frequency=?, start_date=?, end_date=?,
        category_id=?, person_id=?, scope=?, payment_method=?, income_type=?, active=?, generated_until=NULL WHERE id=? AND household_id=?`)
      .run(m.description, m.amount_cents, m.day_of_month, m.frequency, m.start_date, m.end_date ?? null, m.category_id ?? null,
        m.person_id ?? null, m.scope, m.payment_method ?? null, m.income_type ?? null, m.active ? 1 : 0, id, householdId);
    await db.prepare(`DELETE FROM transactions WHERE recurring_id = ? AND status = 'pending' AND due_date >= ?`).run(id, todayISO());
    await generateRecurring(householdId, id);
    return getRule(householdId, id);
  });
}

export async function deleteRule(householdId, id) {
  await getRule(householdId, id);
  await transaction(async () => {
    await db.prepare(`DELETE FROM transactions WHERE recurring_id = ? AND status = 'pending' AND due_date >= ?`).run(id, todayISO());
    await db.prepare('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ?').run(id);
    await db.prepare('DELETE FROM recurring_rules WHERE id = ? AND household_id = ?').run(id, householdId);
  });
}
