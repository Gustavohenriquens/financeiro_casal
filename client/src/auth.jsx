import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, household: null });

  const refresh = useCallback(async () => {
    try {
      const { user, household } = await api.get('/auth/me');
      setState({ loading: false, user, household });
    } catch {
      setState({ loading: false, user: null, household: null });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (body) => { await api.post('/auth/login', body); await refresh(); };
  const register = async (body) => { await api.post('/auth/register', body); await refresh(); };
  const logout = async () => { await api.post('/auth/logout'); setState({ loading: false, user: null, household: null }); };

  return <AuthContext.Provider value={{ ...state, login, register, logout, refresh }}>{children}</AuthContext.Provider>;
}

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</ThemeContext.Provider>;
}
