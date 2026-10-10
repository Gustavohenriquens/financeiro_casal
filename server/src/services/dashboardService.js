import { db } from '../db/index.js';
import { addDays, currentMonth, monthRange, shiftMonth, todayISO } from '../utils/dates.js';

const one = (sql, ...params) => db.prepare(sql).get(...params);
const all = (sql, ...params) => db.prepare(sql).all(...params);

/** Saldo = receitas recebidas − despesas pagas (todo o histórico). */
export async function getBalance(householdId) {
  const r = await one(
    `SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount_cents ELSE -amount_cents END), 0) AS v
     FROM transactions WHERE household_id = ? AND status = 'paid'`, householdId);
  return r.v;
}

export async function getDashboard(householdId, month = currentMonth()) {
  const today = todayISO();
  const { from, to } = monthRange(month);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const rangeStart = `${months[0]}-01`;

  const paidIn = async (type) => (await one(
    `SELECT COALESCE(SUM(amount_cents),0) v FROM transactions
     WHERE household_id = ? AND type = ? AND status = 'paid' AND paid_date BETWEEN ? AND ?`,
    householdId, type, from, to)).v;

  const pendingExpense = (extra = '', ...p) =>
    one(`SELECT COALESCE(SUM(amount_cents),0) v, COUNT(*) n FROM transactions
         WHERE household_id = ? AND type = 'expense' AND status = 'pending' ${extra}`, householdId, ...p);

  // Consultas independentes rodam em paralelo (cada uma é uma ida ao banco na nuvem).
  const [toPay, overdue, debts, installments, income, expense, balance, upcoming, expectedIncome,
    byCategory, people, personRows, monthly, before, goals] = await Promise.all([
    pendingExpense(),
    pendingExpense('AND due_date < ?', today),
    pendingExpense('AND debt_id IS NOT NULL'),
    pendingExpense('AND installment_plan_id IS NOT NULL'),
    paidIn('income'),
    paidIn('expense'),
    getBalance(householdId),
    all(`SELECT t.id, t.description, t.amount_cents, t.due_date, t.type, t.person_id, u.name AS person_name,
        t.debt_id, t.installment_plan_id, c.name AS category_name, c.color AS category_color,
        CASE WHEN t.due_date < ? THEN 'overdue' ELSE 'pending' END AS effective_status
      FROM transactions t LEFT JOIN users u ON u.id = t.person_id LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.household_id = ? AND t.status = 'pending' AND t.due_date <= ?
      ORDER BY t.due_date, t.id LIMIT 12`, today, householdId, addDays(today, 7)),
    all(`SELECT t.id, t.description, t.amount_cents, t.due_date, u.name AS person_name
      FROM transactions t LEFT JOIN users u ON u.id = t.person_id
      WHERE t.household_id = ? AND t.type = 'income' AND t.status = 'pending'
      ORDER BY t.due_date LIMIT 5`, householdId),
    all(`SELECT COALESCE(c.name,'Sem categoria') AS name, COALESCE(c.color,'#94a3b8') AS color,
        SUM(t.amount_cents) AS value
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.household_id = ? AND t.type = 'expense' AND t.status = 'paid' AND t.paid_date BETWEEN ? AND ?
      GROUP BY t.category_id, c.name, c.color ORDER BY value DESC`, householdId, from, to),
    all('SELECT id, name FROM users WHERE household_id = ? ORDER BY id', householdId),
    all(`SELECT person_id, type, SUM(amount_cents) AS v FROM transactions
      WHERE household_id = ? AND status = 'paid' AND paid_date BETWEEN ? AND ? GROUP BY person_id, type`, householdId, from, to),
    all(`SELECT substr(paid_date,1,7) AS m, type, SUM(amount_cents) AS v FROM transactions
      WHERE household_id = ? AND status = 'paid' AND paid_date BETWEEN ? AND ?
      GROUP BY substr(paid_date,1,7), type`, householdId, rangeStart, to),
    one(`SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount_cents ELSE -amount_cents END),0) v
     FROM transactions WHERE household_id = ? AND status = 'paid' AND paid_date < ?`, householdId, rangeStart),
    all('SELECT id, name, target_cents, current_cents FROM financial_goals WHERE household_id = ? ORDER BY id LIMIT 3', householdId),
  ]);

  const byPerson = [...people.map((p) => ({ id: p.id, name: p.name })), { id: null, name: 'Ambos' }].map((p) => ({
    ...p,
    income: personRows.find((r) => r.person_id === p.id && r.type === 'income')?.v ?? 0,
    expense: personRows.find((r) => r.person_id === p.id && r.type === 'expense')?.v ?? 0,
  }));

  let running = before.v;
  const series = months.map((m) => {
    const inc = monthly.find((r) => r.m === m && r.type === 'income')?.v ?? 0;
    const exp = monthly.find((r) => r.m === m && r.type === 'expense')?.v ?? 0;
    running += inc - exp;
    return { month: m, income: inc, expense: exp, balance: running };
  });

  return {
    month,
    cards: {
      balance,
      toPay: { total: toPay.v, count: toPay.n },
      overdue: { total: overdue.v, count: overdue.n },
      debts: { total: debts.v, count: debts.n },
      installments: { total: installments.v, count: installments.n },
      committed: toPay.v, // contas pendentes + parcelas futuras (parcelas já são lançamentos pendentes)
      income,
      expense,
      savings: income - expense,
    },
    upcoming,
    expectedIncome,
    byCategory,
    byPerson,
    series,
    goals,
  };
}
