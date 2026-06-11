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

const PUSH_HOURS = [6, 7, 8, 9, 12, 18, 20];
const FREQ_OPTS: { k: 'weekly' | 'few' | 'daily'; label: string }[] = [
  { k: 'weekly', label: 'Wöchentlich' }, { k: 'few', label: '2–3×/Woche' }, { k: 'daily', label: 'Täglich' },
];
const FREQ_LABEL: Record<string, string> = { weekly: 'Wöchentlich', few: '2–3× pro Woche', daily: 'Täglich' };

function Pills<T extends string | number>({ options, value, onChange }: {
  options: { k: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '2px 16px 14px' }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <button key={String(o.k)} className="press" onClick={() => onChange(o.k)} style={{
            padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
            background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-2)',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export default function SettingsScreen({ theme, setTheme, accent, setAccent, back, me, onLogout, nav }: {
  theme: Theme; setTheme: (t: Theme) => void; accent: string; setAccent: (a: string) => void;
  back: () => void; me: AuthUser | undefined; onLogout: () => void; nav: Nav;
}) {
  const { data: s } = useSettings();
  const update = useUpdateSettings();
  const set = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);
  const tgLink = s?.telegram_bot_username && me ? `https://t.me/${s.telegram_bot_username}?start=${me.id}` : null;

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
        {s?.telegram_connected
          ? <Row icon="bolt" title="Telegram" sub="Verbunden"
              right={<span style={{ color: 'var(--pos)', fontSize: 12.5, fontWeight: 700 }}>Aktiv</span>} />
          : tgLink
            ? <Row icon="bolt" title="Telegram" sub="Tippen, um Push zu verbinden"
                onClick={() => window.open(tgLink, '_blank', 'noopener')}
                right={<span style={{ color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>Verbinden →</span>} />
            : <Row icon="bolt" title="Telegram" sub="Nicht verfügbar"
                right={<span style={{ color: 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>Aus</span>} />}

        <Row icon="bell" title="Tagesbriefing" sub={s?.daily_push_enabled ? `1× täglich · ${String(s.daily_push_hour ?? 8).padStart(2, '0')}:00 Uhr · Top 3–5` : 'Aus'}
          right={<Toggle on={!!s?.daily_push_enabled} onChange={(v) => set({ daily_push_enabled: v })} />} />
        {s?.daily_push_enabled && (
          <Pills options={PUSH_HOURS.map((h) => ({ k: h, label: `${String(h).padStart(2, '0')}:00` }))}
            value={s?.daily_push_hour ?? 8} onChange={(h) => set({ daily_push_hour: h })} />
        )}
        <Row icon="flame" title="Breaking-Alerts" sub="Sofort – nur bei marktbewegenden Ereignissen"
          right={<Toggle on={!!s?.breaking_alerts_enabled} onChange={(v) => set({ breaking_alerts_enabled: v })} />} />

        <Row icon="mail" title="Newsletter (E-Mail)" sub={s?.newsletter_enabled ? `${FREQ_LABEL[s.newsletter_frequency ?? 'weekly']} · alle Details` : 'Aus'}
          right={<Toggle on={!!s?.newsletter_enabled} onChange={(v) => set({ newsletter_enabled: v })} />} />
        {s?.newsletter_enabled && (
          <Pills options={FREQ_OPTS} value={s?.newsletter_frequency ?? 'weekly'} onChange={(f) => set({ newsletter_frequency: f })} />
        )}
        <Row icon="grid" title="Themen-Cluster" sub="Newsletter nach Themen bündeln" right={<Chevron />} onClick={() => nav('clusters')} />
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
