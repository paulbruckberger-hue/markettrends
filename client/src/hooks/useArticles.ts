import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FeedItem, FeedResponse } from '../types';

export interface FeedFilters {
  rank?: number;
  watch_item_id?: string;
  source_type?: string;
  period?: string;
  search?: string;
  sort?: 'top' | 'latest';
  bookmarked?: boolean;
  feedback?: 'up' | 'down';
  sentiment?: 'positive' | 'neutral' | 'negative';
}

function cleanParams(filters: FeedFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (filters.rank) out.rank = filters.rank;
  if (filters.watch_item_id) out.watch_item_id = filters.watch_item_id;
  if (filters.source_type) out.source_type = filters.source_type;
  if (filters.period) out.period = filters.period;
  if (filters.search && filters.search.trim()) out.search = filters.search.trim();
  if (filters.sort) out.sort = filters.sort;
  if (filters.bookmarked) out.bookmarked = '1';
  if (filters.feedback) out.feedback = filters.feedback;
  if (filters.sentiment) out.sentiment = filters.sentiment;
  return out;
}

export function useFeed(filters: FeedFilters, opts?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: ['feed', filters],
    enabled: opts?.enabled ?? true,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = { ...cleanParams(filters), page: pageParam, limit: 20 };
      return (await api.get<FeedResponse>('/api/articles', { params })).data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

/** Flatten an infinite feed query into a single list. */
export function flattenFeed(data: InfiniteData<FeedResponse> | undefined): FeedItem[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

export interface ArticlePatch {
  is_read?: boolean;
  is_bookmarked?: boolean;
  user_rank_override?: number | null;
  user_feedback?: 'up' | 'down' | null;
}

export function usePatchArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: ArticlePatch }) =>
      (await api.patch(`/api/articles/${vars.id}`, vars.patch)).data,
    // Optimistically patch every cached feed page so the UI feels instant.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const snapshots = qc.getQueriesData<InfiniteData<FeedResponse>>({ queryKey: ['feed'] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<InfiniteData<FeedResponse>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((it) =>
              it.classification_id === vars.id ? { ...it, ...vars.patch } : it),
          })),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}
