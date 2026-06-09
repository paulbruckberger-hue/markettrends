import { useState } from 'react';
import { Icon } from './Icon';

/** Lookback options for a manual historical scrape. undefined = default (recent only). */
const OPTIONS: { days?: number; label: string; sub: string }[] = [
  { days: undefined, label: 'Aktuell', sub: 'Nur neue Artikel (Standard)' },
  { days: 30, label: 'Letzte 30 Tage', sub: 'Rückwirkend suchen' },
  { days: 90, label: 'Letzte 90 Tage', sub: 'Rückwirkend suchen' },
  { days: 120, label: 'Letzte 120 Tage', sub: 'Rückwirkend suchen' },
];

/**
 * Refresh button with a dropdown to run the scraper for a watch, optionally
 * reaching back 30/90/120 days into the past. Calls onRun(days) — days
 * undefined means the default recent-only window.
 */
export function RunbackButton({ onRun, busy, align = 'right' }: {
  onRun: (days?: number) => void; busy?: boolean; align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);

  const pick = (days?: number) => {
    setOpen(false);
    onRun(days);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="iconbtn" style={{ color: 'var(--accent)' }} title="Abrufen (auch rückwirkend)"
        disabled={busy} onClick={() => setOpen((v) => !v)}>
        <Icon name={busy ? 'clock' : 'refresh'} size={19} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 81, width: 232,
            background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,0.28)', overflow: 'hidden', animation: 'fadeIn .15s',
          }}>
            <div style={{ padding: '11px 14px 7px', fontSize: 12, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Zeitraum durchsuchen
            </div>
            {OPTIONS.map((o) => (
              <button key={o.label} className="press" onClick={() => pick(o.days)} style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={o.days ? 'clock' : 'refresh'} size={16} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{o.label}</span>
                  <span style={{ display: 'block', color: 'var(--text-3)', fontSize: 12 }}>{o.sub}</span>
                </span>
              </button>
            ))}
            <div style={{ padding: '8px 14px 11px', color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.45, borderTop: '1px solid var(--border)' }}>
              Rückwirkende Suchen dauern länger und kosten mehr KI-Klassifikationen.
            </div>
          </div>
        </>
      )}
    </span>
  );
}
