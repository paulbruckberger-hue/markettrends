import { useState } from 'react';
import { Empty, FeedCard, ItemActions, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';
import { DisplayItem, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';

export default function ExploreScreen({ actions, onOpen, onCompose }: {
  actions: ItemActions; onOpen: (i: DisplayItem) => void; onCompose: () => void;
}) {
  const [q, setQ] = useState('');
  const feed = useFeed(q ? { search: q, sort: 'latest' } : { sort: 'top' });
  const items = flattenFeed(feed.data).map(toDisplayItem);

  // Trends derived from the most frequent tags in the current feed.
  const tagCount = new Map<string, number>();
  for (const it of items) for (const t of it.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const trends = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const SUGGESTED = [
    { n: 'Klarna', t: 'company', c: '#ffb3c7' },
    { n: 'Stablecoins', t: 'topic', c: '#1d9bf0' },
    { n: 'Revolut', t: 'company', c: '#7c5cff' },
    { n: 'PSD3', t: 'topic', c: '#f59e0b' },
  ];

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
          <div style={{ padding: '16px 16px 6px', fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>Trends für dich</div>
          {trends.length === 0 && <div style={{ padding: '0 16px 8px', color: 'var(--text-3)', fontSize: 13.5 }}>Noch keine Trends — rufe deine Beobachtungen ab.</div>}
          {trends.map(([tag, n], i) => (
            <div key={tag} className="press" onClick={() => setQ(tag)} style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12.5 }}>
                  <span>{i + 1} · Thema</span>
                  <span style={{ color: 'var(--pos)' }}><Icon name="trending" size={13} /></span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 2 }}>#{tag}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 1 }}>{n} {n === 1 ? 'Signal' : 'Signale'}</div>
              </div>
              <button className="iconbtn"><Icon name="chevron" size={17} style={{ color: 'var(--text-3)' }} /></button>
            </div>
          ))}

          <div style={{ padding: '18px 16px 8px', fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>Empfohlen zu beobachten</div>
          <div className="scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 6px' }}>
            {SUGGESTED.map((s) => (
              <div key={s.n} style={{ flexShrink: 0, width: 150, padding: 14, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--raise)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, marginBottom: 10 }}>
                  {s.t === 'topic' ? '#' : s.n[0]}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>{s.n}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 11 }}>{s.t === 'topic' ? 'Thema' : 'Unternehmen'}</div>
                <button className="pill pill-solid press" onClick={onCompose} style={{ width: '100%', padding: '7px 0', fontSize: 13 }}>Beobachten</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
