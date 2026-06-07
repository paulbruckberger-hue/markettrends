import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useCreateWatch } from '../hooks/useWatchlist';
import { GeoFilter, WatchType } from '../types';
import { GEO_META } from '../lib/presenter';

export default function ComposeSheet({ onClose, flash }: { onClose: () => void; flash: (m: string) => void }) {
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'flex', flexDirection: 'column' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'fadeIn .2s' }} />
      <div style={{ marginTop: 'auto', position: 'relative', background: 'var(--bg)', borderTopLeftRadius: 22, borderTopRightRadius: 22, animation: 'sheetUp .3s cubic-bezier(.22,.61,.36,1)', maxHeight: '88%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={22} /></button>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Neue Beobachtung</span>
          <button className="pill pill-accent press" disabled={!query.trim() || create.isPending} onClick={submit}
            style={{ padding: '8px 18px', fontSize: 14, opacity: query.trim() && !create.isPending ? 1 : 0.5 }}>
            {create.isPending ? 'Lädt …' : 'Anlegen'}
          </button>
        </div>
        <div className="hr" />

        <div className="scroll" style={{ padding: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {([{ k: 'topic', label: 'Thema', icon: 'hash' }, { k: 'company', label: 'Unternehmen', icon: 'building' }] as const).map((o) => {
              const on = type === o.k;
              return (
                <button key={o.k} className="press" onClick={() => setType(o.k)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 12,
                  border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'), background: on ? 'var(--accent-soft)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer',
                }}>
                  <Icon name={o.icon} size={18} /> {o.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--raise)' }}>
            <span style={{ color: 'var(--text-3)' }}><Icon name={type === 'topic' ? 'hash' : 'building'} size={20} /></span>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={type === 'topic' ? 'z. B. Embedded Finance' : 'z. B. N26'}
              style={{ flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 17, fontFamily: 'var(--font)' }} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {examples.map((e) => (
              <button key={e} className="press" onClick={() => setQuery(e)} style={{
                padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--accent)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
              }}>{type === 'topic' ? '#' : ''}{e}</button>
            ))}
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '20px 0 10px' }}>Region</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.entries(GEO_META) as [GeoFilter, { de: string; flag: string }][]).map(([k, g]) => {
              const on = geo === k;
              return (
                <button key={k} className="press" onClick={() => setGeo(k)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 11, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                  background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                }}>{g.flag} {g.de}</button>
              );
            })}
          </div>

          <div style={{ marginTop: 18, padding: 13, borderRadius: 12, background: 'var(--raise)', border: '1px solid var(--border)', display: 'flex', gap: 10, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}><Icon name="sparkle" size={16} /></span>
            Die KI sammelt aus Google News, LinkedIn, RSS & Newsrooms, rankt jedes Signal (P1–P3) und fasst es zusammen.
          </div>
        </div>
      </div>
    </div>
  );
}
