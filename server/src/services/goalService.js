import { db, transaction } from '../db/index.js';
import { badRequest, notFound } from '../utils/errors.js';
import { todayISO } from '../utils/dates.js';

const withPct = (g) => ({ ...g, percent: Math.round((g.current_cents / g.target_cents) * 100), reached: g.current_cents >= g.target_cents });

export const listGoals = async (householdId) =>
  (await db.prepare('SELECT * FROM financial_goals WHERE household_id = ? ORDER BY (current_cents >= target_cents), id').all(householdId)).map(withPct);

export async function getGoal(householdId, id) {
  const g = await db.prepare('SELECT * FROM financial_goals WHERE id = ? AND household_id = ?').get(id, householdId);
  if (!g) throw notFound('Meta não encontrada.');
  return withPct(g);
}

export async function createGoal(householdId, userId, d) {
  return transaction(async () => {
    const r = await db.prepare('INSERT INTO financial_goals (household_id, name, target_cents, current_cents, deadline) VALUES (?, ?, ?, ?, ?)')
      .run(householdId, d.name, d.target_cents, d.current_cents ?? 0, d.deadline ?? null);
    const id = r.lastInsertRowid;
    if (d.current_cents) {
      await db.prepare('INSERT INTO goal_contributions (goal_id, user_id, amount_cents, date) VALUES (?, ?, ?, ?)')
        .run(id, userId, d.current_cents, todayISO());
    }
    return getGoal(householdId, id);
  });
}

export async function updateGoal(householdId, id, d) {
  const g = await getGoal(householdId, id);
  const m = { ...g, ...d };
  await db.prepare('UPDATE financial_goals SET name = ?, target_cents = ?, deadline = ? WHERE id = ? AND household_id = ?')
    .run(m.name, m.target_cents, m.deadline ?? null, id, householdId);
  return getGoal(householdId, id);
}

/** amount_cents > 0 guarda dinheiro na meta; < 0 retira. O valor atual nunca fica negativo. */
export async function contribute(householdId, userId, id, amount) {
  const g = await getGoal(householdId, id);
  if (g.current_cents + amount < 0) {
    throw badRequest('Valor maior que o guardado na meta.', { amount_cents: 'Maior que o saldo da meta.' });
  }
  return transaction(async () => {
    await db.prepare('UPDATE financial_goals SET current_cents = current_cents + ? WHERE id = ?').run(amount, id);
    await db.prepare('INSERT INTO goal_contributions (goal_id, user_id, amount_cents, date) VALUES (?, ?, ?, ?)').run(id, userId, amount, todayISO());
    return getGoal(householdId, id);
  });
}

export async function deleteGoal(householdId, id) {
  await getGoal(householdId, id);
  await transaction(async () => {
    await db.prepare('DELETE FROM goal_contributions WHERE goal_id = ?').run(id);
    await db.prepare('DELETE FROM financial_goals WHERE id = ? AND household_id = ?').run(id, householdId);
  });
}
