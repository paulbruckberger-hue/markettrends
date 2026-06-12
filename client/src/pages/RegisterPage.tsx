import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import { apiError } from '../lib/api';
import { useTheme } from '../lib/theme';
import { BrandMark, BrandWord } from '../components/ui';

export default function RegisterPage() {
  useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await register.mutateAsync({ email: email.trim(), password });
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
          <p style={{ marginTop: 6, color: 'var(--text-2)', fontSize: 14 }}>Kostenlos starten — keine Kreditkarte nötig</p>
        </div>

        <form onSubmit={onSubmit} style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 22,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, fontWeight: 600 }}>E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, fontWeight: 600 }}>Passwort</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="mindestens 6 Zeichen" style={inputStyle} />
          </div>

          {register.isError && (
            <div style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, var(--neg) 40%, transparent)', background: 'color-mix(in srgb, var(--neg) 12%, transparent)', color: 'var(--neg)', padding: '10px 12px', fontSize: 13.5 }}>
              {apiError(register.error, 'Registrierung fehlgeschlagen')}
            </div>
          )}

          <button type="submit" disabled={register.isPending} className="pill pill-accent press"
            style={{ width: '100%', padding: '13px 0', fontSize: 15.5, opacity: register.isPending ? 0.6 : 1 }}>
            {register.isPending ? 'Konto wird erstellt …' : 'Kostenlos registrieren'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-2)' }}>
            Schon ein Konto? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Anmelden</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
