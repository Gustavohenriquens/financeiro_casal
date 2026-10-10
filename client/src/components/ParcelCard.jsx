import { useState } from 'react';
import { Check, ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate, money } from '../format.js';
import { StatusBadge } from '../pages/TransactionsPage.jsx';

/** Cartão de dívida/parcelamento: progresso derivado das parcelas + lista expansível. */
export default function ParcelCard({ item, kind, subtitle, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const [parcels, setParcels] = useState(null);
  const [busy, setBusy] = useState(false);

  const settled = item.pending_count === 0;
  const path = `/${kind}/${item.id}/parcels`;

  async function toggle() {
    setOpen((o) => !o);
    if (!open && !parcels) setParcels((await api.get(path)).items);
  }
  async function pay(p, paid) {
    setBusy(true);
    try {
      await api.post(`/transactions/${p.id}/${paid ? 'pay' : 'unpay'}`);
      setParcels((await api.get(path)).items);
      onChange();
    } finally { setBusy(false); }
  }

  return (
    <div className="card parcel-card">
      <div className="parcel-head">
        <div className="grow">
          <h3>{item.name}</h3>
          <small className="muted">{subtitle}</small>
        </div>
        {settled ? <span className="badge paid">Quitada</span>
          : item.overdue_count > 0 ? <span className="badge overdue">{item.overdue_count} atrasada{item.overdue_count > 1 ? 's' : ''}</span> : null}
        <button className="icon-btn" aria-label="Excluir" onClick={onDelete}><Trash2 size={17} /></button>
      </div>

      <div className="progress"><i style={{ width: `${item.percent}%` }} /></div>
      <p className="progress-text"><b>{item.paid_count} de {item.installments_count}</b> parcelas pagas — {item.percent}%</p>

      <div className="mini-stats">
        <div><span>Já pago</span><strong className="pos">{money(item.paid_cents)}</strong></div>
        <div><span>Falta pagar</span><strong>{money(item.pending_cents)}</strong></div>
        <div><span>Parcela</span><strong>{money(item.installment_cents)}</strong></div>
        <div><span>Restantes</span><strong>{item.pending_count}</strong></div>
      </div>
      {item.next_due && <small className="muted">Próxima parcela em {fmtDate(item.next_due)}</small>}

      <button className="link expand" onClick={toggle}>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> {open ? 'Ocultar parcelas' : 'Ver parcelas'}
      </button>
      {open && (
        <ul className="list">
          {!parcels && <li className="muted pad">Carregando…</li>}
          {parcels?.map((p) => (
            <li key={p.id} className="list-item">
              <span className="muted num">{p.installment_number}/{item.installments_count}</span>
              <div className="grow"><strong>{money(p.amount_cents)}</strong><small className="muted">{fmtDate(p.status === 'paid' ? p.paid_date : p.due_date)}</small></div>
              <StatusBadge status={p.effective_status} />
              {p.status === 'pending' && <button disabled={busy} className="btn small" onClick={() => pay(p, true)}><Check size={15} /> Pagar</button>}
              {p.status === 'paid' && <button disabled={busy} className="icon-btn" aria-label="Desfazer" onClick={() => pay(p, false)}><RotateCcw size={16} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
