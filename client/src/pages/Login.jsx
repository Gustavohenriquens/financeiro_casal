import { useState } from 'react';
import { Eye, EyeOff, PiggyBank, ShieldCheck, Users, Wallet } from 'lucide-react';
import { ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field } from '../components/fields.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | create | join
  const [f, setF] = useState({ name: '', email: '', password: '', inviteCode: '', householdName: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (mode === 'login') await login({ email: f.email, password: f.password });
      else await register({ ...f, inviteCode: mode === 'join' ? f.inviteCode : '' });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors({ ...err.fields, _: err.message });
    } finally {
      setBusy(false);
    }
  }

  const title = { login: 'Bem-vindo de volta', create: 'Criar área do casal', join: 'Entrar na área do casal' }[mode];
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="brand"><span className="brand-mark light"><Wallet size={20} /></span><strong>Finanças do Casal</strong></div>
        <div>
          <h2>As contas de vocês,<br />num só lugar.</h2>
          <ul>
            <li><Users size={18} /> Dois acessos, uma visão compartilhada</li>
            <li><PiggyBank size={18} /> Saiba na hora quanto sobra no mês</li>
            <li><ShieldCheck size={18} /> Seus dados ficam só com vocês</li>
          </ul>
        </div>
        <small>© {new Date().getFullYear()} Finanças do Casal</small>
      </aside>
      <div className="auth-main">
      <div className="auth-card">
        <div className="brand mobile-only"><span className="brand-mark"><Wallet size={20} /></span><strong>Finanças do Casal</strong></div>
        <h1>{title}</h1>
        <p className="muted">
          {mode === 'login' ? 'Veja como estão as finanças de vocês.' : mode === 'create' ? 'Você cria e depois convida seu par com um código.' : 'Use o código de convite que seu par recebeu.'}
        </p>
        <form onSubmit={submit} noValidate className="form">
          {mode !== 'login' && (
            <Field label="Seu nome" error={errors.name}><input value={f.name} onChange={set('name')} autoComplete="name" /></Field>
          )}
          <Field label="E-mail" error={errors.email}>
            <input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Senha" error={errors.password} hint={mode !== 'login' ? 'Mínimo de 8 caracteres.' : undefined}>
            <div className="pw">
              <input type={show ? 'text' : 'password'} value={f.password} onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          {mode === 'create' && (
            <Field label="Nome da casa (opcional)" error={errors.householdName}>
              <input value={f.householdName} onChange={set('householdName')} placeholder="Ex.: Ana & Bruno" />
            </Field>
          )}
          {mode === 'join' && (
            <Field label="Código de convite" error={errors.inviteCode}>
              <input value={f.inviteCode} onChange={set('inviteCode')} style={{ textTransform: 'uppercase' }} />
            </Field>
          )}
          {errors._ && !Object.keys(errors).some((k) => k !== '_') && <p className="form-error">{errors._}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              <button className="link" onClick={() => setMode('create')}>Criar área do casal</button>
              <button className="link" onClick={() => setMode('join')}>Tenho um código de convite</button>
            </>
          ) : (
            <button className="link" onClick={() => { setMode('login'); setErrors({}); }}>Já tenho conta</button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
