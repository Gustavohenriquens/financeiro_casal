import { useEffect, useState } from 'react';
import { api, ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { INCOME_TYPES, PAYMENT_METHODS, todayISO } from '../format.js';
import Modal from './Modal.jsx';
import { Field, MoneyInput, Segmented } from './fields.jsx';

const TITLES = { income: 'Nova receita', expense: 'Nova despesa', bill: 'Nova conta a pagar' };

/**
 * mode: 'income' | 'expense' (já realizada) | 'bill' (conta a pagar, nasce pendente).
 * Com `initial` (um lançamento existente) o formulário vira edição.
 */
export default function TransactionForm({ mode, initial, onClose, onSaved }) {
  const { household } = useAuth();
  const editing = !!initial;
  const type = editing ? initial.type : mode === 'income' ? 'income' : 'expense';
  const [categories, setCategories] = useState([]);
  const [f, setF] = useState(() => ({
    description: initial?.description ?? '',
    amount_cents: initial?.amount_cents ?? 0,
    due_date: initial?.due_date ?? todayISO(),
    category_id: initial?.category_id ? String(initial.category_id) : '',
    person: initial ? (initial.person_id ? String(initial.person_id) : 'both') : 'both',
    scope: initial?.scope ?? 'shared',
    payment_method: initial?.payment_method ?? '',
    income_type: initial?.income_type ?? 'Salário',
    status: initial?.status ?? (mode === 'bill' ? 'pending' : 'paid'),
    notes: initial?.notes ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const isParcel = !!(initial?.debt_id || initial?.installment_plan_id);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.items.filter((c) => c.kind === type)));
  }, [type]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      type,
      description: f.description,
      amount_cents: f.amount_cents,
      due_date: f.due_date,
      status: f.status,
      paid_date: f.status === 'paid' ? (editing && initial.paid_date) || f.due_date : null,
      category_id: f.category_id ? Number(f.category_id) : null,
      person_id: f.person === 'both' ? null : Number(f.person),
      scope: f.scope,
      payment_method: type === 'expense' && f.payment_method ? f.payment_method : null,
      income_type: type === 'income' ? f.income_type : null,
      notes: f.notes || null,
    };
    try {
      if (editing) await api.patch(`/transactions/${initial.id}`, body);
      else await api.post('/transactions', body);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fields, _: err.message });
      else throw err;
    } finally {
      setSaving(false);
    }
  }

  const done = f.status === 'paid';
  const statusOptions = [
    ['pending', 'Pendente'],
    ['paid', type === 'income' ? 'Recebida' : 'Paga'],
    ['cancelled', 'Cancelada'],
  ];
  return (
    <Modal title={editing ? `Editar ${type === 'income' ? 'receita' : 'lançamento'}` : TITLES[mode]} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        {isParcel && <p className="form-hint">Esta é uma parcela. Para alterar o parcelamento inteiro, exclua e recrie na tela correspondente.</p>}
        <Field label="Descrição" error={errors.description}>
          <input autoFocus value={f.description} onChange={(e) => set('description')(e.target.value)}
            placeholder={type === 'income' ? 'Ex.: Salário' : 'Ex.: Internet'} maxLength={120} />
        </Field>

        <div className="grid-2">
          <Field label="Valor" error={errors.amount_cents}>
            <MoneyInput value={f.amount_cents} onChange={set('amount_cents')} />
          </Field>
          <Field label={done ? 'Data' : 'Vencimento'} error={errors.due_date}>
            <input type="date" value={f.due_date} onChange={(e) => set('due_date')(e.target.value)} />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Categoria" error={errors.category_id}>
            <select value={f.category_id} onChange={(e) => set('category_id')(e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Pessoa" error={errors.person_id}>
            <select value={f.person} onChange={(e) => set('person')(e.target.value)}>
              {household.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="both">Ambos</option>
            </select>
          </Field>
        </div>

        {type === 'expense' ? (
          <Field label="Forma de pagamento" error={errors.payment_method}>
            <select value={f.payment_method} onChange={(e) => set('payment_method')(e.target.value)}>
              <option value="">Não informada</option>
              {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Tipo" error={errors.income_type}>
            <select value={f.income_type} onChange={(e) => set('income_type')(e.target.value)}>
              {INCOME_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        )}

        <Field label="Tipo de lançamento">
          <Segmented value={f.scope} onChange={set('scope')} options={[['shared', 'Compartilhada'], ['individual', 'Individual']]} />
        </Field>

        {editing ? (
          <Field label="Situação"><Segmented value={f.status} onChange={set('status')} options={statusOptions} /></Field>
        ) : (
          <label className="check">
            <input type="checkbox" checked={done} onChange={(e) => set('status')(e.target.checked ? 'paid' : 'pending')} />
            <span>{type === 'income' ? 'Já recebida' : 'Já paga'}</span>
          </label>
        )}

        <Field label="Observação (opcional)" error={errors.notes}>
          <textarea rows={2} value={f.notes} onChange={(e) => set('notes')(e.target.value)} maxLength={500} />
        </Field>

        {errors._ && !Object.keys(errors).some((k) => k !== '_') && <p className="form-error">{errors._}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
