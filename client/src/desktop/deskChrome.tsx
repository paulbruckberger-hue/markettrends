import { ReactNode, useState } from 'react';
import { Icon } from '../components/Icon';
import { GEO_META } from '../lib/presenter';
import { useCreateWatch } from '../hooks/useWatchlist';
import { GeoFilter, WatchType } from '../types';

/* Sticky header for desktop center-column screens. */
export function DeskHeader({ title, onBack, right, sub, big }: {
  title: ReactNode; onBack?: () => void; right?: ReactNode; sub?: ReactNode; big?: boolean;
}) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)', background: 'var(--bar-blur)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: big ? '16px 18px' : '11px 18px' }}>
        {onBack && <button className="iconbtn" onClick={onBack} style={{ marginLeft: -6 }}><Icon name="back" size={22} /></button>}
        <h1 style={{ margin: 0, fontSize: big ? 24 : 20.5, fontWeight: 900, letterSpacing: -0.5, flex: 1, lineHeight: 1.1 }}>{title}</h1>
        {right}
      </div>
      {sub}
    </div>
  );
}

/* Segmented feed-card view switch (Standard / Kompakt / Karte). */
export function ViewSwitch({ variant, setVariant }: { variant: string; setVariant: (v: string) => void }) {
  const VIEWS = [{ k: 'standard', label: 'Standard' }, { k: 'kompakt', label: 'Kompakt' }, { k: 'karte', label: 'Karte' }];
  return (
    <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 999, background: 'var(--chip)' }}>
      {VIEWS.map((v) => {
        const on = v.k === variant;
        return (
          <button key={v.k} className="press" onClick={() => setVariant(v.k)} style={{
            padding: '6px 13px', borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', border: 'none',
            background: on ? 'var(--bg)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-2)',
            boxShadow: on ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
          }}>{v.label}</button>
        );
      })}
    </div>
  );
}

/* Centered compose modal — desktop equivalent of the mobile bottom sheet. */
export function ComposeModal({ onClose, flash }: { onClose: () => void; flash: (m: string) => void }) {
  const [type, setType] = useState<WatchType>('topic');
  const [query, setQuery] = useState('');
  const [geo, setGeo] = useState<GeoFilter>('global');
  const create = useCreateWatch();

  const examples = type === 'topic'
    ? ['Stablecoins', 'Open Banking', 'Tokenisierung', 'BNPL Regulierung']
    : ['Revolut', 'Klarna', 'Trade Republic', 'Wise'];

  const submit = async () => {
    if (!query.trim() || create.isPending) return;
    try {
      await create.mutateAsync({ type, query: query.trim(), geo_filter: geo });
      flash('Beobachtung angelegt');
      onClose();
    } catch {
      flash('Anlegen fehlgeschlagen');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'fadeIn .2s' }} />
      <div style={{
        position: 'relative', width: 560, maxWidth: '100%', maxHeight: '90vh', background: 'var(--bg)', color: 'var(--text)',
        borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.45)', animation: 'pop .22s', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={22} /></button>
          <span style={{ fontWeight: 800, fontSize: 17 }}>Neue Beobachtung</span>
          <button className="pill pill-accent press" disabled={!query.trim() || create.isPending} onClick={submit}
            style={{ padding: '9px 20px', fontSize: 14, opacity: query.trim() && !create.isPending ? 1 : 0.5 }}>
            {create.isPending ? 'Lädt …' : 'Anlegen'}
          </button>
        </div>
        <div className="hr" />
        <div className="scroll" style={{ padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {([{ k: 'topic', label: 'Thema', icon: 'hash' }, { k: 'company', label: 'Unternehmen', icon: 'building' }] as const).map((o) => {
              const on = type === o.k;
              return (
                <button key={o.k} className="press" onClick={() => setType(o.k)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', borderRadius: 13,
                  border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'), background: on ? 'var(--accent-soft)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}>
                  <Icon name={o.icon} size={18} /> {o.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 16px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--raise)' }}>
            <span style={{ color: 'var(--text-3)' }}><Icon name={type === 'topic' ? 'hash' : 'building'} size={20} /></span>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={type === 'topic' ? 'z. B. Embedded Finance' : 'z. B. N26'}
              style={{ flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 17, fontFamily: 'var(--font)' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {examples.map((e) => (
              <button key={e} className="press" onClick={() => setQuery(e)} style={{
                padding: '8px 14px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--accent)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
              }}>{type === 'topic' ? '#' : ''}{e}</button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '22px 0 10px' }}>Region</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(Object.entries(GEO_META) as [GeoFilter, { de: string; flag: string }][]).map(([k, g]) => {
              const on = geo === k;
              return (
                <button key={k} className="press" onClick={() => setGeo(k)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                  background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                }}>{g.flag} {g.de}</button>
              );
            })}
          </div>
          <div style={{ marginTop: 20, padding: 15, borderRadius: 13, background: 'var(--raise)', border: '1px solid var(--border)', display: 'flex', gap: 11, color: 'var(--text-2)', fontSize: 13.5, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}><Icon name="sparkle" size={16} /></span>
            Die KI sammelt aus Google News, LinkedIn, RSS &amp; Newsrooms, rankt jedes Signal (P1–P3) und fasst es zusammen.
          </div>
        </div>
      </div>
    </div>
  );
}
