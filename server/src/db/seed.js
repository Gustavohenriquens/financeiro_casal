// Dados de demonstração: npm run seed  (login: ana@demo.com / bruno@demo.com, senha: demo12345)
import { db } from './index.js';
import { migrate } from './migrate.js';
import { register } from '../services/authService.js';
import { createTransaction } from '../services/transactionService.js';
import { addDays, currentMonth, shiftMonth, todayISO } from '../utils/dates.js';

await migrate();

if (await db.prepare('SELECT 1 FROM users WHERE email = ?').get('ana@demo.com')) {
  console.log('Dados de demonstração já existem.');
  process.exit(0);
}

const ana = await register({ name: 'Ana', email: 'ana@demo.com', password: 'demo12345', householdName: 'Ana & Bruno' });
const { invite_code } = await db.prepare('SELECT invite_code FROM households WHERE id = ?').get(ana.household_id);
const bruno = await register({ name: 'Bruno', email: 'bruno@demo.com', password: 'demo12345', inviteCode: invite_code });

const H = ana.household_id;
const cat = async (name, kind) => (await db.prepare('SELECT id FROM categories WHERE household_id=? AND name=? AND kind=?').get(H, name, kind)).id;
const today = todayISO();
const month = currentMonth();
const day = (d) => `${month}-${String(d).padStart(2, '0')}`;

const add = (o) => createTransaction(H, ana.id, { scope: 'shared', ...o });

for (let i = 3; i >= 0; i--) {
  const m = shiftMonth(month, -i);
  await add({ type: 'income', description: 'Salário Ana', amount_cents: 450000, due_date: `${m}-05`, status: 'paid', paid_date: `${m}-05`, person_id: ana.id, scope: 'individual', category_id: await cat('Salário', 'income'), income_type: 'Salário' });
  await add({ type: 'income', description: 'Salário Bruno', amount_cents: 520000, due_date: `${m}-05`, status: 'paid', paid_date: `${m}-05`, person_id: bruno.id, scope: 'individual', category_id: await cat('Salário', 'income'), income_type: 'Salário' });
  await add({ type: 'expense', description: 'Aluguel', amount_cents: 180000, due_date: `${m}-10`, status: 'paid', paid_date: `${m}-10`, category_id: await cat('Moradia', 'expense'), payment_method: 'pix' });
  await add({ type: 'expense', description: 'Mercado', amount_cents: 120000 + i * 7000, due_date: `${m}-12`, status: 'paid', paid_date: `${m}-12`, person_id: ana.id, category_id: await cat('Alimentação', 'expense'), payment_method: 'debito' });
  await add({ type: 'expense', description: 'Lazer', amount_cents: 45000, due_date: `${m}-18`, status: 'paid', paid_date: `${m}-18`, person_id: bruno.id, scope: 'individual', category_id: await cat('Lazer', 'expense'), payment_method: 'credito' });
}

await add({ type: 'expense', description: 'Internet', amount_cents: 12000, due_date: addDays(today, 1), category_id: await cat('Moradia', 'expense'), payment_method: 'boleto' });
await add({ type: 'expense', description: 'Energia', amount_cents: 21050, due_date: addDays(today, -3), category_id: await cat('Moradia', 'expense'), payment_method: 'boleto' });
await add({ type: 'expense', description: 'Cartão de crédito', amount_cents: 85000, due_date: addDays(today, 5), category_id: await cat('Cartão', 'expense'), payment_method: 'boleto', person_id: ana.id });
await add({ type: 'expense', description: 'Netflix', amount_cents: 5590, due_date: today, category_id: await cat('Assinaturas', 'expense'), payment_method: 'credito' });
await add({ type: 'expense', description: 'Faculdade', amount_cents: 78000, due_date: day(28) > today ? day(28) : addDays(today, 12), category_id: await cat('Educação', 'expense'), person_id: bruno.id, scope: 'individual' });
await add({ type: 'income', description: 'Freelance site', amount_cents: 150000, due_date: addDays(today, 6), person_id: bruno.id, scope: 'individual', category_id: await cat('Freelance', 'income'), income_type: 'Freelance' });

await db.prepare('INSERT INTO financial_goals (household_id, name, target_cents, current_cents) VALUES (?, ?, ?, ?)').run(H, 'Reserva de emergência', 1000000, 350000);

console.log('Dados de demonstração criados. Login: ana@demo.com ou bruno@demo.com / demo12345');
