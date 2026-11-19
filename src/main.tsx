import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { FilterOptions, HrUser } from '../shared/compensation.ts';
import { api, ApiError, messageFor } from './api.ts';
import { Brand, ErrorNotice } from './components.tsx';
import { Directory } from './directory.tsx';
import { Reports } from './reports.tsx';
import './styles.css';

function Login({ onLogin }: { onLogin: (user: HrUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onLogin(await api<HrUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
    } catch (reason) {
      setError(messageFor(reason));
    } finally { setBusy(false); }
  }

  return <main className="login-page"><div className="login-shell"><div className="login-brand"><Brand /></div>
    <form className="login-form" onSubmit={submit}><h1>Sign in</h1><p>Access the HR compensation workspace.</p>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <label className="control"><span>Work email</span><input type="email" autoComplete="username" value={email}
        onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
      <label className="control"><span>Password</span><input type="password" autoComplete="current-password" value={password}
        onChange={event => setPassword(event.target.value)} required maxLength={200} /></label>
      <button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </div></main>;
}

function Workspace({ user, onLogout }: { user: HrUser; onLogout: () => void }) {
  const [view, setView] = useState<'employees' | 'compensation'>('employees');
  const [options, setOptions] = useState<FilterOptions>();
  const [optionsError, setOptionsError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setOptionsError('');
    api<FilterOptions>('/filters', { signal: controller.signal }).then(setOptions)
      .catch(reason => { if (!controller.signal.aborted) setOptionsError(messageFor(reason)); });
    return () => controller.abort();
  }, [retry]);

  async function logout() {
    setLogoutError('');
    try {
      await api('/auth/logout', { method: 'POST', body: '{}' });
      onLogout();
    } catch (reason) { setLogoutError(messageFor(reason)); }
  }

  return <div className="workspace">
    <a className="skip" href="#main-content">Skip to content</a>
    <aside className="sidebar"><Brand />
      <nav aria-label="Workspace"><button type="button" className={view === 'employees' ? 'active' : ''}
        aria-current={view === 'employees' ? 'page' : undefined} onClick={() => setView('employees')}>
        <span className="nav-symbol people-symbol" aria-hidden="true" />Employees</button>
        <button type="button" className={view === 'compensation' ? 'active' : ''}
          aria-current={view === 'compensation' ? 'page' : undefined} onClick={() => setView('compensation')}>
          <span className="nav-symbol chart-symbol" aria-hidden="true" />Compensation</button></nav>
      <div className="session"><span className="avatar account-avatar" aria-hidden="true">HR</span>
        <div><strong>{user.name}</strong><button type="button" onClick={() => void logout()}>Sign out</button></div></div>
    </aside>
    <main id="main-content" className="main" tabIndex={-1}>
      {logoutError && <ErrorNotice>{logoutError}</ErrorNotice>}
      {optionsError && <ErrorNotice onRetry={() => setRetry(value => value + 1)}>{optionsError}</ErrorNotice>}
      {!options && !optionsError && <p role="status">Loading workspace…</p>}
      {options && (view === 'employees' ? <Directory options={options} /> : <Reports options={options} />)}
    </main>
  </div>;
}

function App() {
  const [user, setUser] = useState<HrUser | null>();
  const [startupError, setStartupError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const clearSession = () => setUser(null);
    window.addEventListener('acme-session-ended', clearSession);
    setStartupError('');
    api<HrUser>('/auth/me', { signal: controller.signal }).then(setUser).catch(reason => {
      if (controller.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) setUser(null);
      else setStartupError(messageFor(reason));
    });
    return () => { controller.abort(); window.removeEventListener('acme-session-ended', clearSession); };
  }, [retry]);

  if (startupError) return <main className="startup"><ErrorNotice onRetry={() => setRetry(value => value + 1)}>{startupError}</ErrorNotice></main>;
  if (user === undefined) return <main className="startup" role="status">Loading Salary Manager…</main>;
  return user ? <Workspace user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(<App />);
