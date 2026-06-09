import { useEffect, useState } from 'react';
import {
  ActBtn, Avatar, BarRow, BarsMini, Delta, Donut, Empty, FeedCard, FilterChip,
  ItemActions, Metric, Panel, RankBadge, SectionLabel, SentimentDot, SignalBadge,
  Sparkline, Spinner, StatCard, Tabs, UserCircle, Verified,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { Chevron } from '../components/ui';
import { RunbackButton } from '../components/RunbackButton';
import {
  CompareChart, EmergingTags, LastUpdated, PeriodSwitch, SectionHead, SuggestionsSection, TodayBanner, TrendList,
} from '../components/trends';
import {
  DisplayItem, GEO_META, RANK_META, SIGNAL_META, SRC_KIND_LABEL, toDisplayItem,
} from '../lib/presenter';
import { SOURCE_LABELS } from '../lib/labels';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useDeleteWatch, useRunWatch, useWatchlist } from '../hooks/useWatchlist';
import { useOverview, useWatchAnalytics } from '../hooks/useAnalytics';
import { useCompetitor } from '../hooks/useCompetitor';
import { useSettings } from '../hooks/useSettings';
import { ACCENTS, Theme } from '../lib/theme';
import { AuthUser, SignalType, SourceTypeName, WatchItem } from '../types';
import { DeskHeader, ViewSwitch } from './deskChrome';
import AdminSections from '../components/AdminSections';

type Nav = (name: string, params?: Record<string, unknown>) => void;
const PALETTE = ['#1d9bf0', '#7c5cff', '#00ba7c', '#f59e0b', '#f4212e', '#22d3ee'];

// ════════════════════════════════════════ FEED ════════════════════════════════════════
export function DeskFeed({ actions, variant, setVariant, nav }: {
  actions: ItemActions; variant: string; setVariant: (v: string) => void; nav: Nav;
}) {
  const [tab, setTab] = useState<'top' | 'latest' | 'bookmarks'>('top');
  const [watchFilter, setWatchFilter] = useState('');
  const { data: watches } = useWatchlist();
  const feed = useFeed({
    sort: tab === 'latest' ? 'latest' : 'top',
    bookmarked: tab === 'bookmarks' ? true : undefined,
    watch_item_id: watchFilter || undefined,
  });
  const bmFeed = useFeed({ bookmarked: true });
  const items = flattenFeed(feed.data).map(toDisplayItem);
  const bm = flattenFeed(bmFeed.data).length;

  return (
    <>
      <DeskHeader title="Startseite" right={<ViewSwitch variant={variant} setVariant={setVariant} />}
        sub={<>
          <Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[
            { key: 'top', label: 'Top' }, { key: 'latest', label: 'Neueste' }, { key: 'bookmarks', label: 'Gespeichert', count: bm },
          ]} />
          <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '11px 18px' }}>
            <FilterChip active={!watchFilter} onClick={() => setWatchFilter('')} label="Alle" />
            {(watches ?? []).filter((w) => w.is_active).map((w) => (
              <FilterChip key={w.id} active={watchFilter === w.id} onClick={() => setWatchFilter(w.id)} label={w.display_name} dot={w.color || '#1d9bf0'} />
            ))}
          </div>
        </>} />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        {feed.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>}
        {!feed.isLoading && items.length === 0 && (
          <Empty icon={tab === 'bookmarks' ? 'bookmark' : 'home'}
            title={tab === 'bookmarks' ? 'Noch nichts gespeichert' : 'Keine Signale'}
            body={tab === 'bookmarks' ? 'Speichere Signale über das Lesezeichen, um sie hier zu sammeln.' : 'Lege eine Beobachtung an oder rufe sie ab, damit dein Feed sich füllt.'} />
        )}
        {items.map((it) => (
          <FeedCard key={it.id} item={it} variant={variant} on={actions} onOpen={(x) => nav('detail', { item: x })} />
        ))}
        {feed.hasNextPage && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <button className="pill pill-ghost press" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()} style={{ padding: '10px 20px', fontSize: 14 }}>
              {feed.isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
            </button>
          </div>
        )}
        <div style={{ height: 32 }} />
      </div>
    </>
  );
}

