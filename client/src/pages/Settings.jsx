import { useState } from 'react';
import { Check, Copy, LogOut, Upload } from 'lucide-react';
import { api, ApiError } from '../api.js';
import { useAuth, useTheme } from '../auth.jsx';
import Avatar, { resizeAvatar } from '../components/Avatar.jsx';
import { Field, MoneyInput, Segmented } from '../components/fields.jsx';

/** Hook de formulário: controla erros por campo e mensagem de sucesso. */
function useSubmit(action) {
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e?.preventDefault();
    setBusy(true); setErrors({}); setDone(false);
    try { await action(); setDone(true); setTimeout(() => setDone(false), 2500); }
    catch (err) { if (!(err instanceof ApiError)) throw err; setErrors({ ...err.fields, _: err.message }); }
    finally { setBusy(false); }
  };
  return { errors, done, busy, run };
}

const Saved = ({ done }) => done ? <span className="saved"><Check size={15} /> Salvo</span> : null;
const FormError = ({ errors }) => errors._ && !Object.keys(errors).some((k) => k !== '_') ? <p className="form-error">{errors._}</p> : null;

function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [fileError, setFileError] = useState('');
  const s = useSubmit(async () => { await api.patch('/auth/me', { name, avatar }); await refresh(); });

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError('');
    try { setAvatar(await resizeAvatar(file)); } catch (err) { setFileError(err.message); }
  }

  return (
    <section className="card">
      <h3 className="card-title">Meu perfil</h3>
      <form onSubmit={s.run} noValidate className="form">
        <div className="avatar-row">
          <Avatar user={{ name, avatar }} size={64} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label className="btn small neutral"><Upload size={15} /> Escolher foto<input type="file" accept="image/*" hidden onChange={pick} /></label>
            {avatar && <button type="button" className="btn small neutral" onClick={() => setAvatar(null)}>Remover</button>}
          </div>
        </div>
        {(fileError || s.errors.avatar) && <p className="field-error">{fileError || s.errors.avatar}</p>}
        <Field label="Nome" error={s.errors.name}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="E-mail"><input value={user.email} disabled /></Field>
        <FormError errors={s.errors} />
        <div className="form-actions"><Saved done={s.done} /><button className="btn primary" disabled={s.busy}>Salvar perfil</button></div>
      </form>
    </section>
  );
}

function Password() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const s = useSubmit(async () => { await api.post('/auth/password', f); setF({ currentPassword: '', newPassword: '' }); });
  return (
    <section className="card">
      <h3 className="card-title">Alterar senha</h3>
      <form onSubmit={s.run} noValidate className="form">
        <Field label="Senha atual" error={s.errors.currentPassword}><input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
        <Field label="Nova senha" error={s.errors.newPassword} hint="Mínimo de 8 caracteres."><input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
        <FormError errors={s.errors} />
        <div className="form-actions"><Saved done={s.done} /><button className="btn primary" disabled={s.busy}>Alterar senha</button></div>
      </form>
    </section>
  );
}

function Couple() {
  const { household, refresh } = useAuth();
  const [name, setName] = useState(household.name);
  const [low, setLow] = useState(household.low_balance_cents);
  const [copied, setCopied] = useState(false);
  const s = useSubmit(async () => { await api.patch('/auth/household', { name, low_balance_cents: low }); await refresh(); });
  const missing = 2 - household.members.length;

  async function copy() {
    try { await navigator.clipboard.writeText(household.invite_code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão de clipboard */ }
  }

  return (
    <section className="card">
      <h3 className="card-title">Nosso casal</h3>
      <ul className="list">
        {household.members.map((m) => (
          <li key={m.id} className="list-item"><Avatar user={m} /><div className="grow"><strong>{m.name}</strong><small className="muted">{m.email}</small></div></li>
        ))}
      </ul>
      {missing > 0 && (
        <div className="invite">
          <p>Falta {missing} pessoa. Peça para ela criar a conta com este código de convite:</p>
          <div className="code"><code>{household.invite_code}</code><button className="btn small neutral" onClick={copy}>{copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}</button></div>
        </div>
      )}
      <form onSubmit={s.run} noValidate className="form" style={{ marginTop: 16 }}>
        <Field label="Nome da casa" error={s.errors.name}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="Avisar quando o saldo ficar abaixo de" error={s.errors.low_balance_cents} hint="Gera o alerta de saldo baixo."><MoneyInput value={low} onChange={setLow} /></Field>
        <FormError errors={s.errors} />
        <div className="form-actions"><Saved done={s.done} /><button className="btn primary" disabled={s.busy}>Salvar</button></div>
      </form>
    </section>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <div className="page">
      <div className="page-head"><h1 className="page-title">Configurações</h1></div>
      <div className="cols top">
        <div className="stack"><Profile /><Password /></div>
        <div className="stack">
          <Couple />
          <section className="card">
            <h3 className="card-title">Aparência e sessão</h3>
            <div className="form">
              <Field label="Tema">
                <Segmented value={theme} onChange={(v) => v !== theme && toggle()} options={[['light', '☀️ Claro'], ['dark', '🌙 Escuro']]} />
              </Field>
              <button className="btn" onClick={logout}><LogOut size={16} /> Sair da conta</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
