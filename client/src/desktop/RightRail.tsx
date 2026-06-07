import { ReactNode } from 'react';
import { Avatar, Delta } from '../components/ui';
import { Icon } from '../components/Icon';
import { toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useWatchlist } from '../hooks/useWatchlist';
import { useOverview } from '../hooks/useAnalytics';

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
  const feed = useFeed({ sort: 'top' });
  const items = flattenFeed(feed.data).map(toDisplayItem);
  const tagCount = new Map<string, number>();
  for (const it of items) for (const t of it.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const trends = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (trends.length === 0) return null;
  return (
    <RailBox title="Trends für dich" footer="Mehr anzeigen" onFooter={() => nav('explore')}>
      {trends.map(([tag, n], i) => (
        <div key={tag} className="press" onClick={() => nav('explore')} style={{ padding: '9px 16px', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12.5 }}>
            <span>{i + 1} · Thema</span><span style={{ color: 'var(--pos)', display: 'inline-flex' }}><Icon name="trending" size={13} /></span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 2 }}>#{tag}</div>
          <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{n} {n === 1 ? 'Signal' : 'Signale'}</div>
        </div>
      ))}
    </RailBox>
  );
}

function SuggestBox({ onCompose }: { onCompose: () => void }) {
  const SUGG = [
    { n: 'Klarna', t: 'company', c: '#ffb3c7' }, { n: 'Stablecoins', t: 'topic', c: '#1d9bf0' }, { n: 'Revolut', t: 'company', c: '#7c5cff' },
  ];
  return (
    <RailBox title="Empfohlen zu beobachten" footer="Mehr anzeigen" onFooter={onCompose}>
      {SUGG.map((s) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>{s.t === 'topic' ? '#' : s.n[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>{s.n}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{s.t === 'topic' ? 'Thema' : 'Unternehmen'}</div>
          </div>
          <button className="pill pill-solid press" onClick={onCompose} style={{ padding: '7px 15px', fontSize: 13 }}>Beobachten</button>
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
