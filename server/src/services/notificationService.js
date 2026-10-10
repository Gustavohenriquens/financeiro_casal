import { db } from '../db/index.js';
import { addDays, currentMonth, todayISO } from '../utils/dates.js';
import { formatBRL } from '../utils/money.js';
import { getBalance } from './dashboardService.js';

const label = (t) => {
  if (t.installment_plan_id || t.debt_id) {
    return `A parcela${t.installment_number ? ` ${t.installment_number}` : ''} de "${t.description}"`;
  }
  return `A conta "${t.description}"`;
};

/**
 * Recalcula os alertas do casal. Cada alerta tem uma dedupe_key, então só é criado uma vez
 * (e continua "lido" se já foi dispensado). Alertas de contas que já foram pagas são removidos.
 */
export async function syncNotifications(householdId) {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const soon = addDays(today, 3);

  await db.prepare(`DELETE FROM notifications WHERE household_id = ? AND ref_type = 'transaction'
      AND ref_id IN (SELECT id FROM transactions WHERE household_id = ? AND status != 'pending')`)
    .run(householdId, householdId);

  const insertSql = `INSERT OR IGNORE INTO notifications
    (household_id, type, severity, message, ref_type, ref_id, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const inserts = [];
  const insert = { run: (...args) => inserts.push({ sql: insertSql, args }) };

  const pending = await db
    .prepare(`SELECT * FROM transactions WHERE household_id = ? AND type = 'expense'
      AND status = 'pending' AND due_date <= ?`)
    .all(householdId, soon);

  for (const t of pending) {
    const value = formatBRL(t.amount_cents);
    const isInstallment = t.installment_plan_id || t.debt_id;
    let alert;
    if (t.due_date < today) alert = ['overdue', 'danger', `${label(t)} de ${value} está vencida.`];
    else if (t.due_date === today) alert = ['due_today', 'warning', `${label(t)} de ${value} vence hoje.`];
    else if (t.due_date === tomorrow) alert = ['due_tomorrow', 'warning', `${label(t)} de ${value} vence amanhã.`];
    else if (isInstallment) alert = ['installment_soon', 'info', `${label(t)} de ${value} vence em breve.`];
    if (alert) insert.run(householdId, alert[0], alert[1], alert[2], 'transaction', t.id, `${alert[0]}:${t.id}`);
  }

  const { low_balance_cents } = await db.prepare('SELECT low_balance_cents FROM households WHERE id = ?').get(householdId);
  const balance = await getBalance(householdId);
  if (balance < low_balance_cents) {
    insert.run(householdId, 'low_balance', 'warning', `Saldo baixo: ${formatBRL(balance)} disponível.`,
      null, null, `low_balance:${currentMonth()}`);
  }

  const reached = await db
    .prepare('SELECT id, name FROM financial_goals WHERE household_id = ? AND current_cents >= target_cents')
    .all(householdId);
  for (const g of reached) {
    insert.run(householdId, 'goal_reached', 'success', `Meta atingida: "${g.name}"! 🎉`, 'goal', g.id, `goal:${g.id}`);
  }
  await db.batch(inserts);
}

export async function listNotifications(householdId, { unreadOnly = false } = {}) {
  await syncNotifications(householdId);
  return db
    .prepare(`SELECT id, type, severity, message, ref_type, ref_id, read, created_at FROM notifications
      WHERE household_id = ? ${unreadOnly ? 'AND read = 0' : ''}
      ORDER BY CASE severity WHEN 'danger' THEN 0 WHEN 'warning' THEN 1 WHEN 'success' THEN 2 ELSE 3 END, id DESC
      LIMIT 50`)
    .all(householdId);
}

export async function markRead(householdId, id) {
  if (id) await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND household_id = ?').run(id, householdId);
  else await db.prepare('UPDATE notifications SET read = 1 WHERE household_id = ?').run(householdId);
}
