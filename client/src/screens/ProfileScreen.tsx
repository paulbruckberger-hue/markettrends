import { useState } from 'react';
import { DetailBar, Empty, FeedCard, ItemActions, Spinner, UserCircle, Verified } from '../components/ui';
import { Icon } from '../components/Icon';
import { DisplayItem, toDisplayItem } from '../lib/presenter';
import { flattenFeed, useFeed } from '../hooks/useArticles';
import { useWatchlist } from '../hooks/useWatchlist';
import { AuthUser } from '../types';
import { Tabs } from '../components/ui';

type Nav = (name: string, params?: Record<string, unknown>) => void;

export default function ProfileScreen({ actions, nav, back, me }: {
  actions: ItemActions; nav: Nav; back: () => void; me: AuthUser | undefined;
}) {
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
      <DetailBar title="Profil" back={back} right={<button className="iconbtn" onClick={() => nav('settings')}><Icon name="settings" size={20} /></button>} />
      <div>
        <div style={{ height: 80, background: 'linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 40%, #7c5cff))' }} />
        <div style={{ padding: '0 16px' }}>
          <div style={{ marginTop: -28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ border: '4px solid var(--bg)', borderRadius: '50%' }}><UserCircle name={me?.username ?? '?'} size={72} /></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 900, fontSize: 20 }}>{me?.username ?? 'Konto'}</span><Verified size={17} /></div>
            <div style={{ color: 'var(--text-3)', fontSize: 14 }}>{me?.email || (me?.role === 'admin' ? 'Administrator' : 'Content Intelligence · Pro')}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13.5 }}>
              <span><b style={{ fontWeight: 800 }}>{watches?.length ?? 0}</b> <span style={{ color: 'var(--text-3)' }}>Beobachtungen</span></span>
              <span><b style={{ fontWeight: 800 }}>{savedItems.length}</b> <span style={{ color: 'var(--text-3)' }}>Gespeichert</span></span>
              <span><b style={{ fontWeight: 800 }}>{likedItems.length}</b> <span style={{ color: 'var(--text-3)' }}>Relevant</span></span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Tabs active={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[{ key: 'saved', label: 'Gespeichert' }, { key: 'liked', label: 'Als relevant markiert' }]} />
        </div>
        {active.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>}
        {!active.isLoading && (list.length === 0
          ? <Empty icon={tab === 'saved' ? 'bookmark' : 'thumbUp'} title="Noch nichts hier" body="Markiere Signale, um sie hier zu sammeln." />
          : list.map((it) => <FeedCard key={it.id} item={it} variant="standard" on={actions} onOpen={(x) => nav('detail', { item: x })} />))}
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
