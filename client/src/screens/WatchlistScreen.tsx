import { useState } from 'react';
import { Delta, Empty, Spinner, Tabs, TopBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { GEO_META } from '../lib/presenter';
import { useRunWatch, useWatchlist } from '../hooks/useWatchlist';
import { WatchItem } from '../types';

type Nav = (name: string, params?: Record<string, unknown>) => void;

function scheduleLabel(w: WatchItem): string {
  if (w.schedule_interval === 'manual') return 'Manuell';
  if (!w.schedule_interval) return 'Auto';
  return 'alle ' + w.schedule_interval;
}

export default function WatchlistScreen({ nav, onCompose, flash }: {
  nav: Nav; onCompose: () => void; flash: (m: string) => void;
}) {
  const [tab, setTab] = useState<'all' | 'topic' | 'company'>('all');
  const { data: watches, isLoading } = useWatchlist();
  const run = useRunWatch();

  let list = watches ?? [];
  if (tab === 'topic') list = list.filter((w) => w.type === 'topic');
  if (tab === 'company') list = list.filter((w) => w.type === 'company');

  const triggerRun = (id: string) => {
    run.mutate({ id });
    flash('Abruf gestartet …');
  };

  return (
    <>
      <TopBar sub={
        <Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[
          { key: 'all', label: 'Alle' }, { key: 'topic', label: 'Themen' }, { key: 'company', label: 'Unternehmen' },
        ]} />
      }>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 10px' }}>
          <span style={{ fontWeight: 900, fontSize: 21, letterSpacing: -0.4 }}>Beobachtungen</span>
          <button className="iconbtn" onClick={onCompose} style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="plus" size={22} /></button>
        </div>
      </TopBar>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>}
      {!isLoading && list.length === 0 && (
        <Empty icon="watchlist" title="Noch keine Beobachtungen" body="Lege ein Thema oder Unternehmen an, das du beobachten möchtest." />
      )}

      <div className="scroll" style={{ paddingBottom: 24 }}>
        {list.map((w) => {
          const color = w.color || '#1d9bf0';
          const geo = GEO_META[w.geo_filter];
          return (
            <div key={w.id} className="press" onClick={() => nav(w.type === 'company' ? 'competitor' : 'watch', { id: w.id })}
              style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: `color-mix(in srgb, ${color} 18%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={w.type === 'company' ? 'building' : 'hash'} size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontWeight: 800, fontSize: 15.5 }}>{w.display_name}</span>
                    {w.label && <span style={{ fontSize: 11, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '2px 7px', borderRadius: 999 }}>{w.label}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, color: 'var(--text-3)', fontSize: 12.5 }}>
                    <span>{geo.flag} {geo.de}</span>
                    <span>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="refresh" size={12} /> {scheduleLabel(w)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="tabular" style={{ fontWeight: 800, fontSize: 16 }}>{w.signals ?? 0}</div>
                  <Delta v={w.momentum ?? 0} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: w.is_active ? 'var(--pos)' : 'var(--text-3)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: w.is_active ? 'var(--pos)' : 'var(--text-3)' }} />
                    {w.is_active ? 'Aktiv' : 'Pausiert'}
                  </span>
                  {(w.unread ?? 0) > 0 && <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>{w.unread} neu</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {w.type === 'company' && (
                    <button className="press" onClick={(e) => { e.stopPropagation(); nav('competitor', { id: w.id }); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
                      <Icon name="swords" size={13} /> Wettbewerb
                    </button>
                  )}
                  <button className="press" onClick={(e) => { e.stopPropagation(); triggerRun(w.id); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--text)', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
                    <Icon name="play" size={12} /> Abrufen
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!isLoading && (
          <button className="press" onClick={onCompose} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, border: '1.5px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} /></div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Beobachtung hinzufügen</span>
          </button>
        )}
      </div>
    </>
  );
}
