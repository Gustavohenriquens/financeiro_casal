import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { api, ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, INCOME_TYPES, money, PAYMENT_METHODS, todayISO } from '../format.js';
import Modal from '../components/Modal.jsx';
import { Field, MoneyInput, Segmented } from '../components/fields.jsx';

const FREQ = { monthly: 'Mensal', weekly: 'Semanal', yearly: 'Anual' };

function RuleForm({ initial, onClose, onSaved }) {
  const { household } = useAuth();
  const [categories, setCategories] = useState([]);
  const [f, setF] = useState(() => ({
    type: initial?.type ?? 'expense', description: initial?.description ?? '', amount_cents: initial?.amount_cents ?? 0,
    frequency: initial?.frequency ?? 'monthly', day: String(initial?.day_of_month ?? new Date().getDate()),
    start_date: initial?.start_date ?? todayISO(), end_date: initial?.end_date ?? '',
    category_id: initial?.category_id ? String(initial.category_id) : '',
    person: initial ? (initial.person_id ? String(initial.person_id) : 'both') : 'both',
    scope: initial?.scope ?? 'shared', payment_method: initial?.payment_method ?? '', income_type: initial?.income_type ?? 'Salário',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { api.get('/categories').then((r) => setCategories(r.items.filter((c) => c.kind === f.type))); }, [f.type]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErrors({});
    const body = {
      type: f.type, description: f.description, amount_cents: f.amount_cents, frequency: f.frequency,
      day_of_month: f.frequency === 'monthly' ? parseInt(f.day, 10) || undefined : Number(f.start_date.slice(8)) || undefined,
      start_date: f.start_date, end_date: f.end_date || null,
      category_id: f.category_id ? Number(f.category_id) : null, person_id: f.person === 'both' ? null : Number(f.person),
      scope: f.scope, payment_method: f.type === 'expense' && f.payment_method ? f.payment_method : null,
      income_type: f.type === 'income' ? f.income_type : null,
    };
    try {
      if (initial) await api.patch(`/recurring/${initial.id}`, body); else await api.post('/recurring', body);
      onSaved();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors({ ...err.fields, _: err.message });
    } finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Editar recorrência' : 'Nova recorrência'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        {!initial && <Segmented value={f.type} onChange={(v) => setF((s) => ({ ...s, type: v, category_id: '' }))} options={[['expense', 'Despesa'], ['income', 'Receita']]} />}
        <Field label="Descrição" error={errors.description}><input autoFocus value={f.description} onChange={(e) => set('description')(e.target.value)} placeholder={f.type === 'income' ? 'Ex.: Salário' : 'Ex.: Netflix'} /></Field>
        <div className="grid-2">
          <Field label="Valor" error={errors.amount_cents}><MoneyInput value={f.amount_cents} onChange={set('amount_cents')} /></Field>
          <Field label="Periodicidade" error={errors.frequency}>
            <select value={f.frequency} onChange={(e) => set('frequency')(e.target.value)}>
              {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid-2">
          {f.frequency === 'monthly' && (
            <Field label="Dia do vencimento" error={errors.day_of_month} hint="Em meses curtos usa o último dia.">
              <input inputMode="numeric" value={f.day} onChange={(e) => set('day')(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </Field>
          )}
          <Field label="Data inicial" error={errors.start_date}><input type="date" value={f.start_date} onChange={(e) => set('start_date')(e.target.value)} /></Field>
          <Field label="Data final (opcional)" error={errors.end_date}><input type="date" value={f.end_date} onChange={(e) => set('end_date')(e.target.value)} /></Field>
        </div>
        <div className="grid-2">
          <Field label="Categoria"><select value={f.category_id} onChange={(e) => set('category_id')(e.target.value)}>
            <option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></Field>
          <Field label="Pessoa"><select value={f.person} onChange={(e) => set('person')(e.target.value)}>
            {household.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}<option value="both">Ambos</option>
          </select></Field>
        </div>
        {f.type === 'expense' ? (
          <Field label="Forma de pagamento"><select value={f.payment_method} onChange={(e) => set('payment_method')(e.target.value)}>
            <option value="">Não informada</option>{PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></Field>
        ) : (
          <Field label="Tipo"><select value={f.income_type} onChange={(e) => set('income_type')(e.target.value)}>{INCOME_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        )}
        <Field label="Tipo de lançamento"><Segmented value={f.scope} onChange={set('scope')} options={[['shared', 'Compartilhada'], ['individual', 'Individual']]} /></Field>
        {initial && <p className="form-hint">Os lançamentos futuros ainda pendentes serão atualizados. O que já foi pago não muda.</p>}
        {errors._ && !Object.keys(errors).some((k) => k !== '_') && <p className="form-error">{errors._}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Recurring() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // {} novo | {initial}

  const load = useCallback(async () => {
    try { setItems((await api.get('/recurring')).items); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn) => { try { await fn(); await load(); } catch (e) { setError(e.message); } };

  const monthly = (items || []).filter((r) => r.active && r.frequency === 'monthly');
  const out = monthly.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount_cents, 0);
  const inn = monthly.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount_cents, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/contas" className="link back"><ArrowLeft size={15} /> Contas</Link>
          <h1 className="page-title">Contas recorrentes</h1>
          {items && <p className="muted">Fixos mensais: <b className="neg">{money(out)}</b> saindo · <b className="pos">{money(inn)}</b> entrando.</p>}
        </div>
        <button className="btn primary" onClick={() => setForm({})}><Plus size={18} /> Nova recorrência</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {items && items.length === 0 && (
        <div className="card empty"><div className="empty-icon"><Repeat size={26} /></div><h3>Nenhuma recorrência</h3>
          <p className="muted">Cadastre Netflix, aluguel, salário… os próximos lançamentos são criados automaticamente.</p></div>
      )}
      <div className="card tx-list" style={items?.length ? undefined : { display: 'none' }}>
        {items?.map((r) => (
          <div key={r.id} className={`tx ${r.active ? '' : 'cancelled'}`}>
            <span className="dot" style={{ background: r.type === 'income' ? 'var(--green)' : 'var(--red)' }} />
            <div className="grow">
              <strong>{r.description}</strong>
              <small className="muted">
                {FREQ[r.frequency]}{r.frequency === 'monthly' ? ` · dia ${r.day_of_month}` : ''}
                {r.person_name ? ` · ${r.person_name}` : ' · Ambos'}
                {r.active ? (r.next_due ? ` · próximo ${fmtDate(r.next_due)}` : '') : ' · pausada'}
                {r.end_date ? ` · até ${fmtDate(r.end_date)}` : ''}
              </small>
            </div>
            <strong className={r.type === 'income' ? 'pos' : ''}>{r.type === 'income' ? '+' : ''}{money(r.amount_cents)}</strong>
            <div className="tx-actions" style={{ marginLeft: 0 }}>
              <button className="icon-btn" title={r.active ? 'Pausar' : 'Retomar'} aria-label={r.active ? 'Pausar' : 'Retomar'}
                onClick={() => act(() => api.patch(`/recurring/${r.id}`, { active: !r.active }))}>{r.active ? <Pause size={16} /> : <Play size={16} />}</button>
              <button className="icon-btn" aria-label="Editar" onClick={() => setForm({ initial: r })}><Pencil size={16} /></button>
              <button className="icon-btn" aria-label="Excluir" onClick={() => confirm(`Excluir "${r.description}"? Os lançamentos futuros pendentes serão removidos.`) && act(() => api.del(`/recurring/${r.id}`))}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {form && <RuleForm initial={form.initial} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}
