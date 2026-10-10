import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money, todayISO } from '../format.js';
import Modal from '../components/Modal.jsx';
import ParcelCard from '../components/ParcelCard.jsx';
import { Field, MoneyInput } from '../components/fields.jsx';

function DebtForm({ onClose, onSaved }) {
  const { household } = useAuth();
  const [f, setF] = useState({ name: '', creditor: '', original_cents: 0, installments_count: '1', installment_cents: 0,
    interest: '', first_due_date: todayISO(), paid_installments: '0', person: 'both', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const n = parseInt(f.installments_count, 10) || 0;
  const suggested = n > 0 && f.original_cents ? Math.ceil(f.original_cents / n) : 0;

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErrors({});
    try {
      await api.post('/debts', {
        name: f.name, creditor: f.creditor || null, original_cents: f.original_cents,
        installments_count: n, installment_cents: f.installment_cents || suggested || undefined,
        interest_rate: f.interest ? Number(f.interest.replace(',', '.')) : 0,
        first_due_date: f.first_due_date, paid_installments: parseInt(f.paid_installments, 10) || 0,
        person_id: f.person === 'both' ? null : Number(f.person), notes: f.notes || null,
      });
      onSaved();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors({ ...err.fields, _: err.message });
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Nova dívida" onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        <Field label="Nome da dívida" error={errors.name}><input autoFocus value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Ex.: Cartão de crédito" /></Field>
        <Field label="Credor" error={errors.creditor}><input value={f.creditor} onChange={(e) => set('creditor')(e.target.value)} placeholder="Ex.: Banco X" /></Field>
        <div className="grid-2">
          <Field label="Valor original" error={errors.original_cents}><MoneyInput value={f.original_cents} onChange={set('original_cents')} /></Field>
          <Field label="Nº de parcelas" error={errors.installments_count}><input inputMode="numeric" value={f.installments_count} onChange={(e) => set('installments_count')(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <div className="grid-2">
          <Field label="Valor da parcela" error={errors.installment_cents} hint={suggested ? `Sugerido: ${money(suggested)}` : undefined}>
            <MoneyInput value={f.installment_cents} onChange={set('installment_cents')} />
          </Field>
          <Field label="Juros (% ao mês, opcional)" error={errors.interest_rate}><input inputMode="decimal" value={f.interest} onChange={(e) => set('interest')(e.target.value)} placeholder="0" /></Field>
        </div>
        <div className="grid-2">
          <Field label="1º vencimento" error={errors.first_due_date}><input type="date" value={f.first_due_date} onChange={(e) => set('first_due_date')(e.target.value)} /></Field>
          <Field label="Parcelas já pagas" error={errors.paid_installments}><input inputMode="numeric" value={f.paid_installments} onChange={(e) => set('paid_installments')(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <Field label="Responsável" error={errors.person_id}>
          <select value={f.person} onChange={(e) => set('person')(e.target.value)}>
            {household.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="both">Ambos</option>
          </select>
        </Field>
        <Field label="Observações (opcional)" error={errors.notes}><textarea rows={2} value={f.notes} onChange={(e) => set('notes')(e.target.value)} /></Field>
        {errors._ && !Object.keys(errors).some((k) => k !== '_') && <p className="form-error">{errors._}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Debts() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(params.get('novo') === '1');

  const load = useCallback(async () => {
    try { setItems((await api.get('/debts')).items); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (params.get('novo')) setParams({}, { replace: true }); }, [params, setParams]);

  const remove = async (d) => {
    if (!confirm(`Excluir a dívida "${d.name}" e todas as suas parcelas (inclusive as já pagas)?`)) return;
    await api.del(`/debts/${d.id}`); load();
  };
  const open = (items || []).filter((d) => d.pending_count > 0);
  const total = open.reduce((a, d) => a + d.pending_cents, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Dívidas</h1>{items && <p className="muted">Você deve <b className="neg">{money(total)}</b> em {open.length} dívida{open.length === 1 ? '' : 's'}.</p>}</div>
        <button className="btn primary" onClick={() => setForm(true)}><Plus size={18} /> Nova dívida</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {items && items.length === 0 && <div className="card empty"><h3>Nenhuma dívida cadastrada</h3><p className="muted">Quando houver uma, as parcelas aparecem aqui e nos vencimentos.</p></div>}
      <div className="parcel-grid">
        {items?.map((d) => (
          <ParcelCard key={d.id} item={d} kind="debts" onChange={load} onDelete={() => remove(d)}
            subtitle={[d.creditor, d.person_name || 'Ambos', d.interest_rate_bp ? `${d.interest_rate_bp / 100}% a.m.` : null].filter(Boolean).join(' · ')} />
        ))}
      </div>
      {form && <DebtForm onClose={() => setForm(false)} onSaved={() => { setForm(false); load(); }} />}
    </div>
  );
}
