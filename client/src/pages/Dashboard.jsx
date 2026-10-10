import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, BellRing, Check, ChevronLeft, ChevronRight, CircleCheck, Info, Landmark, Users,
  PiggyBank, Plus, Receipt, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, money, monthLabel, monthShort, todayISO } from '../format.js';
import TransactionForm from '../components/TransactionForm.jsx';

const SEV_ICON = { danger: AlertTriangle, warning: BellRing, info: Info, success: CircleCheck };

function shift(ym, n) {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="card stat">
      <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

const moneyTip = { formatter: (v) => money(v), contentStyle: { borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--text)' } };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, n] = await Promise.all([api.get(`/dashboard?month=${month}`), api.get('/notifications')]);
      setData(d);
      setAlerts(n.items.filter((a) => !a.read));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  async function pay(item) {
    await api.post(`/transactions/${item.id}/pay`);
    load();
  }
  async function dismiss(id) {
    setAlerts((a) => a.filter((x) => x.id !== id));
    await api.post('/notifications/read', { id });
  }

  if (error) return <div className="page"><p className="form-error">{error} <button className="link" onClick={load}>Tentar de novo</button></p></div>;
  if (!data) return <div className="page"><div className="card skeleton" style={{ height: 160 }} /></div>;

  const c = data.cards;
  const isCurrent = month === todayISO().slice(0, 7);
  const series = data.series.map((s) => ({ ...s, label: monthShort(s.month) }));
  const catTotal = data.byCategory.reduce((a, x) => a + x.value, 0);
  const maxPerson = Math.max(1, ...data.byPerson.flatMap((p) => [p.income, p.expense]));

  const quick = [
    { label: 'Receita', icon: TrendingUp, onClick: () => setForm('income') },
    { label: 'Despesa', icon: TrendingDown, onClick: () => setForm('expense') },
    { label: 'Conta', icon: Receipt, onClick: () => setForm('bill') },
    { label: 'Dívida', icon: Landmark, onClick: () => navigate('/dividas?novo=1') },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="muted">Olá, {user.name} 👋</p>
          <h1 className="page-title">Painel do casal</h1>
        </div>
        <div className="month-switch">
          <button className="icon-btn" onClick={() => setMonth(shift(month, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <span>{monthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(shift(month, 1))} disabled={isCurrent} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.slice(0, 4).map((a) => {
            const Icon = SEV_ICON[a.severity] || Info;
            return (
              <div key={a.id} className={`alert ${a.severity}`}>
                <Icon size={18} /><span>{a.message}</span>
                <button className="icon-btn" onClick={() => dismiss(a.id)} aria-label="Dispensar"><X size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      <section className="hero card">
        <div>
          <span className="hero-label"><Wallet size={16} /> Saldo disponível</span>
          <strong className={`hero-value ${c.balance < 0 ? 'neg' : ''}`}>{money(c.balance)}</strong>
          <span className="hero-sub">Receitas recebidas − despesas pagas</span>
        </div>
        <div className="hero-side">
          <div><span>Comprometido</span><strong>{money(c.committed)}</strong></div>
          <div><span>Sobra após pagar tudo</span><strong className={c.balance - c.committed < 0 ? 'neg' : ''}>{money(c.balance - c.committed)}</strong></div>
        </div>
      </section>

      <div className="quick">
        {quick.map(({ label, icon: Icon, onClick }) => (
          <button key={label} className="quick-btn" onClick={onClick}>
            <span><Icon size={20} /></span>{label}
          </button>
        ))}
      </div>

      <div className="stats">
        <Stat icon={Receipt} tone="amber" label="A pagar" value={money(c.toPay.total)}
          sub={`${c.toPay.count} conta${c.toPay.count === 1 ? '' : 's'} pendente${c.toPay.count === 1 ? '' : 's'}`} />
        <Stat icon={AlertTriangle} tone="red" label="Vencidas" value={money(c.overdue.total)}
          sub={c.overdue.count ? `${c.overdue.count} conta${c.overdue.count > 1 ? 's' : ''} em atraso` : 'Tudo em dia 🎉'} />
        <Stat icon={Landmark} tone="violet" label="Dívidas" value={money(c.debts.total)}
          sub={c.debts.count ? `${c.debts.count} parcela${c.debts.count === 1 ? '' : 's'} em aberto` : 'Nenhuma dívida em aberto'} />
        <Stat icon={TrendingUp} tone="green" label="Receitas do mês" value={money(c.income)} />
        <Stat icon={TrendingDown} tone="red" label="Gastos do mês" value={money(c.expense)} />
        <Stat icon={PiggyBank} tone={c.savings >= 0 ? 'green' : 'red'} label="Economia" value={money(c.savings)}
          sub={c.income ? `${Math.round((c.savings / c.income) * 100)}% da receita` : undefined} />
      </div>

      <div className="cols">
        <section className="card">
          <h3 className="card-title">Próximos vencimentos</h3>
          {data.upcoming.length === 0 && <p className="muted pad">Nada vencendo nos próximos 7 dias. 🎉</p>}
          <ul className="list">
            {data.upcoming.map((t) => (
              <li key={t.id} className="list-item">
                <span className="dot" style={{ background: t.type === 'income' ? 'var(--green)' : t.effective_status === 'overdue' ? 'var(--red)' : 'var(--amber)' }} />
                <div className="grow">
                  <strong>{t.description}</strong>
                  <small className={t.effective_status === 'overdue' ? 'neg' : 'muted'}>
                    {t.effective_status === 'overdue' ? 'Vencida em ' : 'Vence em '}{fmtDate(t.due_date)}
                    {t.person_name ? ` · ${t.person_name}` : ''}
                  </small>
                </div>
                <strong>{money(t.amount_cents)}</strong>
                <button className="btn small" onClick={() => pay(t)} title="Marcar como paga"><Check size={15} /><span className="btn-label">Pagar</span></button>
              </li>
            ))}
          </ul>
          {data.expectedIncome.length > 0 && (
            <>
              <h4 className="card-sub">A receber</h4>
              <ul className="list">
                {data.expectedIncome.map((t) => (
                  <li key={t.id} className="list-item">
                    <span className="dot" style={{ background: 'var(--green)' }} />
                    <div className="grow"><strong>{t.description}</strong><small className="muted">{fmtDate(t.due_date)}{t.person_name ? ` · ${t.person_name}` : ''}</small></div>
                    <strong className="pos">{money(t.amount_cents)}</strong>
                    <button className="btn small" onClick={() => pay({ ...t, type: 'income' })}><Check size={15} /><span className="btn-label">Recebi</span></button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h3 className="card-title">Gastos por categoria</h3>
          {data.byCategory.length === 0 ? <p className="muted pad">Sem gastos pagos neste mês.</p> : (
            <div className="donut-wrap">
              <div className="donut">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie isAnimationActive={false} data={data.byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                      {data.byCategory.map((x) => <Cell key={x.name} fill={x.color} />)}
                    </Pie>
                    <Tooltip {...moneyTip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend">
                {data.byCategory.slice(0, 5).map((x) => (
                  <li key={x.name}><i style={{ background: x.color }} />{x.name}<b>{Math.round((x.value / catTotal) * 100)}%</b></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="cols">
        <section className="card">
          <h3 className="card-title">Receitas × despesas</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis hide />
              <Tooltip {...moneyTip} cursor={{ fill: 'var(--soft)' }} />
              <Bar maxBarSize={30} isAnimationActive={false} dataKey="income" name="Receitas" fill="var(--green)" radius={[6, 6, 0, 0]} />
              <Bar maxBarSize={30} isAnimationActive={false} dataKey="expense" name="Despesas" fill="var(--red)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <h3 className="card-title">Evolução do saldo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis hide />
              <Tooltip {...moneyTip} />
              <Area isAnimationActive={false} type="monotone" dataKey="balance" name="Saldo" stroke="var(--accent)" strokeWidth={2.5} fill="url(#bal)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="cols">
        <section className="card">
          <h3 className="card-title">Por pessoa — {monthLabel(month)}</h3>
          <div className="people">
            {data.byPerson.filter((p) => p.income || p.expense || p.id !== null).map((p) => (
              <div key={p.name} className="person">
                <div className="person-head"><span className="avatar">{p.id === null ? <Users size={15} /> : p.name[0]}</span><strong>{p.name}</strong></div>
                <div className="bar-row"><span>Recebeu</span><div className="bar"><i style={{ width: `${(p.income / maxPerson) * 100}%`, background: 'var(--green)' }} /></div><b>{money(p.income)}</b></div>
                <div className="bar-row"><span>Gastou</span><div className="bar"><i style={{ width: `${(p.expense / maxPerson) * 100}%`, background: 'var(--red)' }} /></div><b>{money(p.expense)}</b></div>
              </div>
            ))}
          </div>
        </section>

      </div>

      <button className="fab" onClick={() => setForm('expense')} aria-label="Nova despesa"><Plus size={24} /></button>
      {form && <TransactionForm mode={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}
