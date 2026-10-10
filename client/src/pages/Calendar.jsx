import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { money, monthLabel, todayISO } from '../format.js';
import { StatusBadge } from './TransactionsPage.jsx';

const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const pad = (n) => String(n).padStart(2, '0');
const shift = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

// Receita = verde, pendente = amarelo, paga = azul, vencida = vermelho.
const evClass = (t) => (t.type === 'income' ? 'ev-income' : `ev-${t.effective_status}`);

export default function Calendar() {
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(today);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const last = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
    try {
      const r = await api.get(`/transactions?from=${month}-01&to=${month}-${pad(last)}&order=asc&limit=500`);
      setItems(r.items.filter((t) => t.status !== 'cancelled'));
      setError('');
    } catch (e) { setError(e.message); }
  }, [month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(month === today.slice(0, 7) ? today : `${month}-01`); }, [month, today]);

  const byDay = useMemo(() => {
    const m = {};
    (items || []).forEach((t) => (m[t.due_date] ||= []).push(t));
    return m;
  }, [items]);

  const first = new Date(+month.slice(0, 4), +month.slice(5, 7) - 1, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];

  const sum = (pred) => (items || []).filter(pred).reduce((a, t) => a + t.amount_cents, 0);
  const dayItems = byDay[selected] || [];
  const pay = async (t) => { await api.post(`/transactions/${t.id}/pay`); load(); };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Calendário</h1>
        <div className="month-switch">
          <button className="icon-btn" onClick={() => setMonth(shift(month, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <span>{monthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(shift(month, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="summary">
        <div><span>Receitas</span><strong className="pos">{money(sum((t) => t.type === 'income'))}</strong></div>
        <div><span>Despesas</span><strong>{money(sum((t) => t.type === 'expense'))}</strong></div>
        <div><span>A pagar</span><strong>{money(sum((t) => t.type === 'expense' && t.status === 'pending'))}</strong></div>
        <div><span>Vencidas</span><strong className="neg">{money(sum((t) => t.effective_status === 'overdue' && t.type === 'expense'))}</strong></div>
      </div>

      <div className="legend-row">
        <span><i className="ev-income" />Receita</span><span><i className="ev-pending" />Pendente</span>
        <span><i className="ev-paid" />Paga</span><span><i className="ev-overdue" />Vencida</span>
      </div>

      <div className="card cal">
        <div className="cal-grid cal-head">{WEEK.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="cal-grid">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} className="cal-cell blank" />;
            const evs = byDay[iso] || [];
            return (
              <button key={iso} className={`cal-cell ${iso === today ? 'today' : ''} ${iso === selected ? 'sel' : ''}`} onClick={() => setSelected(iso)}>
                <span className="cal-day">{+iso.slice(8)}</span>
                {evs.slice(0, 2).map((t) => (
                  <span key={t.id} className={`ev ${evClass(t)}`}><i /><span className="ev-text">{t.description}</span></span>
                ))}
                {evs.length > 2 && <span className="ev-more">+{evs.length - 2}</span>}
                <span className="ev-dots">{evs.slice(0, 4).map((t) => <i key={t.id} className={evClass(t)} />)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="card">
        <h3 className="card-title">{selected.split('-').reverse().join('/')}</h3>
        {dayItems.length === 0 && <p className="muted">Nenhum compromisso neste dia.</p>}
        <ul className="list">
          {dayItems.map((t) => (
            <li key={t.id} className="list-item">
              <span className={`dot ${evClass(t)}`} />
              <div className="grow"><strong>{t.description}</strong><small className="muted">{t.category_name || 'Sem categoria'} · {t.person_name || 'Ambos'}</small></div>
              <strong className={t.type === 'income' ? 'pos' : ''}>{t.type === 'income' ? '+' : ''}{money(t.amount_cents)}</strong>
              <StatusBadge status={t.effective_status} type={t.type} />
              {t.status === 'pending' && <button className="btn small" onClick={() => pay(t)}><Check size={15} /> {t.type === 'income' ? 'Recebi' : 'Pagar'}</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