// ════════════════════════════════════════ EXPLORE ════════════════════════════════════════
export function DeskExplore({ actions, nav, onCompose, flash }: { actions: ItemActions; nav: Nav; onCompose: () => void; flash: (m: string) => void }) {
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState(30);
  const feed = useFeed(q ? { search: q, sort: 'latest' } : { sort: 'top' });
  const items = flattenFeed(feed.data).map(toDisplayItem);

  return (
    <>
      <DeskHeader title="Entdecken" sub={
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderRadius: 999, background: 'var(--chip)' }}>
            <span style={{ color: 'var(--text-3)' }}><Icon name="search" size={19} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Signale, Themen, Quellen durchsuchen"
              style={{ flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 15.5, fontFamily: 'var(--font)' }} />
            {q && <button className="press" onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}><Icon name="close" size={18} /></button>}
          </div>
        </div>
      } />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        {feed.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>}
        {!feed.isLoading && q ? (
          items.length
            ? items.map((it) => <FeedCard key={it.id} item={it} variant="standard" on={actions} onOpen={(x) => nav('detail', { item: x })} />)
            : <Empty icon="search" title="Keine Treffer" body={`Für „${q}" wurden keine Signale gefunden.`} />
        ) : !feed.isLoading && (
          <>
            <TodayBanner nav={nav} />
            <SectionHead title="Trends für dich" right={<PeriodSwitch value={period} onChange={setPeriod} />} />
            <div style={{ padding: '0 18px 6px', color: 'var(--text-3)', fontSize: 13 }}>
              Worüber wird mehr oder weniger gesprochen — Momentum ggü. Vorperiode.
            </div>
            <TrendList period={period} nav={nav} limit={10} />
            <SectionHead title="Aufkommende Schlagworte" />
            <EmergingTags period={period} onPick={setQ} />
            <div style={{ padding: '16px 18px 4px', fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>Themen im Vergleich</div>
            <div style={{ margin: '0 18px', padding: 16, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid var(--border)' }}>
              <CompareChart period={period} />
            </div>
            <SuggestionsSection flash={flash} />
            <div style={{ padding: '4px 18px 0' }}>
              <button className="pill pill-ghost press" onClick={onCompose} style={{ width: '100%', padding: '11px 0', fontSize: 14 }}>
                + Eigene Beobachtung anlegen
              </button>
            </div>
            <div style={{ height: 24 }} />
          </>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════ WATCHLIST ════════════════════════════════════════
function scheduleLabel(w: WatchItem): string {
  if (w.schedule_interval === 'manual') return 'Manuell';
  if (!w.schedule_interval) return 'Auto';
  return 'alle ' + w.schedule_interval;
}

function WatchCard({ w, nav, onRun, onDelete }: { w: WatchItem; nav: Nav; onRun: (id: string) => void; onDelete: (w: WatchItem) => void }) {
  const color = w.color || '#1d9bf0';
  const geo = GEO_META[w.geo_filter];
  return (
    <div className="press" onClick={() => nav(w.type === 'company' ? 'competitor' : 'watch', { id: w.id })} style={{
      padding: 16, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--raise)', cursor: 'pointer',
    }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: `color-mix(in srgb, ${color} 18%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={w.type === 'company' ? 'building' : 'hash'} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.display_name}</span>
            {w.label && <span style={{ fontSize: 11, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '2px 7px', borderRadius: 999 }}>{w.label}</span>}
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 2 }}>{geo.flag} {geo.de} · {scheduleLabel(w)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
        <div>
          <div className="tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{w.signals ?? 0}</div>
          <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Signale</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Delta v={w.momentum ?? 0} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: w.is_active ? 'var(--pos)' : 'var(--text-3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: w.is_active ? 'var(--pos)' : 'var(--text-3)' }} />
              {w.is_active ? 'Aktiv' : 'Pausiert'}
            </span>
            <button className="press" onClick={(e) => { e.stopPropagation(); onRun(w.id); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text)', padding: '4px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
              <Icon name="play" size={11} /> Abrufen
            </button>
            <button className="press" title="Löschen" onClick={(e) => { e.stopPropagation(); onDelete(w); }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--neg)', cursor: 'pointer' }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeskWatchlist({ nav, onCompose, flash }: { nav: Nav; onCompose: () => void; flash: (m: string) => void }) {
  const [tab, setTab] = useState<'all' | 'topic' | 'company'>('all');
  const { data: watches, isLoading } = useWatchlist();
  const run = useRunWatch();
  const del = useDeleteWatch();
  let list = watches ?? [];
  if (tab === 'topic') list = list.filter((w) => w.type === 'topic');
  if (tab === 'company') list = list.filter((w) => w.type === 'company');

  const onRun = (id: string) => { run.mutate({ id }); flash('Abruf gestartet …'); };
  const onDelete = (w: WatchItem) => {
    if (!window.confirm(`Beobachtung „${w.display_name}" löschen? Deine Signale dazu verschwinden aus dem Feed.`)) return;
    del.mutate(w.id, { onSuccess: () => flash('Beobachtung gelöscht') });
  };

  return (
    <>
      <DeskHeader title="Beobachtungen"
        right={<button className="pill pill-accent press" onClick={onCompose} style={{ padding: '9px 16px', fontSize: 14 }}><Icon name="plus" size={18} /> Neu</button>}
        sub={<Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[{ key: 'all', label: 'Alle' }, { key: 'topic', label: 'Themen' }, { key: 'company', label: 'Unternehmen' }]} />} />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>}
        {!isLoading && list.length === 0 && (
          <Empty icon="watchlist" title="Noch keine Beobachtungen" body="Lege ein Thema oder Unternehmen an, das du beobachten möchtest." />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: 14, padding: 18 }}>
          {list.map((w) => <WatchCard key={w.id} w={w} nav={nav} onRun={onRun} onDelete={onDelete} />)}
          {!isLoading && (
            <button className="press" onClick={onCompose} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 150,
              border: '1.5px dashed var(--border-strong)', borderRadius: 16, background: 'transparent', cursor: 'pointer', color: 'var(--accent)',
            }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, border: '1.5px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={24} /></div>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>Beobachtung hinzufügen</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════ ANALYTICS ════════════════════════════════════════
export function DeskAnalytics({ nav }: { nav: Nav }) {
  const [scope, setScope] = useState('all');
  const [period, setPeriod] = useState(30);
  const { data: overview, isLoading } = useOverview(period);
  const { data: watches } = useWatchlist();
  const { data: wa } = useWatchAnalytics(scope === 'all' ? null : scope, period);
  const firstCompany = (watches ?? []).find((w) => w.type === 'company');

  if (isLoading || !overview) {
    return (<><DeskHeader title="Analyse" /><div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div></>);
  }

  const isWatch = scope !== 'all';
  const volume = (isWatch ? wa?.volume : overview.volume) ?? [];
  const volData = volume.map((v) => v.n);
  const volSum = volData.reduce((a, b) => a + b, 0);
  const sentiment = isWatch ? (wa?.sentiment ?? { positive: 0, neutral: 0, negative: 0 }) : overview.bySentiment;
  const sentTotal = (sentiment.positive ?? 0) + (sentiment.neutral ?? 0) + (sentiment.negative ?? 0) || 1;
  const rankSegs = [
    { value: overview.byRank['1'] ?? 0, color: 'var(--rank1)' },
    { value: overview.byRank['2'] ?? 0, color: 'var(--rank2)' },
    { value: overview.byRank['3'] ?? 0, color: 'var(--rank3)' },
  ];
  const sources = isWatch
    ? (wa?.topSources ?? []).map((s) => ({ label: s.source, n: s.n }))
    : overview.bySource.map((s) => ({ label: SOURCE_LABELS[s.source_type as SourceTypeName] ?? s.source_type, n: s.n }));
  const maxSrc = Math.max(...sources.map((s) => s.n), 1);
  const signalMix = (wa?.signalTypes ?? []).map((s) => ({
    label: SIGNAL_META[s.signal_type as SignalType]?.de ?? s.signal_type,
    color: SIGNAL_META[s.signal_type as SignalType]?.color ?? '#8b98a5', n: s.n,
  }));
  const maxSig = Math.max(...signalMix.map((s) => s.n), 1);

  return (
    <>
      <DeskHeader title="Analyse" right={<PeriodSwitch value={period} onChange={setPeriod} />}
        sub={<>
          <div style={{ padding: '2px 18px 10px' }}><LastUpdated iso={overview.last_updated} /></div>
          <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 18px 12px' }}>
            <FilterChip active={scope === 'all'} onClick={() => setScope('all')} label="Alle Beobachtungen" />
            {(watches ?? []).filter((w) => w.is_active).map((w) => (
              <FilterChip key={w.id} active={scope === w.id} onClick={() => setScope(w.id)} label={w.display_name} dot={w.color || '#1d9bf0'} />
            ))}
          </div>
        </>} />
      <div className="dt-scroll scroll" style={{ flex: 1, padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {isWatch ? <>
            <StatCard icon="bolt" label={`Signale (${period} T.)`} value={volSum} color="var(--accent)" />
            <StatCard icon="search" label="Quellen" value={sources.length} color="var(--pos)" />
            <StatCard icon="check" label="Positiv" value={sentiment.positive ?? 0} color="var(--pos)" />
            <StatCard icon="hash" label="Tags" value={wa?.coTags.length ?? 0} color="var(--accent)" />
          </> : <>
            <StatCard icon="bolt" label="Signale gesamt" value={overview.total} color="var(--accent)" />
            <StatCard icon="eye" label="Aktive Beobachtungen" value={overview.watchCount} color="var(--pos)" />
            <StatCard icon="check" label="Gelesen" value={overview.read} color="var(--text-2)" />
            <StatCard icon="bookmark" label="Gespeichert" value={overview.bookmarked} color="var(--accent)" />
          </>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <Panel title="Signalvolumen" action={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{period} Tage</span>}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span className="tabular" style={{ fontSize: 30, fontWeight: 800 }}>{volSum}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Signale im Zeitraum</span>
            </div>
            {volData.length ? <BarsMini data={volData} h={120} color="var(--accent)" />
              : <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Noch keine Daten</div>}
          </Panel>
        </div>

        {!isWatch && (
          <div style={{ marginBottom: 12 }}>
            <Panel title="Beobachtungen im Vergleich" action={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{period} Tage</span>}>
              <CompareChart period={period} />
            </Panel>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {isWatch ? (
            <Panel title="Signal-Mix">
              {signalMix.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {signalMix.map((s) => <BarRow key={s.label} label={s.label} value={s.n} max={maxSig} color={s.color} />)}
                </div>
              ) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Keine Signal-Typen (nur bei Unternehmen).</div>}
            </Panel>
          ) : (
            <Panel title="Verteilung nach Priorität">
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <Donut segments={rankSegs} size={120} thickness={20} center={
                  <><span className="tabular" style={{ fontSize: 22, fontWeight: 800 }}>{overview.total}</span><span style={{ fontSize: 11, color: 'var(--text-3)' }}>Signale</span></>
                } />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map((r) => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 3, background: RANK_META[r].color }} />
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{RANK_META[r].tag} · {RANK_META[r].de}</span>
                      <span className="tabular" style={{ fontWeight: 800, fontSize: 14 }}>{overview.byRank[String(r)] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
          <Panel title="Marktstimmung">
            <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ width: `${(sentiment.positive ?? 0) / sentTotal * 100}%`, background: 'var(--pos)' }} />
              <div style={{ width: `${(sentiment.neutral ?? 0) / sentTotal * 100}%`, background: 'var(--neu)' }} />
              <div style={{ width: `${(sentiment.negative ?? 0) / sentTotal * 100}%`, background: 'var(--neg)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {([['Positiv', sentiment.positive ?? 0, 'var(--pos)'], ['Neutral', sentiment.neutral ?? 0, 'var(--neu)'], ['Negativ', sentiment.negative ?? 0, 'var(--neg)']] as const).map(([l, n, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-2)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</div>
                  <div className="tabular" style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>{n}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Panel title="Top-Quellen">
            {sources.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {sources.map((s) => <BarRow key={s.label} label={s.label} value={s.n} max={maxSrc} />)}
              </div>
            ) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Noch keine Quellen.</div>}
          </Panel>
        </div>

        {firstCompany && (
          <button className="press" onClick={() => nav('competitor', { id: firstCompany.id })} style={{
            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 'var(--r-card)', width: '100%',
            background: 'linear-gradient(120deg, color-mix(in srgb, var(--accent) 14%, var(--raise)), var(--raise))', border: '1px solid var(--border)', cursor: 'pointer',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="swords" size={24} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Wettbewerbsanalyse</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13.5, marginTop: 1 }}>Deep-Dive zu {firstCompany.display_name} &amp; Co.</div>
            </div>
            <Icon name="chevron" size={20} style={{ color: 'var(--text-3)' }} />
          </button>
        )}
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}

// ════════════════════════════════════════ DETAIL ════════════════════════════════════════
export function DeskDetail({ item, actions, nav, back }: { item: DisplayItem; actions: ItemActions; nav: Nav; back: () => void }) {
  const src = item.source;
  const rc = RANK_META[item.rank]?.color ?? 'var(--rank3)';
  const [st, setSt] = useState({ read: item.read, bookmarked: item.bookmarked, feedback: item.feedback });

  useEffect(() => {
    if (!item.read) { actions.read(item, true); setSt((s) => ({ ...s, read: true })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFeedback = (dir: 'up' | 'down') => {
    const next = st.feedback === dir ? null : dir;
    actions.feedback({ ...item, feedback: st.feedback }, dir);
    setSt((s) => ({ ...s, feedback: next }));
  };
  const onBookmark = () => { actions.bookmark({ ...item, bookmarked: st.bookmarked }); setSt((s) => ({ ...s, bookmarked: !s.bookmarked })); };

  return (
    <>
      <DeskHeader title="Signal" onBack={back} />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        <div style={{ padding: '16px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar source={src} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontWeight: 800, fontSize: 16.5 }}>{src.name}</span>{src.verified && <Verified size={16} />}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 14 }}>@{src.handle} · {SRC_KIND_LABEL[src.kind]}</div>
            </div>
            <button className="iconbtn" onClick={() => actions.more(item)}><Icon name="more" size={18} style={{ color: 'var(--text-3)' }} /></button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 14px' }}>
            <RankBadge rank={item.rank} /><SignalBadge signal={item.signal} /><SentimentDot sentiment={item.sentiment} />
          </div>

          <div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.5 }}>{item.title}</div>

          <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {item.summary.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 11, fontSize: 16.5, color: 'var(--text)', lineHeight: 1.5 }}>
                <span style={{ color: rc, fontWeight: 800, flexShrink: 0 }}>•</span><span>{b}</span>
              </li>
            ))}
          </ul>

          {item.reason && (
            <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: `color-mix(in srgb, ${rc} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${rc} 25%, transparent)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <span style={{ color: rc }}><Icon name="sparkle" size={15} /></span>
                <span style={{ fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4, color: rc }}>Warum es zählt · KI-Einordnung</span>
              </div>
              <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.55 }}>{item.reason}</div>
            </div>
          )}

          {item.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {item.tags.map((t) => <span key={t} style={{ color: 'var(--accent)', fontSize: 15, fontWeight: 500 }}>#{t}</span>)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, color: 'var(--text-3)', fontSize: 14, flexWrap: 'wrap' }}>
            <Icon name="clock" size={14} /> {item.date}
            <span>·</span><span>Quelle: {src.name}</span>
            <span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: item.watchColor }} />{item.watchName}</span>
          </div>

          {item.engagement && (
            <div style={{ marginTop: 16, padding: '14px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 26 }}>
              <Metric n={item.engagement.likes} label="Reaktionen" />
              <Metric n={item.engagement.comments} label="Kommentare" />
              <Metric n={item.engagement.shares} label="Geteilt" />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '12px 22px', borderBottom: '1px solid var(--border)', margin: '8px 0 0' }}>
          <ActBtn name="thumbUp" filled={st.feedback === 'up'} active={st.feedback === 'up'} color="var(--pos)" tint="color-mix(in srgb, var(--pos) 16%, transparent)" label="Relevant" onClick={() => onFeedback('up')} />
          <ActBtn name="thumbDown" filled={st.feedback === 'down'} active={st.feedback === 'down'} color="var(--neg)" tint="color-mix(in srgb, var(--neg) 16%, transparent)" onClick={() => onFeedback('down')} />
          <ActBtn name="bookmark" filled={st.bookmarked} active={st.bookmarked} onClick={onBookmark} />
          <ActBtn name="share" onClick={() => actions.share(item)} />
          <div style={{ flex: 1 }} />
          <ActBtn name={st.read ? 'eye' : 'eyeOff'} active={st.read} color="var(--text-2)" tint="var(--hover)" onClick={() => { actions.read(item); setSt((s) => ({ ...s, read: !s.read })); }} />
        </div>

        <div style={{ padding: '14px 22px', color: 'var(--text-3)', fontSize: 13, display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icon name="sparkle" size={13} />
          {st.feedback === 'up' ? 'Danke — die KI priorisiert ähnliche Signale höher.' : st.feedback === 'down' ? 'Verstanden — ähnliche Signale werden seltener gezeigt.' : 'Gib Feedback, damit die KI deine Relevanz besser lernt.'}
        </div>

        <div style={{ padding: '4px 22px 22px' }}>
          <button className="pill pill-accent press" onClick={() => actions.open(item)} style={{ width: '100%', padding: '14px 0', fontSize: 15 }}>
            <Icon name="external" size={17} /> Quelle öffnen · {item.url}
          </button>
        </div>
        <DeskRelated watchId={item.watchId} currentId={item.id} watchName={item.watchName} actions={actions} nav={nav} />
      </div>
    </>
  );
}

function DeskRelated({ watchId, currentId, watchName, actions, nav }: {
  watchId: string; currentId: string; watchName: string; actions: ItemActions; nav: Nav;
}) {
  const { data } = useFeed({ watch_item_id: watchId });
  const related = flattenFeed(data).map(toDisplayItem).filter((x) => x.id !== currentId).slice(0, 3);
  if (related.length === 0) return null;
  return (
    <div style={{ marginTop: 4, paddingBottom: 24 }}>
      <div style={{ padding: '10px 22px 4px', fontWeight: 800, fontSize: 16 }}>Mehr zu {watchName}</div>
      {related.map((r) => <FeedCard key={r.id} item={r} variant="kompakt" on={actions} onOpen={(x) => nav('detail', { item: x })} />)}
    </div>
  );
}

// ════════════════════════════════════════ COMPETITOR ════════════════════════════════════════
export function DeskCompetitor({ id, actions, nav, back, onCompose }: {
  id: string; actions: ItemActions; nav: Nav; back: () => void; onCompose: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'rivals' | 'moves'>('overview');
  const { data: d, isLoading } = useCompetitor(id);
  const { data: feedData } = useFeed({ watch_item_id: id });
  const del = useDeleteWatch();
  const onDelete = () => {
    if (!window.confirm(`Beobachtung „${d?.subject ?? ''}" löschen?`)) return;
    del.mutate(id, { onSuccess: back });
  };

  if (isLoading) return (<><DeskHeader title="Wettbewerb" onBack={back} /><div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div></>);
  if (!d) return (<><DeskHeader title="Unternehmen" onBack={back} /><Empty icon="swords" title="Keine Wettbewerbsdaten" body="Für diese Beobachtung liegen noch keine Vergleichsdaten vor." /></>);

  const color = d.color || '#1d9bf0';
  const geo = GEO_META[d.geo];
  const maxShare = Math.max(...d.sov.map((s) => s.share), 1);
  const sigMax = Math.max(...d.signals.map((s) => s.n), 1);
  const sentTotal = d.sentiment.positive + d.sentiment.neutral + d.sentiment.negative || 1;
  const moves = flattenFeed(feedData).map(toDisplayItem);
  const sovColor = (i: number, c: string | null) => c || PALETTE[i % PALETTE.length];

  return (
    <>
      <DeskHeader title={d.subject} onBack={back}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="iconbtn" style={{ color: 'var(--accent)' }}><Icon name="bell" size={19} /></button>
            <button className="iconbtn" style={{ color: 'var(--neg)' }} title="Löschen" onClick={onDelete}><Icon name="trash" size={19} /></button>
          </div>
        }
        sub={<Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[{ key: 'overview', label: 'Überblick' }, { key: 'rivals', label: 'Konkurrenten' }, { key: 'moves', label: 'Bewegungen' }]} />} />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        <div style={{ padding: '16px 22px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: 16, background: `color-mix(in srgb, ${color} 18%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="building" size={28} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 900, fontSize: 23, letterSpacing: -0.5 }}>{d.subject}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '2px 8px', borderRadius: 999 }}>Wettbewerb</span>
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 2 }}>{d.domain || 'Unternehmen'} · {geo.flag} {geo.de}</div>
            </div>
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.55, marginTop: 14 }}>{d.summary}</div>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'overview' && <>
            <Panel title="Share of Voice" action={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>30 Tage</span>}>
              {d.sov.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {d.sov.map((s, i) => (
                    <div key={s.watch_item_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: sovColor(i, s.color) }} />
                        <span style={{ fontSize: 13, fontWeight: s.you ? 800 : 600, color: s.you ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      </div>
                      <div style={{ flex: 1, height: 9, background: 'var(--chip)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.share / maxShare * 100}%`, background: sovColor(i, s.color), borderRadius: 999 }} />
                      </div>
                      <span className="tabular" style={{ width: 34, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{s.share}%</span>
                      <span style={{ width: 46, textAlign: 'right' }}><Delta v={s.up} size={11.5} /></span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Beobachte weitere Unternehmen für einen Share-of-Voice-Vergleich.</div>}
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {d.momentum.length > 0 && (
                <Panel title="Momentum">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {d.momentum.map((m) => (
                      <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                        <span style={{ width: 64, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                        <div style={{ flex: 1 }}><Sparkline data={m.spark} w={130} h={30} color={m.up >= 0 ? 'var(--pos)' : 'var(--neg)'} /></div>
                        <Delta v={m.up} />
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
              <Panel title="Marktstimmung">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Donut size={104} thickness={18} segments={[
                    { value: d.sentiment.positive, color: 'var(--pos)' }, { value: d.sentiment.neutral, color: 'var(--neu)' }, { value: d.sentiment.negative, color: 'var(--neg)' },
                  ]} center={<><span className="tabular" style={{ fontSize: 20, fontWeight: 800, color: 'var(--pos)' }}>{Math.round(d.sentiment.positive / sentTotal * 100)}%</span><span style={{ fontSize: 10, color: 'var(--text-3)' }}>positiv</span></>} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {([['Positiv', d.sentiment.positive, 'var(--pos)'], ['Neutral', d.sentiment.neutral, 'var(--neu)'], ['Negativ', d.sentiment.negative, 'var(--neg)']] as const).map(([l, n, c]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{l}</span>
                        <span className="tabular" style={{ fontWeight: 700, fontSize: 13 }}>{Math.round(n / sentTotal * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>

            {d.signals.length > 0 && (
              <Panel title="Signal-Mix">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {d.signals.map((s) => (
                    <BarRow key={s.signal_type ?? 'x'} label={SIGNAL_META[s.signal_type as SignalType]?.de ?? 'Allgemein'} value={s.n} max={sigMax} color={SIGNAL_META[s.signal_type as SignalType]?.color ?? '#8b98a5'} />
                  ))}
                </div>
              </Panel>
            )}

            {(d.strengths.length > 0 || d.watchouts.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 16, borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, var(--pos) 8%, var(--raise))', border: '1px solid color-mix(in srgb, var(--pos) 22%, transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pos)', fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}><Icon name="arrowUp" size={15} /> Stärken</div>
                  {d.strengths.map((s) => <div key={s} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, marginBottom: 7, display: 'flex', gap: 7 }}><span style={{ color: 'var(--pos)' }}>•</span>{s}</div>)}
                </div>
                <div style={{ padding: 16, borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, var(--rank2) 8%, var(--raise))', border: '1px solid color-mix(in srgb, var(--rank2) 22%, transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--rank2)', fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}><Icon name="target" size={15} /> Achten auf</div>
                  {d.watchouts.map((s) => <div key={s} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, marginBottom: 7, display: 'flex', gap: 7 }}><span style={{ color: 'var(--rank2)' }}>•</span>{s}</div>)}
                </div>
              </div>
            )}
          </>}

          {tab === 'rivals' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {d.sov.map((s, i) => (
                <div key={s.watch_item_id} style={{ padding: 16, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid ' + (s.you ? `color-mix(in srgb,${sovColor(i, s.color)} 45%,transparent)` : 'var(--border)') }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: sovColor(i, s.color), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{s.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{s.name}</span>
                        {s.you && <span style={{ fontSize: 10, fontWeight: 800, color: sovColor(i, s.color), background: `color-mix(in srgb,${sovColor(i, s.color)} 16%,transparent)`, padding: '2px 6px', borderRadius: 999 }}>BEOBACHTET</span>}
                      </div>
                      <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{s.share}% Share of Voice</div>
                    </div>
                    <Delta v={s.up} />
                  </div>
                  <div style={{ marginTop: 12, height: 8, background: 'var(--chip)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.share / maxShare * 100}%`, background: sovColor(i, s.color), borderRadius: 999 }} />
                  </div>
                </div>
              ))}
              {d.detectedRivals.map((r, i) => (
                <div key={'det-' + r.name} style={{ padding: 16, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: PALETTE[(i + d.sov.length) % PALETTE.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{r.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{r.count}× miterwähnt</div>
                  </div>
                  <button className="press" onClick={onCompose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    <Icon name="plus" size={14} /> Beobachten
                  </button>
                </div>
              ))}
              {d.aiRivals.map((name, i) => (
                <div key={name} style={{ padding: 16, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: PALETTE[(i + d.sov.length + d.detectedRivals.length) % PALETTE.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>KI-erkannt</div>
                  </div>
                  <button className="press" onClick={onCompose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    <Icon name="plus" size={14} /> Beobachten
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'moves' && <>
            {d.moves.length > 0 ? (
              <div style={{ position: 'relative', paddingLeft: 8 }}>
                {d.moves.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: 18 }}>
                    {i < d.moves.length - 1 && <div style={{ position: 'absolute', left: 5, top: 16, bottom: 0, width: 2, background: 'var(--border)' }} />}
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: RANK_META[m.rank]?.color ?? 'var(--rank3)', marginTop: 3, flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 4px var(--bg)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>{m.date}</span>
                        <SignalBadge signal={m.signal_type as SignalType | null} sm />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{m.text}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 3 }}>{m.src}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: 'var(--text-3)', fontSize: 13.5, padding: '8px 2px' }}>Noch keine Bewegungen erfasst.</div>}
            {moves.length > 0 && <>
              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 4, marginBottom: -4 }}>Signale im Feed</div>
              <div style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {moves.map((it) => <FeedCard key={it.id} item={it} variant="kompakt" on={actions} onOpen={(x) => nav('detail', { item: x })} />)}
              </div>
            </>}
          </>}
          <div style={{ height: 20 }} />
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════ WATCH DETAIL ════════════════════════════════════════
export function DeskWatchDetail({ id, actions, nav, back, flash }: {
  id: string; actions: ItemActions; nav: Nav; back: () => void; flash: (m: string) => void;
}) {
  const { data: watches } = useWatchlist();
  const feed = useFeed({ watch_item_id: id });
  const run = useRunWatch();
  const del = useDeleteWatch();
  const w = (watches ?? []).find((x) => x.id === id);
  const items = flattenFeed(feed.data).map(toDisplayItem);

  const onDelete = () => {
    if (!w || !window.confirm(`Beobachtung „${w.display_name}" löschen?`)) return;
    del.mutate(w.id, { onSuccess: () => { flash('Beobachtung gelöscht'); back(); } });
  };

  if (!w) return (<><DeskHeader title="Beobachtung" onBack={back} /><div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div></>);
  const color = w.color || '#1d9bf0';
  const geo = GEO_META[w.geo_filter];
  const p1 = items.filter((x) => x.rank === 1).length;
  const sources = new Set(items.map((x) => x.source.name)).size;

  return (
    <>
      <DeskHeader title={w.display_name} onBack={back}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <RunbackButton busy={run.isPending} onRun={(days) => {
              run.mutate({ id, lookback_days: days });
              flash(days ? `Suche der letzten ${days} Tage gestartet …` : 'Abruf gestartet …');
            }} />
            <button className="iconbtn" style={{ color: 'var(--neg)' }} title="Löschen" onClick={onDelete}><Icon name="trash" size={19} /></button>
          </div>
        } />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        <div style={{ padding: '16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 15, background: `color-mix(in srgb,${color} 18%,transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={w.type === 'company' ? 'building' : 'hash'} size={26} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 21 }}>{w.display_name}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 13.5 }}>{geo.flag} {geo.de} · {w.signals ?? items.length} Signale</div>
            </div>
            <div style={{ textAlign: 'right' }}><Delta v={w.momentum ?? 0} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
            {([['P1-Signale', p1, 'var(--rank1)'], ['Geladen', items.length, 'var(--accent)'], ['Quellen', sources, 'var(--pos)']] as const).map(([l, n, c]) => (
              <div key={l} style={{ padding: 14, borderRadius: 14, background: 'var(--raise)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div className="tabular" style={{ fontSize: 24, fontWeight: 800, color: c }}>{n}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hr" />
        {feed.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>}
        {!feed.isLoading && items.length === 0 && <Empty icon="bolt" title="Noch keine Signale" body="Rufe diese Beobachtung ab, um Signale zu sammeln." />}
        {items.map((it) => <FeedCard key={it.id} item={it} variant="standard" on={actions} onOpen={(x) => nav('detail', { item: x })} />)}
        <div style={{ height: 28 }} />
      </div>
    </>
  );
}

// ════════════════════════════════════════ PROFILE ════════════════════════════════════════
export function DeskProfile({ actions, nav, me }: { actions: ItemActions; nav: Nav; me: AuthUser | undefined }) {
  const [tab, setTab] = useState<'saved' | 'liked'>('saved');
  const { data: watches } = useWatchlist();
  const saved = useFeed({ bookmarked: true });
  const liked = useFeed({ feedback: 'up' });
  const savedItems = flattenFeed(saved.data).map(toDisplayItem);
  const likedItems = flattenFeed(liked.data).map(toDisplayItem);
  const list: DisplayItem[] = tab === 'saved' ? savedItems : likedItems;
  const active = tab === 'saved' ? saved : liked;

  return (
    <>
      <DeskHeader title="Profil" right={<button className="iconbtn" onClick={() => nav('settings')}><Icon name="settings" size={20} /></button>} />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        <div style={{ height: 140, background: 'linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 40%, #7c5cff))' }} />
        <div style={{ padding: '0 22px' }}>
          <div style={{ marginTop: -38, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ border: '4px solid var(--bg)', borderRadius: '50%' }}><UserCircle name={me?.username ?? '?'} size={96} /></div>
            <button className="pill pill-ghost press" onClick={() => nav('settings')} style={{ padding: '9px 18px', fontSize: 14, marginBottom: 8 }}>Profil bearbeiten</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 900, fontSize: 23 }}>{me?.username ?? 'Konto'}</span><Verified size={18} /></div>
            <div style={{ color: 'var(--text-3)', fontSize: 14.5 }}>{me?.email || (me?.role === 'admin' ? 'Administrator' : 'Content Intelligence · Pro')}</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 14 }}>
              <span><b style={{ fontWeight: 800 }}>{watches?.length ?? 0}</b> <span style={{ color: 'var(--text-3)' }}>Beobachtungen</span></span>
              <span><b style={{ fontWeight: 800 }}>{savedItems.length}</b> <span style={{ color: 'var(--text-3)' }}>Gespeichert</span></span>
              <span><b style={{ fontWeight: 800 }}>{likedItems.length}</b> <span style={{ color: 'var(--text-3)' }}>Relevant</span></span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[{ key: 'saved', label: 'Gespeichert' }, { key: 'liked', label: 'Als relevant markiert' }]} />
        </div>
        {active.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>}
        {!active.isLoading && (list.length === 0
          ? <Empty icon={tab === 'saved' ? 'bookmark' : 'thumbUp'} title="Noch nichts hier" body="Markiere Signale, um sie hier zu sammeln." />
          : list.map((it) => <FeedCard key={it.id} item={it} variant="standard" on={actions} onOpen={(x) => nav('detail', { item: x })} />))}
        <div style={{ height: 28 }} />
      </div>
    </>
  );
}

// ════════════════════════════════════════ SETTINGS ════════════════════════════════════════
const AI_LABEL: Record<string, string> = { claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek' };
const THEMES: { k: Theme; label: string; swatch: string }[] = [
  { k: 'light', label: 'Hell', swatch: '#fff' }, { k: 'dim', label: 'Dim', swatch: '#15202b' }, { k: 'dark', label: 'Schwarz', swatch: '#000' },
];

function SetRow({ icon, title, sub, right, onClick, color }: {
  icon: Parameters<typeof Icon>[0]['name']; title: string; sub?: string; right?: React.ReactNode; onClick?: () => void; color?: string;
}) {
  return (
    <div className="press" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'var(--hover)'; }} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <span style={{ color: color || 'var(--text-2)', flexShrink: 0 }}><Icon name={icon} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: color || 'var(--text)' }}>{title}</div>
        {sub && <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function DeskSettings({ theme, setTheme, accent, setAccent, me, onLogout, nav }: {
  theme: Theme; setTheme: (t: Theme) => void; accent: string; setAccent: (a: string) => void;
  me: AuthUser | undefined; onLogout: () => void; nav: Nav;
}) {
  const { data: s } = useSettings();
  return (
    <>
      <DeskHeader title="Einstellungen" />
      <div className="dt-scroll scroll" style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px' }}>
          <UserCircle name={me?.username ?? '?'} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ fontWeight: 800, fontSize: 17 }}>{me?.username ?? 'Konto'}</span><Verified size={15} /></div>
            <div style={{ color: 'var(--text-3)', fontSize: 13.5 }}>{me?.email || (me?.role === 'admin' ? 'Administrator' : 'Pro')}</div>
          </div>
        </div>
        <div className="hr" />

        <SectionLabel>Darstellung</SectionLabel>
        <div style={{ padding: '4px 22px 18px', maxWidth: 460 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600, marginBottom: 10 }}>Design</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {THEMES.map((t) => {
              const on = theme === t.k;
              return (
                <button key={t.k} className="press" onClick={() => setTheme(t.k)} style={{
                  flex: 1, padding: '14px 0', borderRadius: 13, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                  background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: t.swatch, border: '1px solid var(--border-strong)' }} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600, margin: '18px 0 10px' }}>Akzentfarbe</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {ACCENTS.map((c) => (
              <button key={c} className="press" onClick={() => setAccent(c)} style={{
                width: 36, height: 36, borderRadius: '50%', background: c, border: accent === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>{accent === c && <Icon name="check" size={16} />}</button>
            ))}
          </div>
        </div>
        <div className="hr" />

        <SectionLabel>Benachrichtigungen</SectionLabel>
        <SetRow icon="bell" title="P1-Signale sofort" sub="Push bei kritischen Signalen"
          right={<span style={{ color: s?.notify_rank_1 ? 'var(--pos)' : 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>{s?.notify_rank_1 ? 'An' : 'Aus'}</span>} />
        <SetRow icon="bolt" title="Telegram" sub={s?.telegram_connected ? 'Verbunden' : 'Nicht verbunden'}
          right={<span style={{ color: s?.telegram_connected ? 'var(--pos)' : 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>{s?.telegram_connected ? 'Aktiv' : 'Aus'}</span>} />
        <SetRow icon="calendar" title="Wochen-Briefing" sub={s?.newsletter_enabled ? `${s.newsletter_day ?? 'Montag'}, ${s.newsletter_time ?? '07:00'}` : 'Deaktiviert'}
          right={<span style={{ color: s?.newsletter_enabled ? 'var(--pos)' : 'var(--text-3)', fontSize: 12.5, fontWeight: 700 }}>{s?.newsletter_enabled ? 'An' : 'Aus'}</span>} />
        <div className="hr" />

        <SectionLabel>KI &amp; Daten</SectionLabel>
        <SetRow icon="sparkle" title="KI-Modell" sub={`${AI_LABEL[s?.ai_model ?? 'claude']} · für Klassifizierung & Ranking`} right={<Chevron />} />
        <SetRow icon="target" title="Relevanz-Training" sub="Dein 👍/👎-Feedback steuert das Ranking" right={<Chevron />} />
        <SetRow icon="globe" title="Sprache" sub={s?.language === 'en' ? 'English' : 'Deutsch'} right={<Chevron />} />
        {me?.role === 'admin' && <SetRow icon="settings" title="Administration" sub="Tests, Versand, Quellen, Nutzer & KI-Konfiguration" right={<Chevron />} onClick={() => nav('admin')} />}
        <div className="hr" />

        <SetRow icon="logout" title="Abmelden" color="var(--neg)" onClick={onLogout} />
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 20 }}>Nicheletter.ai · v2.0 — Desktop</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════ ADMIN ════════════════════════════════════════
export function DeskAdmin({ back }: { back: () => void }) {
  return (
    <>
      <DeskHeader title="Administration" onBack={back} />
      <div className="dt-scroll scroll" style={{ flex: 1, paddingTop: 8 }}>
        <AdminSections />
      </div>
    </>
  );
}
