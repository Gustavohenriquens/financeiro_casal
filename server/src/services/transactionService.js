import { db } from '../db/index.js';
import { badRequest, notFound } from '../utils/errors.js';
import { todayISO } from '../utils/dates.js';

// Status efetivo: pendente com vencimento passado vira "overdue" (derivado, nunca gravado).
const EFFECTIVE_STATUS = `CASE WHEN t.status = 'pending' AND t.due_date < ? THEN 'overdue' ELSE t.status END`;

const SELECT = `
  SELECT t.*, ${EFFECTIVE_STATUS} AS effective_status,
         c.name AS category_name, c.color AS category_color, u.name AS person_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN users u ON u.id = t.person_id
`;

async function assertOwnership(householdId, { category_id, person_id }) {
  if (category_id != null && !(await db.prepare('SELECT 1 FROM categories WHERE id = ? AND household_id = ?').get(category_id, householdId))) {
    throw badRequest('Categoria inválida.', { category_id: 'Categoria inválida.' });
  }
  if (person_id != null && !(await db.prepare('SELECT 1 FROM users WHERE id = ? AND household_id = ?').get(person_id, householdId))) {
    throw badRequest('Pessoa inválida.', { person_id: 'Pessoa inválida.' });
  }
}

export async function listTransactions(householdId, f) {
  const where = ['t.household_id = ?'];
  const params = [todayISO(), householdId];
  const add = (sql, ...vals) => { where.push(sql); params.push(...vals); };

  if (f.type) add('t.type = ?', f.type);
  if (f.from) add('t.due_date >= ?', f.from);
  if (f.to) add('t.due_date <= ?', f.to);
  if (f.category_id) add('t.category_id = ?', f.category_id);
  if (f.person === 'both') add('t.person_id IS NULL');
  else if (f.person) add('t.person_id = ?', Number(f.person));
  if (f.scope) add('t.scope = ?', f.scope);
  if (f.payment_method) add('t.payment_method = ?', f.payment_method);
  if (f.q) add('(t.description LIKE ? OR t.notes LIKE ?)', `%${f.q}%`, `%${f.q}%`);
  if (f.status === 'overdue') add(`t.status = 'pending' AND t.due_date < ?`, todayISO());
  else if (f.status === 'pending') add(`t.status = 'pending' AND t.due_date >= ?`, todayISO());
  else if (f.status) add('t.status = ?', f.status);

  return db
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.due_date ${f.order === 'asc' ? 'ASC' : 'DESC'}, t.id DESC LIMIT ? OFFSET ?`)
    .all(...params, f.limit, f.offset);
}

export async function getTransaction(householdId, id) {
  const row = await db.prepare(`${SELECT} WHERE t.household_id = ? AND t.id = ?`).get(todayISO(), householdId, id);
  if (!row) throw notFound();
  return row;
}

export async function createTransaction(householdId, userId, data) {
  await assertOwnership(householdId, data);
  const status = data.status ?? 'pending';
  const paidDate = status === 'paid' ? data.paid_date ?? todayISO() : null;
  const r = await db
    .prepare(`INSERT INTO transactions
      (household_id, type, description, notes, amount_cents, due_date, paid_date, status,
       category_id, person_id, scope, payment_method, income_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(householdId, data.type, data.description, data.notes ?? null, data.amount_cents, data.due_date,
      paidDate, status, data.category_id ?? null, data.person_id ?? null, data.scope,
      data.payment_method ?? null, data.income_type ?? null, userId);
  return getTransaction(householdId, r.lastInsertRowid);
}

export async function updateTransaction(householdId, id, data) {
  const current = await getTransaction(householdId, id);
  const merged = { ...current, ...data };
  await assertOwnership(householdId, merged);
  const paidDate = merged.status === 'paid' ? merged.paid_date ?? todayISO() : null;
  await db.prepare(`UPDATE transactions SET type=?, description=?, notes=?, amount_cents=?, due_date=?, paid_date=?,
      status=?, category_id=?, person_id=?, scope=?, payment_method=?, income_type=?
      WHERE id = ? AND household_id = ?`)
    .run(merged.type, merged.description, merged.notes ?? null, merged.amount_cents, merged.due_date, paidDate,
      merged.status, merged.category_id ?? null, merged.person_id ?? null, merged.scope,
      merged.payment_method ?? null, merged.income_type ?? null, id, householdId);
  return getTransaction(householdId, id);
}

/** Marca como pago/recebido: grava a data do pagamento. O saldo e a dashboard são derivados disso. */
export async function setPaid(householdId, id, paid, paidDate) {
  const t = await getTransaction(householdId, id);
  if (t.status === 'cancelled') throw badRequest('Lançamento cancelado não pode ser pago.');
  await db.prepare('UPDATE transactions SET status = ?, paid_date = ? WHERE id = ? AND household_id = ?')
    .run(paid ? 'paid' : 'pending', paid ? paidDate ?? todayISO() : null, id, householdId);
  return getTransaction(householdId, id);
}

export async function deleteTransaction(householdId, id) {
  await getTransaction(householdId, id);
  await db.prepare('DELETE FROM transactions WHERE id = ? AND household_id = ?').run(id, householdId);
}
