import { useState } from 'react';
import {
  BarRow, DetailBar, Delta, Donut, Empty, FeedCard, ItemActions, Panel,
  SignalBadge, Sparkline, Spinner, Tabs,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { GEO_META, RANK_META, SIGNAL_META, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useCompetitor } from '../hooks/useCompetitor';
import { SignalType } from '../types';

type Nav = (name: string, params?: Record<string, unknown>) => void;
const PALETTE = ['#1d9bf0', '#7c5cff', '#00ba7c', '#f59e0b', '#f4212e', '#22d3ee'];

export default function CompetitorScreen({ id, actions, nav, back, onCompose }: {
  id: string; actions: ItemActions; nav: Nav; back: () => void; onCompose: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'rivals' | 'moves'>('overview');
  const { data: d, isLoading } = useCompetitor(id);
  const { data: feedData } = useFeed({ watch_item_id: id });

  if (isLoading) {
    return (<><DetailBar title="Wettbewerb" back={back} /><div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div></>);
  }
  if (!d) {
    return (<><DetailBar title="Unternehmen" back={back} /><Empty icon="swords" title="Keine Wettbewerbsdaten" body="Für diese Beobachtung liegen noch keine Vergleichsdaten vor." /></>);
  }

  const color = d.color || '#1d9bf0';
  const geo = GEO_META[d.geo];
  const maxShare = Math.max(...d.sov.map((s) => s.share), 1);
  const sigMax = Math.max(...d.signals.map((s) => s.n), 1);
  const sentTotal = d.sentiment.positive + d.sentiment.neutral + d.sentiment.negative || 1;
  const moves = flattenFeed(feedData).map(toDisplayItem);
  const sovColor = (i: number, c: string | null) => c || PALETTE[i % PALETTE.length];

  return (
    <>
      <DetailBar title={d.subject} back={back} right={<button className="iconbtn" style={{ color: 'var(--accent)' }}><Icon name="bell" size={19} /></button>} />

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `color-mix(in srgb, ${color} 18%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="building" size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontWeight: 900, fontSize: 21, letterSpacing: -0.4 }}>{d.subject}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '2px 8px', borderRadius: 999 }}>Wettbewerb</span>
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 13.5, marginTop: 2 }}>{d.domain || 'Unternehmen'} · {geo.flag} {geo.de}</div>
          </div>
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 13 }}>{d.summary}</div>
        {d.ai_used && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}><Icon name="sparkle" size={12} /> KI-Einordnung</div>}
      </div>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', marginTop: 14 }}>
        <Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[
          { key: 'overview', label: 'Überblick' }, { key: 'rivals', label: 'Konkurrenten' }, { key: 'moves', label: 'Bewegungen' },
        ]} />
      </div>

      <div className="scroll" style={{ padding: 14, paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'overview' && <>
          <Panel title="Share of Voice" action={<span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>30 Tage</span>}>
            {d.sov.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {d.sov.map((s, i) => (
                  <div key={s.watch_item_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 92, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: sovColor(i, s.color) }} />
                      <span style={{ fontSize: 13, fontWeight: s.you ? 800 : 600, color: s.you ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    </div>
                    <div style={{ flex: 1, height: 9, background: 'var(--chip)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.share / maxShare * 100}%`, background: sovColor(i, s.color), borderRadius: 999 }} />
                    </div>
                    <span className="tabular" style={{ width: 34, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{s.share}%</span>
                    <span style={{ width: 44, textAlign: 'right' }}><Delta v={s.up} size={11.5} /></span>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Beobachte weitere Unternehmen für einen Share-of-Voice-Vergleich.</div>}
          </Panel>

          {d.momentum.length > 0 && (
            <Panel title="Momentum">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {d.momentum.map((m) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                    <span style={{ width: 70, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                    <div style={{ flex: 1 }}><Sparkline data={m.spark} w={150} h={30} color={m.up >= 0 ? 'var(--pos)' : 'var(--neg)'} /></div>
                    <Delta v={m.up} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {d.signals.length > 0 && (
            <Panel title="Signal-Mix">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {d.signals.map((s) => (
                  <BarRow key={s.signal_type ?? 'x'}
                    label={SIGNAL_META[s.signal_type as SignalType]?.de ?? 'Allgemein'}
                    value={s.n} max={sigMax}
                    color={SIGNAL_META[s.signal_type as SignalType]?.color ?? '#8b98a5'} />
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Marktstimmung">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Donut size={104} thickness={18} segments={[
                { value: d.sentiment.positive, color: 'var(--pos)' },
                { value: d.sentiment.neutral, color: 'var(--neu)' },
                { value: d.sentiment.negative, color: 'var(--neg)' },
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

          {(d.strengths.length > 0 || d.watchouts.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, var(--pos) 8%, var(--raise))', border: '1px solid color-mix(in srgb, var(--pos) 22%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pos)', fontWeight: 800, fontSize: 13, marginBottom: 9 }}><Icon name="arrowUp" size={15} /> Stärken</div>
                {d.strengths.map((s) => <div key={s} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, marginBottom: 6, display: 'flex', gap: 6 }}><span style={{ color: 'var(--pos)' }}>•</span>{s}</div>)}
              </div>
              <div style={{ padding: 14, borderRadius: 'var(--r-card)', background: 'color-mix(in srgb, var(--rank2) 8%, var(--raise))', border: '1px solid color-mix(in srgb, var(--rank2) 22%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--rank2)', fontWeight: 800, fontSize: 13, marginBottom: 9 }}><Icon name="target" size={15} /> Achten auf</div>
                {d.watchouts.map((s) => <div key={s} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, marginBottom: 6, display: 'flex', gap: 6 }}><span style={{ color: 'var(--rank2)' }}>•</span>{s}</div>)}
              </div>
            </div>
          )}
        </>}

        {tab === 'rivals' && <>
          {d.sov.map((s, i) => (
            <div key={s.watch_item_id} style={{ padding: 15, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid ' + (s.you ? `color-mix(in srgb,${sovColor(i, s.color)} 45%,transparent)` : 'var(--border)') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: sovColor(i, s.color), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{s.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontWeight: 800, fontSize: 15.5 }}>{s.name}</span>
                    {s.you && <span style={{ fontSize: 10.5, fontWeight: 800, color: sovColor(i, s.color), background: `color-mix(in srgb,${sovColor(i, s.color)} 16%,transparent)`, padding: '2px 7px', borderRadius: 999 }}>BEOBACHTET</span>}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{s.share}% Share of Voice</div>
                </div>
                <Delta v={s.up} />
              </div>
              <div style={{ marginTop: 11, height: 8, background: 'var(--chip)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.share / maxShare * 100}%`, background: sovColor(i, s.color), borderRadius: 999 }} />
              </div>
            </div>
          ))}

          {d.aiRivals.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-2)', margin: '4px 2px 8px' }}>Von der KI erkannte Wettbewerber</div>
              {d.aiRivals.map((name, i) => (
                <div key={name} style={{ padding: 14, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid var(--border)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: PALETTE[(i + d.sov.length) % PALETTE.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{name[0]}</div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{name}</div>
                  <button className="press" onClick={onCompose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    <Icon name="plus" size={15} /> Beobachten
                  </button>
                </div>
              ))}
            </div>
          )}
        </>}

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
                    <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4 }}>{m.text}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 3 }}>{m.src}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: 'var(--text-3)', fontSize: 13.5, padding: '8px 2px' }}>Noch keine Bewegungen erfasst.</div>}

          {moves.length > 0 && <>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>Signale im Feed</div>
            {moves.map((it) => (
              <div key={it.id} style={{ margin: '0 -14px' }}>
                <FeedCard item={it} variant="kompakt" on={actions} onOpen={(x) => nav('detail', { item: x })} />
              </div>
            ))}
          </>}
        </>}
      </div>
    </>
  );
}
