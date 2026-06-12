import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAcceptInvite } from '../hooks/useAuth';
import { api, apiError } from '../lib/api';
import { useTheme } from '../lib/theme';
import { BrandMark, BrandWord } from '../components/ui';

const PLAN_LABEL: Record<string, string> = { free: 'Gratis', plus: 'Plus', pro: 'Pro' };

export default function AcceptInvitePage() {
  useTheme();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const accept = useAcceptInvite();

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: async () =>
      (await api.get<{ valid: boolean; email: string; plan: string; role: string }>(
        `/api/auth/invite/${encodeURIComponent(token)}`)).data,
    enabled: !!token,
    retry: false,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await accept.mutateAsync({ token, password });
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

  const invalid = !token || invite.isError || (invite.data && !invite.data.valid);

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--page)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 26 }}>
          <div style={{ marginBottom: 14 }}><BrandMark size={56} radius={16} /></div>
          <div style={{ fontSize: 24 }}><BrandWord size={24} /></div>
        </div>

        {invite.isLoading && !invalid ? (
          <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 14 }}>Einladung wird geprüft …</div>
        ) : invalid ? (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Einladung ungültig</div>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
              Dieser Einladungslink ist ungültig oder abgelaufen.
            </p>
            <Link to="/register" className="pill pill-accent press" style={{ display: 'inline-block', padding: '11px 20px', fontSize: 14.5, textDecoration: 'none' }}>
              Stattdessen kostenlos registrieren
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 22,
          }}>
            <div style={{ fontSize: 15, color: 'var(--text)', textAlign: 'center' }}>
              Willkommen! Richte dein Konto für<br />
              <b>{invite.data?.email}</b> ein
              {invite.data?.plan && invite.data.plan !== 'free' && (
                <span style={{ display: 'block', marginTop: 6, fontSize: 13, color: 'var(--accent)' }}>
                  Tarif {PLAN_LABEL[invite.data.plan] ?? invite.data.plan} vorgemerkt
                </span>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2)', marginBottom: 6, fontWeight: 600 }}>Passwort wählen</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="mindestens 6 Zeichen" style={inputStyle} />
            </div>

            {accept.isError && (
              <div style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, var(--neg) 40%, transparent)', background: 'color-mix(in srgb, var(--neg) 12%, transparent)', color: 'var(--neg)', padding: '10px 12px', fontSize: 13.5 }}>
                {apiError(accept.error, 'Einladung konnte nicht angenommen werden')}
              </div>
            )}

            <button type="submit" disabled={accept.isPending} className="pill pill-accent press"
              style={{ width: '100%', padding: '13px 0', fontSize: 15.5, opacity: accept.isPending ? 0.6 : 1 }}>
              {accept.isPending ? 'Konto wird erstellt …' : 'Konto einrichten & loslegen'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
