import {
  LayoutDashboard, Receipt, Landmark, TrendingUp, TrendingDown,
  CalendarDays, Settings,
} from 'lucide-react';

export const NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contas', label: 'Contas', icon: Receipt },
  { path: '/dividas', label: 'Dívidas', icon: Landmark },
  { path: '/receitas', label: 'Receitas', icon: TrendingUp },
  { path: '/despesas', label: 'Despesas', icon: TrendingDown },
  { path: '/calendario', label: 'Calendário', icon: CalendarDays },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

// Itens da barra inferior no celular; o restante vai em "Mais".
export const MOBILE_MAIN = ['/', '/contas', '/receitas', '/despesas'];
