import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, Wallet, X } from 'lucide-react';
import { useAuth, useTheme } from '../auth.jsx';
import Avatar from './Avatar.jsx';
import { MOBILE_MAIN, NAV } from '../nav.js';

export default function Layout() {
  const { user, household, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    const page = NAV.find((n) => n.path === pathname)?.label || (pathname === '/recorrentes' ? 'Recorrentes' : 'Finanças');
    document.title = `${page} · Finanças do Casal`;
  }, [pathname]);

  const mobileMain = NAV.filter((n) => MOBILE_MAIN.includes(n.path));
  const mobileMore = NAV.filter((n) => !MOBILE_MAIN.includes(n.path));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Wallet size={20} /></span>
          <div>
            <strong>Finanças</strong>
            <small>{household?.name}</small>
          </div>
        </div>
        <nav>
          {NAV.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} className="nav-link">
              <Icon size={19} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <Avatar user={user} />
            <span>{user.name}</span>
          </div>
          <div className="row">
            <button className="icon-btn" onClick={toggle} aria-label="Alternar tema" title="Alternar tema">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn" onClick={logout} aria-label="Sair" title="Sair"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Wallet size={20} /></span><strong>Finanças</strong></div>
        <button className="icon-btn" onClick={toggle} aria-label="Alternar tema">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="content"><Outlet /></main>

      <nav className="bottom-nav">
        {mobileMain.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/'} className="bn-item">
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
        <button className={`bn-item ${more ? 'active' : ''}`} onClick={() => setMore((v) => !v)}>
          {more ? <X size={21} /> : <Menu size={21} />}<span>Mais</span>
        </button>
      </nav>

      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {mobileMore.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} className="sheet-link"><Icon size={20} /> {label}</NavLink>
            ))}
            <button className="sheet-link" onClick={logout}><LogOut size={20} /> Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}
