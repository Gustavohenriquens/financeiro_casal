import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import Debts from './pages/Debts.jsx';
import Recurring from './pages/Recurring.jsx';
import Calendar from './pages/Calendar.jsx';

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <div className="splash">Carregando…</div>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="contas" element={<TransactionsPage key="contas" title="Contas a pagar" type="expense" newMode="bill" newLabel="Nova conta" order="asc" />} />
        <Route path="receitas" element={<TransactionsPage key="receitas" title="Receitas" type="income" newMode="income" newLabel="Nova receita" />} />
        <Route path="despesas" element={<TransactionsPage key="despesas" title="Despesas" type="expense" newMode="expense" newLabel="Nova despesa" />} />
        <Route path="dividas" element={<Debts />} />
        <Route path="recorrentes" element={<Recurring />} />
        <Route path="calendario" element={<Calendar />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
