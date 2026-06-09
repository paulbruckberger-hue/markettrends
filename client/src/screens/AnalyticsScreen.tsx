import { useState } from 'react';
import { BarRow, BarsMini, Donut, FilterChip, Panel, Spinner, StatCard, TopBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { CompareChart, LastUpdated, PeriodSwitch } from '../components/trends';
import { RANK_META, SIGNAL_META } from '../lib/presenter';
import { SOURCE_LABELS } from '../lib/labels';
import { useOverview, useWatchAnalytics } from '../hooks/useAnalytics';
import { useWatchlist } from '../hooks/useWatchlist';
import { SignalType, SourceTypeName } from '../types';

type Nav = (name: string, params?: Record<string, unknown>) => void;

export default function AnalyticsScreen({ nav }: { nav: Nav }) {
  const [scope, setScope] = useState('all');
  const [period, setPeriod] = useState(30);
  const { data: overview, isLoading } = useOverview(period);
  const { data: watches } = useWatchlist();
  const { data: wa } = useWatchAnalytics(scope === 'all' ? null : scope, period);

  const firstCompany = (watches ?? []).find((w) => w.type === 'company');

  if (isLoading || !overview) {
    return (
      <>
        <TopBar><div style={{ padding: '6px 16px 12px', fontWeight: 900, fontSize: 21 }}>Analyse</div></TopBar>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>
      </>
    );
  }

  const isWatch = scope !== 'all';
  const volume = (isWatch ? wa?.volume : overview.volume) ?? [];
  const volData = volume.map((v) => v.n);
  const volSum = volData.reduce((a, b) => a + b, 0);

  const sentiment = isWatch
    ? (wa?.sentiment ?? { positive: 0, neutral: 0, negative: 0 })
    : overview.bySentiment;
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
    color: SIGNAL_META[s.signal_type as SignalType]?.color ?? '#8b98a5',
    n: s.n,
  }));
  const maxSig = Math.max(...signalMix.map((s) => s.n), 1);

  return (
    <>
      <TopBar>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
          <span style={{ fontWeight: 900, fontSize: 21, letterSpacing: -0.4 }}>Analyse</span>
          <PeriodSwitch value={period} onChange={setPeriod} />
        </div>
        <div style={{ padding: '0 16px 10px' }}><LastUpdated iso={overview.last_updated} /></div>
      </TopBar>

      <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <FilterChip active={scope === 'all'} onClick={() => setScope('all')} label="Alle Beobachtungen" />
        {(watches ?? []).filter((w) => w.is_active).map((w) => (
          <FilterChip key={w.id} active={scope === w.id} onClick={() => setScope(w.id)} label={w.display_name} dot={w.color || '#1d9bf0'} />
        ))}
      </div>

      <div className="scroll" style={{ padding: 14, paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

        <Panel title="Signalvolumen" action={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{period} Tage</span>}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span className="tabular" style={{ fontSize: 28, fontWeight: 800 }}>{volSum}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Signale im Zeitraum</span>
          </div>
          {volData.length ? <BarsMini data={volData} h={96} color="var(--accent)" />
            : <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Noch keine Daten</div>}
        </Panel>

        {!isWatch && (
          <Panel title="Beobachtungen im Vergleich" action={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{period} Tage</span>}>
            <CompareChart period={period} />
          </Panel>
        )}

        {isWatch ? (
          <Panel title="Signal-Mix">
            {signalMix.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {signalMix.map((s) => <BarRow key={s.label} label={s.label} value={s.n} max={maxSig} color={s.color} />)}
              </div>
            ) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Keine Signal-Typen (nur bei Unternehmen).</div>}
          </Panel>
        ) : (
          <Panel title="Verteilung nach Priorität">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Donut segments={rankSegs} size={118} thickness={20} center={
                <><span className="tabular" style={{ fontSize: 22, fontWeight: 800 }}>{overview.total}</span><span style={{ fontSize: 11, color: 'var(--text-3)' }}>Signale</span></>
              } />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map((r) => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: RANK_META[r].color }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{RANK_META[r].tag} · {RANK_META[r].de}</span>
                    <span className="tabular" style={{ fontWeight: 800, fontSize: 14 }}>{overview.byRank[String(r)] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}

        <Panel title="Top-Quellen">
          {sources.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sources.map((s) => <BarRow key={s.label} label={s.label} value={s.n} max={maxSrc} />)}
            </div>
          ) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Noch keine Quellen.</div>}
        </Panel>

        <Panel title="Marktstimmung">
          <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${(sentiment.positive ?? 0) / sentTotal * 100}%`, background: 'var(--pos)' }} />
            <div style={{ width: `${(sentiment.neutral ?? 0) / sentTotal * 100}%`, background: 'var(--neu)' }} />
            <div style={{ width: `${(sentiment.negative ?? 0) / sentTotal * 100}%`, background: 'var(--neg)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {([['Positiv', sentiment.positive ?? 0, 'var(--pos)'], ['Neutral', sentiment.neutral ?? 0, 'var(--neu)'], ['Negativ', sentiment.negative ?? 0, 'var(--neg)']] as const).map(([l, n, c]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-2)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</div>
                <div className="tabular" style={{ fontWeight: 800, fontSize: 16, marginTop: 2 }}>{n}</div>
              </div>
            ))}
          </div>
        </Panel>

        {firstCompany && (
          <button className="press" onClick={() => nav('competitor', { id: firstCompany.id })} style={{
            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 'var(--r-card)',
            background: 'linear-gradient(120deg, color-mix(in srgb, var(--accent) 14%, var(--raise)), var(--raise))',
            border: '1px solid var(--border)', cursor: 'pointer', width: '100%',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="swords" size={22} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Wettbewerbsanalyse</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Deep-Dive zu {firstCompany.display_name} & Co.</div>
            </div>
            <Icon name="chevron" size={20} style={{ color: 'var(--text-3)' }} />
          </button>
        )}
      </div>
    </>
  );
}
