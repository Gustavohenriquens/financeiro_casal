import { db } from '../db/index.js';
import { badRequest } from '../utils/errors.js';
import { currentMonth, monthRange, shiftMonth } from '../utils/dates.js';
import { getDashboard } from './dashboardService.js';
import { listTransactions } from './transactionService.js';
import { listDebts, listPlans } from './debtService.js';

const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);

const STATUS = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido', cancelled: 'Cancelado' };
const SCOPE = { shared: 'Compartilhada', individual: 'Individual' };
const METHOD = { pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', boleto: 'Boleto', transferencia: 'Transferência' };

// ------------------------------------------------------------ Visão mensal
export async function monthlyOverview(householdId, month = currentMonth()) {
  const { from, to } = monthRange(month);
  const [dash, bills, debts, startBalance, perDay] = await Promise.all([
    getDashboard(householdId, month),
    one(`SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 END), 0) AS paid_count,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents END), 0) AS paid_cents,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 END), 0) AS pending_count,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents END), 0) AS pending_cents
    FROM transactions WHERE household_id = ? AND type = 'expense' AND due_date BETWEEN ? AND ?`, householdId, from, to),
    // Dívidas do mês = parcelas de dívidas que vencem no mês (pagas ou não).
    one(`SELECT COALESCE(SUM(amount_cents),0) AS total,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents END),0) AS paid
    FROM transactions WHERE household_id = ? AND debt_id IS NOT NULL AND status != 'cancelled' AND due_date BETWEEN ? AND ?`, householdId, from, to),
    // Saldo dia a dia dentro do mês (a partir do saldo acumulado até o dia anterior).
    one(`SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount_cents ELSE -amount_cents END),0) AS v
    FROM transactions WHERE household_id = ? AND status = 'paid' AND paid_date < ?`, householdId, from).then((r) => r.v),
    all(`SELECT paid_date AS d, SUM(CASE type WHEN 'income' THEN amount_cents ELSE -amount_cents END) AS v
    FROM transactions WHERE household_id = ? AND status = 'paid' AND paid_date BETWEEN ? AND ? GROUP BY paid_date`, householdId, from, to),
  ]);
  const last = Number(to.slice(8));
  let run = startBalance;
  const daily = Array.from({ length: last }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`;
    run += perDay.find((r) => r.d === d)?.v ?? 0;
    return { day: i + 1, balance: run };
  });

  return {
    month,
    income: dash.cards.income,
    expense: dash.cards.expense,
    savings: dash.cards.savings,
    debts,
    bills,
    byCategory: dash.byCategory,
    byPerson: dash.byPerson,
    daily,
    series: dash.series,
  };
}

// ------------------------------------------------------------ Relatórios
const col = (key, label, type = 'text') => ({ key, label, type });

async function byCategory(h, from, to) {
  const rows = await all(`SELECT COALESCE(c.name,'Sem categoria') AS name, SUM(t.amount_cents) AS total, COUNT(*) AS count, COALESCE(c.color,'#94a3b8') AS color
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.household_id = ? AND t.type = 'expense' AND t.status = 'paid' AND t.paid_date BETWEEN ? AND ?
    GROUP BY t.category_id, c.name, c.color ORDER BY total DESC`, h, from, to);
  const sum = rows.reduce((a, r) => a + r.total, 0) || 1;
  return {
    title: 'Gastos por categoria',
    columns: [col('name', 'Categoria'), col('count', 'Lançamentos', 'int'), col('total', 'Total', 'money'), col('percent', '% do total', 'pct')],
    rows: rows.map((r) => ({ ...r, percent: Math.round((r.total / sum) * 1000) / 10 })),
  };
}

async function byPerson(h, from, to) {
  const people = [...(await all('SELECT id, name FROM users WHERE household_id = ? ORDER BY id', h)), { id: null, name: 'Ambos' }];
  const agg = await all(`SELECT person_id, type, SUM(amount_cents) AS v FROM transactions
    WHERE household_id = ? AND status = 'paid' AND paid_date BETWEEN ? AND ? GROUP BY person_id, type`, h, from, to);
  const rows = people.map((p) => {
    const income = agg.find((r) => r.person_id === p.id && r.type === 'income')?.v ?? 0;
    const expense = agg.find((r) => r.person_id === p.id && r.type === 'expense')?.v ?? 0;
    return { name: p.name, income, expense, balance: income - expense };
  });
  return {
    title: 'Receitas e gastos por pessoa',
    columns: [col('name', 'Pessoa'), col('income', 'Receitas', 'money'), col('expense', 'Gastos', 'money'), col('balance', 'Saldo', 'money')],
    rows,
  };
}

async function monthly(h, from, to) {
  const months = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7) && months.length < 60; m = shiftMonth(m, 1)) months.push(m);
  const agg = await all(`SELECT substr(paid_date,1,7) AS m, type, SUM(amount_cents) AS v FROM transactions
    WHERE household_id = ? AND status = 'paid' AND paid_date BETWEEN ? AND ? GROUP BY substr(paid_date,1,7), type`, h, `${months[0]}-01`, monthRange(months.at(-1)).to);
  let run = (await one(`SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount_cents ELSE -amount_cents END),0) AS v
    FROM transactions WHERE household_id = ? AND status = 'paid' AND paid_date < ?`, h, `${months[0]}-01`)).v;
  return {
    title: 'Evolução mensal',
    columns: [col('month', 'Mês', 'month'), col('income', 'Receitas', 'money'), col('expense', 'Despesas', 'money'), col('savings', 'Economia', 'money'), col('balance', 'Saldo acumulado', 'money')],
    rows: months.map((m) => {
      const income = agg.find((r) => r.m === m && r.type === 'income')?.v ?? 0;
      const expense = agg.find((r) => r.m === m && r.type === 'expense')?.v ?? 0;
      run += income - expense;
      return { month: m, income, expense, savings: income - expense, balance: run };
    }),
  };
}

const parcelColumns = (what) => [
  col('name', what), col('paid_count', 'Parcelas pagas', 'int'), col('installments_count', 'Total de parcelas', 'int'),
  col('percent', '% concluído', 'pct'), col('paid_cents', 'Já pago', 'money'), col('pending_cents', 'Falta pagar', 'money'),
];

async function transactionsReport(h, type, from, to) {
  const items = await listTransactions(h, { type, from, to, order: 'asc', limit: 5000, offset: 0 });
  return {
    title: type === 'income' ? 'Receitas' : 'Despesas',
    columns: [col('due_date', 'Data', 'date'), col('description', 'Descrição'), col('category_name', 'Categoria'), col('person_name', 'Pessoa'),
      col('scope_label', 'Tipo'), ...(type === 'expense' ? [col('method_label', 'Pagamento')] : [col('income_type', 'Origem')]),
      col('status_label', 'Situação'), col('amount_cents', 'Valor', 'money')],
    rows: items.map((t) => ({
      ...t, category_name: t.category_name ?? '', person_name: t.person_name ?? 'Ambos', income_type: t.income_type ?? '',
      scope_label: SCOPE[t.scope], method_label: METHOD[t.payment_method] ?? '', status_label: STATUS[t.effective_status],
    })),
  };
}

export const REPORT_KINDS = ['categorias', 'pessoas', 'mensal', 'dividas', 'parcelamentos', 'receitas', 'despesas'];

export async function runReport(h, kind, { from, to }) {
  if (from > to) throw badRequest('A data inicial deve ser anterior à final.', { from: 'Maior que a data final.' });
  switch (kind) {
    case 'categorias': return { kind, ...(await byCategory(h, from, to)) };
    case 'pessoas': return { kind, ...(await byPerson(h, from, to)) };
    case 'mensal': return { kind, ...(await monthly(h, from, to)) };
    case 'dividas': return { kind, title: 'Dívidas', columns: [col('name', 'Dívida'), col('creditor', 'Credor'), ...parcelColumns('Dívida').slice(1)], rows: (await listDebts(h)).map((d) => ({ ...d, creditor: d.creditor ?? '' })) };
    case 'parcelamentos': return { kind, title: 'Parcelamentos', columns: parcelColumns('Compra'), rows: await listPlans(h) };
    case 'receitas': return { kind, ...(await transactionsReport(h, 'income', from, to)) };
    case 'despesas': return { kind, ...(await transactionsReport(h, 'expense', from, to)) };
    default: throw badRequest('Relatório desconhecido.');
  }
}

// ------------------------------------------------------------ CSV (Excel pt-BR: ';' + BOM)
const brDate = (iso) => iso.split('-').reverse().join('/');
function cell(value, type) {
  if (value == null || value === '') return '';
  let s;
  if (type === 'money') s = (value / 100).toFixed(2).replace('.', ',');
  else if (type === 'pct') s = String(value).replace('.', ',');
  else if (type === 'date') s = brDate(value);
  else if (type === 'month') s = `${value.slice(5)}/${value.slice(0, 4)}`;
  else s = String(value);
  // Evita injeção de fórmula ao abrir no Excel.
  if (type === 'text' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCSV(report) {
  const lines = [report.columns.map((c) => cell(c.label, 'x')).join(';')];
  for (const r of report.rows) lines.push(report.columns.map((c) => cell(r[c.key], c.type)).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

export const defaultPeriod = () => ({ from: `${shiftMonth(currentMonth(), -5)}-01`, to: monthRange(currentMonth()).to });
