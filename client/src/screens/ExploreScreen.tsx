import { useState } from 'react';
import { Empty, FeedCard, ItemActions, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';
import { CompareChart, EmergingTags, PeriodSwitch, SectionHead, SuggestionsSection, TodayBanner, TrendList } from '../components/trends';
import { DisplayItem, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';

type Nav = (name: string, params?: Record<string, unknown>) => void;

export default function ExploreScreen({ actions, onOpen, onCompose, nav, flash }: {
  actions: ItemActions; onOpen: (i: DisplayItem) => void; onCompose: () => void; nav: Nav; flash: (m: string) => void;
}) {
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState(30);
  const feed = useFeed(q ? { search: q, sort: 'latest' } : { sort: 'top' });
  const items = flattenFeed(feed.data).map(toDisplayItem);

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 30, paddingTop: 'max(8px, env(safe-area-inset-top))',
        background: 'var(--bar-blur)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ padding: '6px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, background: 'var(--chip)' }}>
            <span style={{ color: 'var(--text-3)' }}><Icon name="search" size={18} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Signale, Themen, Quellen durchsuchen"
              style={{ flex: 1, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font)' }} />
            {q && <button className="press" onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><Icon name="close" size={18} /></button>}
          </div>
        </div>
      </div>

      {feed.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>}

      {!feed.isLoading && q ? (
        items.length
          ? items.map((it) => <FeedCard key={it.id} item={it} variant="standard" on={actions} onOpen={onOpen} />)
          : <Empty icon="search" title="Keine Treffer" body={`Für „${q}" wurden keine Signale gefunden.`} />
      ) : !feed.isLoading && (
        <div className="scroll" style={{ paddingBottom: 24 }}>
          <TodayBanner nav={nav} />

          <SectionHead title="Trends für dich" right={<PeriodSwitch value={period} onChange={setPeriod} />} />
          <div style={{ padding: '0 16px 4px', color: 'var(--text-3)', fontSize: 12.5 }}>
            Worüber wird mehr oder weniger gesprochen — Momentum ggü. Vorperiode.
          </div>
          <TrendList period={period} nav={nav} />

          <SectionHead title="Aufkommende Schlagworte" />
          <EmergingTags period={period} onPick={setQ} />

          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ fontWeight: 900, fontSize: 19, letterSpacing: -0.4, marginBottom: 10 }}>Themen im Vergleich</div>
            <div style={{ padding: 14, borderRadius: 'var(--r-card)', background: 'var(--raise)', border: '1px solid var(--border)' }}>
              <CompareChart period={period} />
            </div>
          </div>

          <SuggestionsSection flash={flash} />

          <div style={{ padding: '8px 16px 0' }}>
            <button className="pill pill-ghost press" onClick={onCompose} style={{ width: '100%', padding: '11px 0', fontSize: 14 }}>
              + Eigene Beobachtung anlegen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
