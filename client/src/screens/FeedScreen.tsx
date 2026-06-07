import { useState } from 'react';
import {
  BrandMark, BrandWord, Empty, FeedCard, FilterChip, ItemActions,
  Spinner, Tabs, TopBar, UserCircle,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { DisplayItem, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useWatchlist } from '../hooks/useWatchlist';

type Nav = (name: string, params?: Record<string, unknown>) => void;

const VIEWS = [
  { k: 'standard', label: 'Standard' },
  { k: 'kompakt', label: 'Kompakt' },
  { k: 'karte', label: 'Karte' },
];

export default function FeedScreen({ actions, variant, setVariant, onOpen, nav, username }: {
  actions: ItemActions;
  variant: string;
  setVariant: (v: string) => void;
  onOpen: (i: DisplayItem) => void;
  nav: Nav;
  username: string;
}) {
  const [tab, setTab] = useState<'top' | 'latest' | 'bookmarks'>('top');
  const [watchFilter, setWatchFilter] = useState('');
  const [showView, setShowView] = useState(false);

  const { data: watches } = useWatchlist();
  const feed = useFeed({
    sort: tab === 'latest' ? 'latest' : 'top',
    bookmarked: tab === 'bookmarks' ? true : undefined,
    watch_item_id: watchFilter || undefined,
  });
  const items = flattenFeed(feed.data).map(toDisplayItem);

  return (
    <>
      <TopBar sub={
        <Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[
          { key: 'top', label: 'Top' },
          { key: 'latest', label: 'Neueste' },
          { key: 'bookmarks', label: 'Gespeichert' },
        ]} />
      }>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 10px' }}>
          <button className="iconbtn" onClick={() => nav('profile')} style={{ padding: 0 }}>
            <UserCircle name={username} size={34} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BrandMark size={26} /><BrandWord size={19} />
          </div>
          <button className="iconbtn" onClick={() => setShowView((v) => !v)} title="Ansicht">
            <Icon name="grid" size={20} style={{ color: 'var(--text)' }} />
          </button>
        </div>
      </TopBar>

      {showView && (
        <div className="fade-up" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--raise)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Karten-Ansicht</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {VIEWS.map((v) => {
              const on = v.k === variant;
              return (
                <button key={v.k} className="press" onClick={() => setVariant(v.k)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                  background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-2)',
                }}>{v.label}</button>
              );
            })}
          </div>
        </div>
      )}

      <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <FilterChip active={!watchFilter} onClick={() => setWatchFilter('')} label="Alle" />
        {(watches ?? []).filter((w) => w.is_active).map((w) => (
          <FilterChip key={w.id} active={watchFilter === w.id} onClick={() => setWatchFilter(w.id)}
            label={w.display_name} dot={w.color || '#1d9bf0'} />
        ))}
      </div>

      {feed.isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>
      )}

      {!feed.isLoading && items.length === 0 && (
        <Empty icon={tab === 'bookmarks' ? 'bookmark' : 'home'}
          title={tab === 'bookmarks' ? 'Noch nichts gespeichert' : 'Keine Signale'}
          body={tab === 'bookmarks'
            ? 'Tippe das Lesezeichen auf einer Karte, um sie hier zu sammeln.'
            : 'Lege eine Beobachtung an oder rufe sie ab, damit dein Feed sich füllt.'} />
      )}

      {items.map((it) => (
        <FeedCard key={it.id} item={it} variant={variant} on={actions} onOpen={onOpen} />
      ))}

      {feed.hasNextPage && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
          <button className="pill pill-ghost press" disabled={feed.isFetchingNextPage}
            onClick={() => feed.fetchNextPage()} style={{ padding: '10px 20px', fontSize: 14 }}>
            {feed.isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
          </button>
        </div>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}
