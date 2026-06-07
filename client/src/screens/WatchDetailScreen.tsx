import { Delta, DetailBar, Empty, FeedCard, ItemActions, Spinner } from '../components/ui';
import { Icon } from '../components/Icon';
import { GEO_META, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useDeleteWatch, useRunWatch, useWatchlist } from '../hooks/useWatchlist';

type Nav = (name: string, params?: Record<string, unknown>) => void;

export default function WatchDetailScreen({ id, actions, nav, back, flash }: {
  id: string; actions: ItemActions; nav: Nav; back: () => void; flash: (m: string) => void;
}) {
  const { data: watches } = useWatchlist();
  const feed = useFeed({ watch_item_id: id });
  const run = useRunWatch();
  const del = useDeleteWatch();
  const w = (watches ?? []).find((x) => x.id === id);

  const onDelete = () => {
    if (!w || !window.confirm(`Beobachtung „${w.display_name}" löschen?`)) return;
    del.mutate(w.id, { onSuccess: () => { flash('Beobachtung gelöscht'); back(); } });
  };
  const items = flattenFeed(feed.data).map(toDisplayItem);

  if (!w) {
    return (<><DetailBar title="Beobachtung" back={back} /><div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div></>);
  }
  const color = w.color || '#1d9bf0';
  const geo = GEO_META[w.geo_filter];
  const p1 = items.filter((x) => x.rank === 1).length;
  const sources = new Set(items.map((x) => x.source.name)).size;

  return (
    <>
      <DetailBar title={w.display_name} back={back} right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button className="iconbtn" style={{ color: 'var(--accent)' }} onClick={() => { run.mutate({ id }); flash('Abruf gestartet …'); }}>
            <Icon name="refresh" size={19} />
          </button>
          <button className="iconbtn" style={{ color: 'var(--neg)' }} title="Löschen" onClick={onDelete}>
            <Icon name="trash" size={19} />
          </button>
        </div>
      } />
      <div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: `color-mix(in srgb,${color} 18%,transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={w.type === 'company' ? 'building' : 'hash'} size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 19 }}>{w.display_name}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{geo.flag} {geo.de} · {w.signals ?? items.length} Signale</div>
            </div>
            <div style={{ textAlign: 'right' }}><Delta v={w.momentum ?? 0} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
            {([['P1', p1, 'var(--rank1)'], ['Geladen', items.length, 'var(--accent)'], ['Quellen', sources, 'var(--pos)']] as const).map(([l, n, c]) => (
              <div key={l} style={{ padding: 12, borderRadius: 13, background: 'var(--raise)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div className="tabular" style={{ fontSize: 22, fontWeight: 800, color: c }}>{n}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hr" />
        {feed.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>}
        {!feed.isLoading && items.length === 0 && (
          <Empty icon="bolt" title="Noch keine Signale" body="Rufe diese Beobachtung ab, um Signale zu sammeln." />
        )}
        {items.map((it) => (
          <FeedCard key={it.id} item={it} variant="standard" on={actions} onOpen={(x) => nav('detail', { item: x })} />
        ))}
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
