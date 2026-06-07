import { ReactNode } from 'react';
import { Chevron, DetailBar, SectionLabel, UserCircle, Verified } from '../components/ui';
import { Icon, IconName } from '../components/Icon';
import { ACCENTS, Theme } from '../lib/theme';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { AuthUser } from '../types';

type Nav = (name: string, params?: Record<string, unknown>) => void;

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="press" onClick={(e) => { e.stopPropagation(); onChange(!on); }} style={{
      width: 46, height: 28, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--border-strong)',
      border: 'none', position: 'relative', cursor: 'pointer', transition: 'background .15s', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

function Row({ icon, title, sub, right, onClick, color }: {
  icon: IconName; title: string; sub?: string; right?: ReactNode; onClick?: () => void; color?: string;
}) {
  return (
    <div className="press" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ color: color || 'var(--text-2)', flexShrink: 0 }}><Icon name={icon} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: color || 'var(--text)' }}>{title}</div>
        {sub && <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const AI_LABEL: Record<string, string> = { claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek' };
const THEMES: { k: Theme; label: string; swatch: string }[] = [
  { k: 'light', label: 'Hell', swatch: '#fff' },
  { k: 'dim', label: 'Dim', swatch: '#15202b' },
  { k: 'dark', label: 'Schwarz', swatch: '#000' },
];

export default function SettingsScreen({ theme, setTheme, accent, setAccent, back, me, onLogout, nav }: {
  theme: Theme; setTheme: (t: Theme) => void; accent: string; setAccent: (a: string) => void;
  back: () => void; me: AuthUser | undefined; onLogout: () => void; nav: Nav;
}) {
  const { data: s } = useSettings();
  const update = useUpdateSettings();
  const set = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);

  return (
    <>
      <DetailBar title="Einstellungen" back={back} />
      <div style={{ paddingBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
          <UserCircle name={me?.username ?? '?'} size={52} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{me?.username ?? 'Konto'}</span><Verified size={15} />
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{me?.email || (me?.role === 'admin' ? 'Administrator' : 'Pro')}</div>
          </div>
        </div>
        <div className="hr" />

        <SectionLabel>Darstellung</SectionLabel>
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, marginBottom: 9 }}>Design</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map((t) => {
              const on = theme === t.k;
              return (
                <button key={t.k} className="press" onClick={() => setTheme(t.k)} style={{
                  flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                  background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: t.swatch, border: '1px solid var(--border-strong)' }} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, margin: '16px 0 9px' }}>Akzentfarbe</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {ACCENTS.map((c) => (
              <button key={c} className="press" onClick={() => setAccent(c)} style={{
                width: 34, height: 34, borderRadius: '50%', background: c, border: accent === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>{accent === c && <Icon name="check" size={16} />}</button>
            ))}
          </div>
        </div>
        <div className="hr" />

        <SectionLabel>Benachrichtigungen</SectionLabel>
        <Row icon="bell" title="P1-Signale sofort" sub="Push bei kritischen Signalen"
          right={<Toggle on={!!s?.notify_rank_1} onChange={(v) => set({ notify_rank_1: v })} />} />
        <Row icon="bolt" title="Telegram" sub={s?.telegram_connected ? 'Verbunden' : 'Nicht verbunden'}
          right={<span style={{ color: s?.telegram_connected ? 'var(--pos)' : 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>{s?.telegram_connected ? 'Aktiv' : 'Aus'}</span>} />
        <Row icon="calendar" title="Wochen-Briefing" sub={s?.newsletter_enabled ? `${s.newsletter_day ?? 'Montag'}, ${s.newsletter_time ?? '07:00'}` : 'Deaktiviert'}
          right={<Toggle on={!!s?.newsletter_enabled} onChange={(v) => set({ newsletter_enabled: v })} />} />
        <div className="hr" />

        <SectionLabel>KI & Daten</SectionLabel>
        <Row icon="sparkle" title="KI-Modell" sub={`${AI_LABEL[s?.ai_model ?? 'claude']} · für Klassifizierung & Ranking`} right={<Chevron />} onClick={() => undefined} />
        <Row icon="target" title="Relevanz-Training" sub="Dein 👍/👎-Feedback steuert das Ranking" right={<Chevron />} onClick={() => undefined} />
        <Row icon="globe" title="Sprache" sub={s?.language === 'en' ? 'English' : 'Deutsch'} right={<Chevron />} onClick={() => undefined} />
        {me?.role === 'admin' && <Row icon="settings" title="Administration" sub="Quellen, Nutzer, App-Konfiguration" right={<Chevron />} onClick={() => nav('admin')} />}
        <div className="hr" />

        <Row icon="logout" title="Abmelden" color="var(--neg)" onClick={onLogout} />
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 16 }}>Nicheletter.ai · v2.0</div>
      </div>
    </>
  );
}
