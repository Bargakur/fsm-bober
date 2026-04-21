import { useState } from 'react';

interface UserInfo {
  id: number;
  login: string;
  fullName: string;
  role: string;
  email: string;
}

interface Props {
  onLogin: (token: string, user: UserInfo) => void;
}

const ROLE_LABELS: Record<string, string> = {
  handlowiec: 'Handlowiec',
  starszy_handlowiec: 'Starszy handlowiec',
  admin: 'Administrator',
  supervisor: 'Supervisor',
  superadmin: 'Superadmin',
};

export default function LoginScreen({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) {
      setError('Wpisz login i hasło');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const raw = import.meta.env.VITE_API_URL;
      const apiBase = raw
        ? `${raw.startsWith('http') ? raw : `https://${raw}`}/api`
        : '/api';
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Nieprawidłowy login lub hasło');
      }

      const data = await res.json();
      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Błąd logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <span className="login-logo-icon">🦫</span>
          <h1>FSM Bober</h1>
          <p className="login-subtitle">Field Service Management</p>
        </div>

        <div className="login-fields">
          <div className="field">
            <label>Login</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Wpisz login"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>Hasło</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Wpisz hasło"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  );
}

export type { UserInfo };
export { ROLE_LABELS };
