import { useMemo, useState } from 'react';
import { Heart, Loader2, Search } from 'lucide-react';
import Layout from '../components/Layout';
import ArticleCard from '../components/ArticleCard';
import { useFeed, usePatchArticle, FeedFilters } from '../hooks/useArticles';
import { useWatchlist } from '../hooks/useWatchlist';
import { FeedItem } from '../types';

type TabMode = 'all' | 'favorites';

export default function FeedPage() {
  const [tab, setTab] = useState<TabMode>('all');
  const [rank, setRank] = useState<number>(0);
  const [watchItemId, setWatchItemId] = useState<string>('');
  const [period, setPeriod] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const filters: FeedFilters = useMemo(
    () => ({
      rank: rank || undefined,
      watch_item_id: watchItemId || undefined,
      period: period || undefined,
      search,
    }),
    [rank, watchItemId, period, search]
  );

  const { data: watchlist } = useWatchlist();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed(filters);
  const patch = usePatchArticle();

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const items = tab === 'favorites' ? allItems.filter((it) => it.is_bookmarked) : allItems;

  const toggleRead = (it: FeedItem) => patch.mutate({ id: it.classification_id, patch: { is_read: !it.is_read } });
  const toggleFavorite = (it: FeedItem) => patch.mutate({ id: it.classification_id, patch: { is_bookmarked: !it.is_bookmarked } });
  const overrideRank = (it: FeedItem, rank: number | null) => patch.mutate({ id: it.classification_id, patch: { user_rank_override: rank } });

  const favCount = allItems.filter((it) => it.is_bookmarked).length;

  return (
    <Layout title="Feed" subtitle="Klassifizierte Signale aus deinen Beobachtungen">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b border-ink-800 pb-0">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === 'all' ? 'border-accent-400 text-accent-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Alle
        </button>
        <button
          onClick={() => setTab('favorites')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === 'favorites' ? 'border-rose-400 text-rose-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Heart size={14} />
          Favoriten
          {favCount > 0 && <span className="rounded-full bg-rose-500/20 text-rose-300 text-xs px-1.5">{favCount}</span>}
        </button>
      </div>

      {/* Filters — scroll horizontally on mobile */}
      {tab === 'all' && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:pb-0">
          <div className="relative shrink-0">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen …"
              className="w-40 md:w-56 rounded-lg border border-ink-700 bg-ink-850 py-2 pl-8 pr-3 text-sm text-slate-100 outline-none focus:border-accent-500"
            />
          </div>
          <select value={rank} onChange={(e) => setRank(Number(e.target.value))} className="select shrink-0">
            <option value={0}>Alle Ränge</option>
            <option value={1}>Rang 1 🔴</option>
            <option value={2}>Rang 2 🟠</option>
            <option value={3}>Rang 3</option>
          </select>
          <select value={watchItemId} onChange={(e) => setWatchItemId(e.target.value)} className="select shrink-0 max-w-[180px]">
            <option value="">Alle Beobachtungen</option>
            {watchlist?.map((w) => <option key={w.id} value={w.id}>{w.display_name}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select shrink-0">
            <option value="">Gesamt</option>
            <option value="24h">24h</option>
            <option value="7d">7 Tage</option>
            <option value="30d">30 Tage</option>
          </select>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={18} /> Lade Feed …
        </div>
      )}
      {isError && <div className="text-rose-300">Feed konnte nicht geladen werden.</div>}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900 p-10 text-center text-slate-400">
          {tab === 'favorites' ? (
            <>
              <p className="text-lg">🤍 Noch keine Favoriten</p>
              <p className="mt-1 text-sm">Klicke das Herz-Icon auf einem Artikel, um ihn zu speichern.</p>
            </>
          ) : (
            <>
              <p className="text-lg">📭 Noch keine Artikel.</p>
              <p className="mt-1 text-sm">
                Lege unter <span className="text-accent-300">Beobachtungen</span> ein Thema an und klicke „Jetzt abrufen".
              </p>
            </>
          )}
        </div>
      )}

      <div className="space-y-3 md:space-y-4">
        {items.map((it) => (
          <ArticleCard key={it.classification_id} item={it} onToggleRead={toggleRead} onToggleFavorite={toggleFavorite} onRankOverride={overrideRank} />
        ))}
      </div>

      {tab === 'all' && hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg border border-ink-700 bg-ink-850 px-4 py-2 text-sm text-slate-200 hover:bg-ink-800 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
          </button>
        </div>
      )}
    </Layout>
  );
}
