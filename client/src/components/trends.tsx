import { ReactNode, useId, useState } from 'react';
import { Delta, Sparkline, Spinner } from './ui';
import { Icon } from './Icon';
import { useSuggestions, useToday, useTrends } from '../hooks/useAnalytics';
import { useCreateWatch } from '../hooks/useWatchlist';
import { TrendWatch, WatchType } from '../types';

type Nav = (name: string, params?: Record<string, unknown>) => void;

const PALETTE = ['#1d9bf0', '#7c5cff', '#00ba7c', '#f59e0b', '#f4212e', '#22d3ee'];
export const PERIODS: { d: number; label: string }[] = [
  { d: 7, label: '7 Tage' }, { d: 30, label: '30 Tage' }, { d: 90, label: '90 Tage' },
];

const seriesColor = (i: number, c: string | null) => c || PALETTE[i % PALETTE.length];

/** "vor X" freshness label from an ISO timestamp. */
export function relativeUpdated(iso: string | null | undefined): string {
  if (!iso) return 'noch nicht abgerufen';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 90) return 'gerade aktualisiert';
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} Min aktualisiert`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `vor ${hrs} Std aktualisiert`;
  const days = Math.floor(hrs / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'} aktualisiert`;
}

export function LastUpdated({ iso }: { iso: string | null | undefined }) {
  const fresh = !iso ? false : (Date.now() - new Date(iso).getTime()) < 90 * 60_000;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12.5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: fresh ? 'var(--pos)' : 'var(--text-3)' }} />
      {relativeUpdated(iso)}
    </span>
  );
}

export function PeriodSwitch({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--chip)', borderRadius: 999 }}>
      {PERIODS.map((p) => {
        const on = p.d === value;
        return (
          <button key={p.d} className="press" onClick={() => onChange(p.d)} style={{
            padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: on ? 'var(--bg)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-2)',
            fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font)',
          }}>{p.label}</button>
        );
      })}
    </div>
  );
}

export function SpikeBadge({ factor }: { factor: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
      background: 'color-mix(in srgb, var(--neg) 14%, transparent)', color: 'var(--neg)', fontWeight: 800, fontSize: 11.5,
    }}>
      <Icon name="flame" size={12} /> {factor >= 99 ? 'neu' : `${factor}×`}
    </span>
  );
}

