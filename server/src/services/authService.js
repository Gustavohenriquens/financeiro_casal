import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, transaction } from '../db/index.js';
import { badRequest, conflict, unauthorized } from '../utils/errors.js';

const EXPENSE_CATEGORIES = [
  ['Alimentação', '#f97316'], ['Transporte', '#0ea5e9'], ['Moradia', '#d9b25a'],
  ['Saúde', '#ef4444'], ['Educação', '#14b8a6'], ['Lazer', '#ec4899'],
  ['Compras', '#84cc16'], ['Assinaturas', '#64748b'], ['Dívidas', '#dc2626'],
  ['Cartão', '#a8a29e'], ['Outros', '#94a3b8'],
];
const INCOME_CATEGORIES = [
  ['Salário', '#16a34a'], ['Freelance', '#22c55e'], ['Extra', '#84cc16'],
  ['Investimento', '#10b981'], ['Presente', '#f472b6'], ['Outros', '#94a3b8'],
];

export const MAX_MEMBERS = 2;

async function seedCategories(householdId) {
  const sql = 'INSERT INTO categories (household_id, name, kind, color) VALUES (?, ?, ?, ?)';
  await db.batch([
    ...EXPENSE_CATEGORIES.map(([name, color]) => ({ sql, args: [householdId, name, 'expense', color] })),
    ...INCOME_CATEGORIES.map(([name, color]) => ({ sql, args: [householdId, name, 'income', color] })),
  ]);
}

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar ?? null });

export async function register({ name, email, password, inviteCode, householdName }) {
  email = email.toLowerCase();
  if (await db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw conflict('Este e-mail já está cadastrado.', { email: 'E-mail já cadastrado.' });
  }
  const hash = bcrypt.hashSync(password, 10);

  return transaction(async () => {
    let householdId;
    if (inviteCode) {
      const h = await db.prepare('SELECT id FROM households WHERE invite_code = ?').get(inviteCode.trim().toUpperCase());
      if (!h) throw badRequest('Código de convite inválido.', { inviteCode: 'Código inválido.' });
      const { n } = await db.prepare('SELECT COUNT(*) n FROM users WHERE household_id = ?').get(h.id);
      if (n >= MAX_MEMBERS) {
        throw conflict('Esta área do casal já tem duas pessoas.', { inviteCode: 'Área do casal já completa.' });
      }
      householdId = h.id;
    } else {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const r = await db
        .prepare('INSERT INTO households (name, invite_code) VALUES (?, ?)')
        .run(householdName?.trim() || 'Nossa casa', code);
      householdId = Number(r.lastInsertRowid);
      await seedCategories(householdId);
    }
    const r = await db
      .prepare('INSERT INTO users (household_id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(householdId, name.trim(), email, hash);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  });
}

export async function login({ email, password }) {
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw unauthorized('E-mail ou senha incorretos.');
  }
  return user;
}

export async function getHousehold(householdId) {
  const household = await db
    .prepare('SELECT id, name, invite_code, low_balance_cents FROM households WHERE id = ?')
    .get(householdId);
  const members = await db
    .prepare('SELECT id, name, email, avatar FROM users WHERE household_id = ? ORDER BY id')
    .all(householdId);
  return { ...household, members: members.map(publicUser) };
}

export async function updateProfile(userId, { name, avatar }) {
  await db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(name, avatar ?? null, userId);
  return publicUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    throw badRequest('Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' });
  }
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), userId);
}

export async function updateHousehold(householdId, { name, low_balance_cents }) {
  await db.prepare('UPDATE households SET name = ?, low_balance_cents = ? WHERE id = ?').run(name, low_balance_cents, householdId);
  return getHousehold(householdId);
}
