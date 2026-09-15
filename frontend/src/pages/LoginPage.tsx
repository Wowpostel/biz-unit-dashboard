import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('disp@erpevv.local');
  const [password, setPassword] = useState('Disp123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      nav(user.role === 'OPERATOR' ? '/kiosk' : '/office', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>ERPEVV</h1>
        <p>Цеховой контур. Войдите по своей учётке — роль откроет офис или терминал.</p>
        <label>Почта</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
        {error && <div className="err">{error}</div>}
      </form>
    </div>
  );
}