// ─────────────────────────── Heute / Tagesüberblick ───────────────────────────
export function TodayBanner({ nav }: { nav: Nav }) {
  const { data, isLoading } = useToday();
  if (isLoading || !data) return null;
  const delta = data.today - data.yesterday;
  const trendUp = delta >= 0;
  return (
    <div style={{
      margin: '12px 14px 4px', padding: 16, borderRadius: 'var(--r-card)', border: '1px solid var(--border)',
      background: 'linear-gradient(120deg, color-mix(in srgb, var(--accent) 12%, var(--raise)), var(--raise))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="tabular" style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>{data.today}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>neue Signale heute</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
              {data.rank1_today > 0 ? `${data.rank1_today}× P1 · ` : ''}
              <span style={{ color: trendUp ? 'var(--pos)' : 'var(--neg)' }}>{trendUp ? '+' : ''}{delta}</span> ggü. gestern
            </div>
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="bolt" size={20} />
        </div>
      </div>
      {data.perWatch.length > 0 && (
        <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12 }}>
          {data.perWatch.slice(0, 8).map((w) => (
            <button key={w.watch_item_id} className="press"
              onClick={() => nav(w.type === 'company' ? 'competitor' : 'watch', { id: w.watch_item_id })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, flexShrink: 0,
                background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)',
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: w.color || 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{w.name}</span>
              <span className="tabular" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)' }}>+{w.today}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10 }}><LastUpdated iso={data.last_updated} /></div>
    </div>
  );
}

// ─────────────────────────── Trend list ("wird mehr/weniger besprochen") ───────────────────────────
function TrendRow({ w, rank, nav }: { w: TrendWatch; rank: number; nav: Nav }) {
  const color = w.color || '#1d9bf0';
  return (
    <button className="press" onClick={() => nav(w.type === 'company' ? 'competitor' : 'watch', { id: w.watch_item_id })}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '11px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <span style={{ width: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, fontWeight: 700 }}>{rank}</span>
      <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `color-mix(in srgb, ${color} 18%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={w.type === 'company' ? 'building' : 'hash'} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
          {w.spike && <SpikeBadge factor={w.spike_factor} />}
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{w.total} {w.total === 1 ? 'Signal' : 'Signale'}</div>
      </div>
      <Sparkline data={w.spark} w={64} h={26} color={w.momentum >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      <span style={{ width: 52, textAlign: 'right' }}><Delta v={w.momentum} /></span>
    </button>
  );
}

export function TrendList({ period, type, nav, limit = 8 }: {
  period: number; type?: WatchType | 'all'; nav: Nav; limit?: number;
}) {
  const { data, isLoading } = useTrends(period, type);
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>;
  const watches = (data?.watches ?? []).slice(0, limit);
  if (watches.length === 0) {
    return <div style={{ padding: '8px 16px 16px', color: 'var(--text-3)', fontSize: 13.5 }}>Noch keine Trenddaten — rufe deine Beobachtungen ab.</div>;
  }
  return <div>{watches.map((w, i) => <TrendRow key={w.watch_item_id} w={w} rank={i + 1} nav={nav} />)}</div>;
}

export function EmergingTags({ period, onPick }: { period: number; onPick?: (tag: string) => void }) {
  const { data } = useTrends(period);
  const tags = (data?.emergingTags ?? []).slice(0, 10);
  if (tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 16px 8px' }}>
      {tags.map((t) => (
        <button key={t.tag} className="press" onClick={() => onPick?.(t.tag)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999,
          border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13.5 }}>#{t.tag}</span>
          {t.momentum > 0 && <span style={{ color: 'var(--pos)', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="trending" size={12} />{t.momentum}%</span>}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────── Multi-series comparison chart ───────────────────────────
export function CompareChart({ period, type }: { period: number; type?: WatchType | 'all' }) {
  const { data, isLoading } = useTrends(period, type);
  const gid = useId().replace(/:/g, '');
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}><Spinner /></div>;
  const watches = (data?.watches ?? []).filter((w) => w.total > 0).slice(0, 5);
  if (watches.length === 0) {
    return <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '14px 0', textAlign: 'center' }}>Noch keine Daten für einen Vergleich.</div>;
  }
  const W = 320, H = 110, len = period;
  const allMax = Math.max(...watches.flatMap((w) => w.spark), 1);
  const xy = (vals: number[]) => vals.map((v, i) => [
    (i / (Math.max(vals.length, 2) - 1)) * W,
    H - (v / allMax) * (H - 8) - 4,
  ]);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        <line x1="0" y1={H - 4} x2={W} y2={H - 4} stroke="var(--border)" strokeWidth="1" />
        {watches.map((w, i) => {
          const pts = xy(w.spark.slice(-len));
          const line = pts.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
          return <path key={w.watch_item_id} d={line} fill="none" stroke={seriesColor(i, w.color)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        <defs><clipPath id={gid}><rect x="0" y="0" width={W} height={H} /></clipPath></defs>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {watches.map((w, i) => (
          <div key={w.watch_item_id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: seriesColor(i, w.color), flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
            {w.spike && <SpikeBadge factor={w.spike_factor} />}
            <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{w.total}</span>
            <span style={{ width: 50, textAlign: 'right' }}><Delta v={w.momentum} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── Data-driven suggestions ───────────────────────────
function SuggestCard({ name, type, onAdd, busy, added }: {
  name: string; type: WatchType; onAdd: () => void; busy: boolean; added: boolean;
}) {
  const isTopic = type === 'topic';
  const color = isTopic ? 'var(--accent)' : PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
  return (
    <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--raise)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, marginBottom: 10 }}>
        {isTopic ? '#' : name[0]?.toUpperCase()}
      </div>
      <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
      <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 11 }}>{isTopic ? 'Thema' : 'Unternehmen'}</div>
      <button className="pill pill-solid press" disabled={busy || added} onClick={onAdd}
        style={{ width: '100%', padding: '7px 0', fontSize: 13, opacity: added ? 0.6 : 1 }}>
        {added ? '✓ Beobachtet' : busy ? 'Lädt …' : 'Beobachten'}
      </button>
    </div>
  );
}

export function SuggestionsSection({ flash, title = 'Empfohlen zu beobachten', columns = 2 }: {
  flash?: (m: string) => void; title?: string; columns?: number;
}) {
  const { data } = useSuggestions();
  const create = useCreateWatch();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const companies = (data?.companies ?? []).map((c) => ({ ...c, type: 'company' as WatchType }));
  const topics = (data?.topics ?? []).map((t) => ({ ...t, type: 'topic' as WatchType }));
  const items = [...companies, ...topics].slice(0, 6);
  if (items.length === 0) return null;

  const add = async (name: string, type: WatchType) => {
    if (busy) return;
    setBusy(name);
    try {
      await create.mutateAsync({ type, query: name });
      setAdded((s) => new Set(s).add(name));
      flash?.('Beobachtung angelegt');
    } catch {
      flash?.('Anlegen fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div style={{ padding: '18px 16px 10px', fontWeight: 900, fontSize: 19, letterSpacing: -0.4 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12, padding: '0 16px 8px' }}>
        {items.map((it) => (
          <SuggestCard key={it.type + it.name} name={it.name} type={it.type}
            onAdd={() => add(it.name, it.type)} busy={busy === it.name} added={added.has(it.name)} />
        ))}
      </div>
    </div>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
      <span style={{ fontWeight: 900, fontSize: 19, letterSpacing: -0.4 }}>{title}</span>
      {right}
    </div>
  );
}
