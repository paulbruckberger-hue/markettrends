import { ReactNode, useState } from 'react';
import { Avatar, Delta, Sparkline } from '../components/ui';
import { Icon } from '../components/Icon';
import { SpikeBadge } from '../components/trends';
import { toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useCreateWatch, useWatchlist } from '../hooks/useWatchlist';
import { useOverview, useSuggestions, useTrends } from '../hooks/useAnalytics';
import { WatchType } from '../types';

type Nav = (name: string, params?: Record<string, unknown>) => void;

function RailSearch({ nav }: { nav: Nav }) {
  return (
    <button className="press" onClick={() => nav('explore')} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '12px 16px', borderRadius: 999,
      background: 'var(--chip)', border: '1px solid transparent', color: 'var(--text-3)', cursor: 'pointer',
      fontSize: 14.5, fontFamily: 'var(--font)', textAlign: 'left', marginBottom: 16,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--chip)'; }}>
      <Icon name="search" size={18} /> Signale durchsuchen
    </button>
  );
}

function RailBox({ title, children, footer, onFooter }: { title?: string; children: ReactNode; footer?: string; onFooter?: () => void }) {
  return (
    <div style={{ background: 'var(--raise)', borderRadius: 16, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)' }}>
      {title && <div style={{ padding: '14px 16px 8px', fontSize: 19, fontWeight: 900, letterSpacing: -0.4 }}>{title}</div>}
      {children}
      {footer && (
        <button className="press" onClick={onFooter} style={{ width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{footer}</button>
      )}
    </div>
  );
}

function TrendsBox({ nav }: { nav: Nav }) {
  const { data } = useTrends(30);
  const trends = (data?.watches ?? []).slice(0, 5);
  if (trends.length === 0) return null;
  return (
    <RailBox title="Trends für dich" footer="Mehr anzeigen" onFooter={() => nav('explore')}>
      {trends.map((w, i) => (
        <div key={w.watch_item_id} className="press"
          onClick={() => nav(w.type === 'company' ? 'competitor' : 'watch', { id: w.watch_item_id })}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <span style={{ width: 14, textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
              {w.spike && <SpikeBadge factor={w.spike_factor} />}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{w.total} Signale</div>
          </div>
          <Sparkline data={w.spark} w={48} h={22} color={w.momentum >= 0 ? 'var(--pos)' : 'var(--neg)'} />
          <Delta v={w.momentum} />
        </div>
      ))}
    </RailBox>
  );
}

function SuggestBox({ onCompose, flash }: { onCompose: () => void; flash?: (m: string) => void }) {
  const { data } = useSuggestions();
  const create = useCreateWatch();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const items = [
    ...(data?.companies ?? []).map((c) => ({ ...c, type: 'company' as WatchType })),
    ...(data?.topics ?? []).map((t) => ({ ...t, type: 'topic' as WatchType })),
  ].slice(0, 4);
  if (items.length === 0) return null;

  const add = async (name: string, type: WatchType) => {
    if (busy) return;
    setBusy(name);
    try {
      await create.mutateAsync({ type, query: name });
      setAdded((s) => new Set(s).add(name));
      flash?.('Beobachtung angelegt');
    } catch { flash?.('Anlegen fehlgeschlagen'); } finally { setBusy(null); }
  };

  return (
    <RailBox title="Empfohlen zu beobachten" footer="Eigene anlegen" onFooter={onCompose}>
      {items.map((s) => (
        <div key={s.type + s.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: s.type === 'topic' ? 'var(--accent)' : '#7c5cff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>{s.type === 'topic' ? '#' : s.name[0]?.toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{s.type === 'topic' ? 'Thema' : 'Unternehmen'}</div>
          </div>
          <button className="pill pill-solid press" disabled={busy === s.name || added.has(s.name)} onClick={() => add(s.name, s.type)}
            style={{ padding: '7px 15px', fontSize: 13, opacity: added.has(s.name) ? 0.6 : 1 }}>
            {added.has(s.name) ? '✓' : busy === s.name ? '…' : 'Beobachten'}
          </button>
        </div>
      ))}
    </RailBox>
  );
}

function MiniStat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
      <div className="tabular" style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.5, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function PortfolioBox({ nav }: { nav: Nav }) {
  const { data: o } = useOverview();
  const { data: watches } = useWatchlist();
  if (!o) return null;
  const movers = (watches ?? []).slice().sort((a, b) => (b.momentum ?? 0) - (a.momentum ?? 0)).slice(0, 4);
  return (
    <>
      <RailBox title="Portfolio">
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MiniStat label="Signale" value={o.total} />
          <MiniStat label="Aktiv" value={o.watchCount} color="var(--pos)" />
          <MiniStat label="Gelesen" value={o.read} />
          <MiniStat label="Gespeichert" value={o.bookmarked} color="var(--accent)" />
        </div>
      </RailBox>
      {movers.length > 0 && (
        <RailBox title="Top-Bewegungen" footer="Zur Analyse" onFooter={() => nav('analytics')}>
          {movers.map((w) => (
            <div key={w.id} className="press" onClick={() => nav(w.type === 'company' ? 'competitor' : 'watch', { id: w.id })} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: `color-mix(in srgb, ${w.color || '#1d9bf0'} 18%, transparent)`, color: w.color || '#1d9bf0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={w.type === 'company' ? 'building' : 'hash'} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.display_name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{w.signals ?? 0} Signale</div>
              </div>
              <Delta v={w.momentum ?? 0} />
            </div>
          ))}
        </RailBox>
      )}
    </>
  );
}

function RelatedBox({ watchId, currentId, nav }: { watchId: string; currentId: string | null; nav: Nav }) {
  const { data: watches } = useWatchlist();
  const { data } = useFeed({ watch_item_id: watchId });
  const w = (watches ?? []).find((x) => x.id === watchId);
  const related = flattenFeed(data).map(toDisplayItem).filter((x) => x.id !== currentId).slice(0, 4);
  if (!w || related.length === 0) return null;
  return (
    <RailBox title={'Mehr zu ' + w.display_name}>
      {related.map((r) => (
        <div key={r.id} className="press" onClick={() => nav('detail', { item: r })} style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <Avatar source={r.source} size={22} />
            <span style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.source.name} · {r.time}</span>
          </div>
          <div className="clamp2" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{r.title}</div>
        </div>
      ))}
    </RailBox>
  );
}

function CompetitorRailBox({ nav }: { nav: Nav }) {
  const { data: watches } = useWatchlist();
  const company = (watches ?? []).find((w) => w.type === 'company');
  if (!company) return null;
  return (
    <button className="press" onClick={() => nav('competitor', { id: company.id })} style={{
      textAlign: 'left', display: 'block', width: '100%', padding: 16, borderRadius: 16, marginBottom: 16,
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--raise)), var(--raise))',
      border: '1px solid var(--border)', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="swords" size={20} /></div>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.3 }}>Wettbewerbsanalyse</div>
      </div>
      <div style={{ color: 'var(--text-2)', fontSize: 13.5, lineHeight: 1.5 }}>Deep-Dive zu Share of Voice, Momentum &amp; Bewegungen von {company.display_name} &amp; Co.</div>
    </button>
  );
}

function RailFooter() {
  return (
    <div style={{ padding: '4px 16px', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.7 }}>
      <span style={{ marginRight: 12 }}>KI-Klassifizierung</span>
      <span style={{ marginRight: 12 }}>Quellen</span>
      <span style={{ marginRight: 12 }}>Datenschutz</span>
      <div style={{ marginTop: 4 }}>Nicheletter.ai · v2.0 — Desktop</div>
    </div>
  );
}

export function RightRail({ route, params, nav, onCompose }: {
  route: string; params: Record<string, unknown>; nav: Nav; onCompose: () => void;
}) {
  const item = params.item as { watch?: string; watchId?: string; id?: string } | undefined;
  const wrap = (children: ReactNode) => <div style={{ animation: 'fadeIn .2s' }}>{children}</div>;

  if (route === 'watchlist') {
    return wrap(<><RailSearch nav={nav} /><PortfolioBox nav={nav} /><SuggestBox onCompose={onCompose} /><RailFooter /></>);
  }
  if (route === 'analytics' || route === 'competitor') {
    return wrap(<><RailSearch nav={nav} /><PortfolioBox nav={nav} /><TrendsBox nav={nav} /><RailFooter /></>);
  }
  if (route === 'detail' && item) {
    return wrap(<><RailSearch nav={nav} /><RelatedBox watchId={item.watchId ?? ''} currentId={item.id ?? null} nav={nav} /><CompetitorRailBox nav={nav} /><RailFooter /></>);
  }
  if (route === 'watch') {
    return wrap(<><RailSearch nav={nav} /><RelatedBox watchId={(params.id as string) ?? ''} currentId={null} nav={nav} /><TrendsBox nav={nav} /><RailFooter /></>);
  }
  // feed / explore / profile / settings / admin
  return wrap(<><RailSearch nav={nav} /><CompetitorRailBox nav={nav} /><TrendsBox nav={nav} /><SuggestBox onCompose={onCompose} /><RailFooter /></>);
}
