import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import { apiError } from '../lib/api';
import { useTheme } from '../lib/theme';
import { BrandMark, BrandWord } from '../components/ui';

export default function LoginPage() {
  useTheme(); // ensure theme CSS variables are applied on the login screen
  const [username, setUsername] = useState('paul');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ username, password });
      navigate('/');
    } catch {
      /* error rendered below */
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid var(--border-strong)', background: 'var(--raise)',
    borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 16,
    outline: 'none', fontFamily: 'var(--font)',
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--page)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 26 }}>
          <div style={{ marginBottom: 14 }}><BrandMark size={56} radius={16} /></div>
          <div style={{ fontSize: 24 }}><BrandWord size={24} /></div>
          <p style={{ marginTop: 6, color: 'var(--text-2)', fontSize: 14 }}>B2B Content Intelligence</p>
        </div>

        <form onSubmit={onSubmit} style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 22,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, fontWeight: 600 }}>Benutzername</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, fontWeight: 600 }}>Passwort</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={inputStyle} />
          </div>

          {login.isError && (
            <div style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, var(--neg) 40%, transparent)', background: 'color-mix(in srgb, var(--neg) 12%, transparent)', color: 'var(--neg)', padding: '10px 12px', fontSize: 13.5 }}>
              {apiError(login.error, 'Anmeldung fehlgeschlagen')}
            </div>
          )}

          <button type="submit" disabled={login.isPending} className="pill pill-accent press"
            style={{ width: '100%', padding: '13px 0', fontSize: 15.5, opacity: login.isPending ? 0.6 : 1 }}>
            {login.isPending ? 'Anmeldung …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
