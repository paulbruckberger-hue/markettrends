import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import Layout from '../components/Layout';
import ArticleCard from '../components/ArticleCard';
import { useFeed, usePatchArticle, FeedFilters } from '../hooks/useArticles';
import { useWatchlist } from '../hooks/useWatchlist';
import { FeedItem } from '../types';

export default function FeedPage() {
  const [rank, setRank] = useState<number>(0);
  const [watchItemId, setWatchItemId] = useState<string>('');
  const [period, setPeriod] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const filters: FeedFilters = useMemo(
    () => ({ rank: rank || undefined, watch_item_id: watchItemId || undefined, period: period || undefined, search }),
    [rank, watchItemId, period, search]
  );

  const { data: watchlist } = useWatchlist();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed(filters);
  const patch = usePatchArticle();

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const toggleRead = (it: FeedItem) =>
    patch.mutate({ id: it.classification_id, patch: { is_read: !it.is_read } });
  const toggleBookmark = (it: FeedItem) =>
    patch.mutate({ id: it.classification_id, patch: { is_bookmarked: !it.is_bookmarked } });

  return (
    <Layout title="Feed" subtitle="Klassifizierte Markttrends aus deinen Beobachtungen">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen …"
            className="w-56 rounded-lg border border-ink-700 bg-ink-850 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-accent-500"
          />
        </div>

        <select value={rank} onChange={(e) => setRank(Number(e.target.value))} className="select">
          <option value={0}>Alle Ränge</option>
          <option value={1}>Rang 1</option>
          <option value={2}>Rang 2</option>
          <option value={3}>Rang 3</option>
        </select>

        <select value={watchItemId} onChange={(e) => setWatchItemId(e.target.value)} className="select">
          <option value="">Alle Beobachtungen</option>
          {watchlist?.map((w) => (
            <option key={w.id} value={w.id}>{w.display_name}</option>
          ))}
        </select>

        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select">
          <option value="">Gesamter Zeitraum</option>
          <option value="24h">Letzte 24h</option>
          <option value="7d">Letzte 7 Tage</option>
          <option value="30d">Letzte 30 Tage</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={18} /> Lade Feed …
        </div>
      )}

      {isError && <div className="text-rose-300">Feed konnte nicht geladen werden.</div>}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900 p-10 text-center text-slate-400">
          <p className="text-lg">📭 Noch keine klassifizierten Artikel.</p>
          <p className="mt-1 text-sm">
            Lege unter <span className="text-accent-300">Beobachtungen</span> ein Thema an und klicke „Jetzt abrufen".
          </p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((it) => (
          <ArticleCard key={it.classification_id} item={it} onToggleRead={toggleRead} onToggleBookmark={toggleBookmark} />
        ))}
      </div>

      {hasNextPage && (
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
