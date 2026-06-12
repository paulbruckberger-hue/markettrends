import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, setToken } from '../lib/api';
import { useTheme } from '../lib/theme';
import { BrandMark } from '../components/ui';
import { AuthUser } from '../types';

/** Passwortloser Login über den Magic-Link aus dem Telegram-Bot (/magic?token=…). */
export default function MagicPage() {
  useTheme();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) { setError(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post<{ token: string; user: AuthUser }>('/api/auth/magic', { token });
        if (cancelled) return;
        setToken(data.token);
        qc.setQueryData(['me'], data.user);
        void qc.invalidateQueries({ queryKey: ['me'] });
        navigate('/', { replace: true });
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token, navigate, qc]);

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--page)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}><BrandMark size={56} radius={16} /></div>
        {error
          ? <>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Link ungültig oder abgelaufen</div>
              <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Zur Anmeldung</a>
            </>
          : <div style={{ color: 'var(--text-2)' }}>Anmeldung läuft …</div>}
      </div>
    </div>
  );
}
