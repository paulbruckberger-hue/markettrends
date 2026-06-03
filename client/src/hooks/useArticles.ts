import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FeedResponse } from '../types';

export interface FeedFilters {
  rank?: number;
  watch_item_id?: string;
  source_type?: string;
  period?: string;
  search?: string;
}

function cleanParams(filters: FeedFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (filters.rank) out.rank = filters.rank;
  if (filters.watch_item_id) out.watch_item_id = filters.watch_item_id;
  if (filters.source_type) out.source_type = filters.source_type;
  if (filters.period) out.period = filters.period;
  if (filters.search && filters.search.trim()) out.search = filters.search.trim();
  return out;
}

export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: ['feed', filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = { ...cleanParams(filters), page: pageParam, limit: 20 };
      return (await api.get<FeedResponse>('/api/articles', { params })).data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export interface ArticlePatch {
  is_read?: boolean;
  is_bookmarked?: boolean;
  user_rank_override?: number | null;
}

export function usePatchArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: ArticlePatch }) =>
      (await api.patch(`/api/articles/${vars.id}`, vars.patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}
