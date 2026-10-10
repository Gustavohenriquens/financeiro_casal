import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Plus, Repeat, RotateCcw, Search, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, money, PAYMENT_METHODS, todayISO } from '../format.js';
import TransactionForm from '../components/TransactionForm.jsx';

export const STATUS_LABEL = {
  expense: { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido', cancelled: 'Cancelado' },
  income: { pending: 'A receber', paid: 'Recebido', overdue: 'Atrasado', cancelled: 'Cancelado' },
};

export const StatusBadge = ({ status, type = 'expense' }) => (
  <span className={`badge ${status}`}>{STATUS_LABEL[type][status]}</span>
);

function monthBounds() {
  const t = todayISO();
  const [y, m] = t.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${t.slice(0, 7)}-01`, to: `${t.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

/** Lista genérica de lançamentos (Contas, Receitas, Despesas) com filtros e busca. */
export default function TransactionsPage({ title, type, newMode, newLabel, order = 'desc', defaultStatus = '' }) {
  const { household } = useAuth();
  const initialFilters = useMemo(() => ({ ...monthBounds(), q: '', person: '', category_id: '', status: defaultStatus, payment_method: '', scope: '' }), [defaultStatus]);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { mode } | { initial }
  const [q, setQ] = useState('');

  useEffect(() => { api.get('/categories').then((r) => setCategories(r.items.filter((c) => c.kind === type))); }, [type]);
  // Debounce da busca por texto.
  useEffect(() => { const t = setTimeout(() => setFilters((f) => ({ ...f, q })), 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ type, order, limit: '500' });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      setItems((await api.get(`/transactions?${params}`)).items);
      setError('');
    } catch (e) { setError(e.message); }
  }, [filters, type, order]);
  useEffect(() => { load(); }, [load]);

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const act = async (fn) => { try { await fn(); await load(); } catch (e) { setError(e.message); } };
  const remove = (t) => confirm(`Excluir "${t.description}"?`) && act(() => api.del(`/transactions/${t.id}`));

  const totals = useMemo(() => {
    const sum = (pred) => (items || []).filter(pred).reduce((a, t) => a + t.amount_cents, 0);
    return {
      all: sum((t) => t.status !== 'cancelled'),
      done: sum((t) => t.status === 'paid'),
      open: sum((t) => t.status === 'pending'),
      late: sum((t) => t.effective_status === 'overdue'),
    };
  }, [items]);

  const isIncome = type === 'income';
  const dirty = JSON.stringify({ ...filters, q: '' }) !== JSON.stringify({ ...initialFilters, q: '' }) || q;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{title}</h1>
        <div className="row" style={{ gap: 8 }}>
          {type !== 'expense' || newMode === 'bill' ? <Link to="/recorrentes" className="btn"><Repeat size={16} /> Recorrentes</Link> : null}
          <button className="btn primary" onClick={() => setForm({ mode: newMode })}><Plus size={18} /> {newLabel}</button>
        </div>
      </div>

      <div className="card filters">
        <div className="search"><Search size={16} /><input placeholder="Buscar por descrição…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="filter-grid">
          <label className="field"><span className="field-label">De</span><input type="date" value={filters.from} onChange={setF('from')} /></label>
          <label className="field"><span className="field-label">Até</span><input type="date" value={filters.to} onChange={setF('to')} /></label>
          <label className="field"><span className="field-label">Situação</span>
            <select value={filters.status} onChange={setF('status')}>
              <option value="">Todas</option>
              {Object.entries(STATUS_LABEL[type]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Pessoa</span>
            <select value={filters.person} onChange={setF('person')}>
              <option value="">Todas</option>
              {household.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="both">Ambos</option>
            </select>
          </label>
          <label className="field"><span className="field-label">Categoria</span>
            <select value={filters.category_id} onChange={setF('category_id')}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {!isIncome && (
            <label className="field"><span className="field-label">Pagamento</span>
              <select value={filters.payment_method} onChange={setF('payment_method')}>
                <option value="">Todos</option>
                {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          )}
          <label className="field"><span className="field-label">Tipo</span>
            <select value={filters.scope} onChange={setF('scope')}>
              <option value="">Todos</option>
              <option value="shared">Compartilhada</option>
              <option value="individual">Individual</option>
            </select>
          </label>
        </div>
        {dirty && <button className="link" onClick={() => { setFilters(initialFilters); setQ(''); }}>Limpar filtros</button>}
      </div>

      <div className="summary">
        <div><span>Total</span><strong>{money(totals.all)}</strong></div>
        <div><span>{isIncome ? 'Recebido' : 'Pago'}</span><strong className="pos">{money(totals.done)}</strong></div>
        <div><span>{isIncome ? 'A receber' : 'Pendente'}</span><strong>{money(totals.open)}</strong></div>
        {!isIncome && <div><span>Vencido</span><strong className={totals.late ? 'neg' : ''}>{money(totals.late)}</strong></div>}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="card tx-list">
        {!items && <div className="skeleton" style={{ height: 120 }} />}
        {items && items.length === 0 && <p className="muted pad center">Nenhum lançamento encontrado com esses filtros.</p>}
        {items?.map((t) => (
          <div key={t.id} className={`tx ${t.status === 'cancelled' ? 'cancelled' : ''}`}>
            <span className="dot" style={{ background: t.category_color || 'var(--muted)' }} />
            <div className="grow">
              <strong>{t.description}{t.installment_number ? ` · parcela ${t.installment_number}` : ''}</strong>
              <small className="muted">
                {fmtDate(t.paid_date && t.status === 'paid' ? t.paid_date : t.due_date)}
                {t.category_name ? ` · ${t.category_name}` : ''} · {t.person_name || 'Ambos'}
                {t.scope === 'individual' ? ' · Individual' : ''}
                {t.payment_method ? ` · ${PAYMENT_METHODS.find(([v]) => v === t.payment_method)?.[1]}` : ''}
              </small>
            </div>
            <div className="tx-right">
              <strong className={isIncome ? 'pos' : ''}>{isIncome ? '+' : ''}{money(t.amount_cents)}</strong>
              <StatusBadge status={t.effective_status} type={type} />
            </div>
            <div className="tx-actions">
              {t.status === 'pending' && (
                <button className="btn small" onClick={() => act(() => api.post(`/transactions/${t.id}/pay`))}>
                  <Check size={15} /> {isIncome ? 'Recebi' : 'Pagar'}
                </button>
              )}
              {t.status === 'paid' && (
                <button className="icon-btn" title="Desfazer pagamento" aria-label="Desfazer pagamento" onClick={() => act(() => api.post(`/transactions/${t.id}/unpay`))}><RotateCcw size={16} /></button>
              )}
              <button className="icon-btn" aria-label="Editar" onClick={() => setForm({ initial: t })}><Pencil size={16} /></button>
              <button className="icon-btn" aria-label="Excluir" onClick={() => remove(t)}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {form && <TransactionForm mode={form.mode} initial={form.initial} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}
