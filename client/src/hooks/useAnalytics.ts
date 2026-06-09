import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Overview, SourcesResponse, SuggestionsResponse, TodayResponse, TrendsResponse, WatchAnalytics, WatchType,
} from '../types';

// Auto-refresh cadence so the app feels live without manual reloads.
const LIVE_REFETCH = 5 * 60_000;

export function useOverview(period?: number) {
  return useQuery({
    queryKey: ['analytics', 'overview', period ?? 14],
    queryFn: async () => (await api.get<Overview>('/api/analytics/overview', { params: period ? { period } : {} })).data,
    refetchInterval: LIVE_REFETCH,
  });
}

export function useWatchAnalytics(watchItemId: string | null, period?: number) {
  return useQuery({
    queryKey: ['analytics', 'watchitem', watchItemId, period ?? 30],
    queryFn: async () => (await api.get<WatchAnalytics>(`/api/analytics/watchitem/${watchItemId}`, { params: period ? { period } : {} })).data,
    enabled: !!watchItemId,
  });
}

export function useTrends(period: number, type?: WatchType | 'all') {
  return useQuery({
    queryKey: ['analytics', 'trends', period, type ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { period };
      if (type && type !== 'all') params.type = type;
      return (await api.get<TrendsResponse>('/api/analytics/trends', { params })).data;
    },
    refetchInterval: LIVE_REFETCH,
  });
}

export function useToday() {
  return useQuery({
    queryKey: ['analytics', 'today'],
    queryFn: async () => (await api.get<TodayResponse>('/api/analytics/today')).data,
    refetchInterval: LIVE_REFETCH,
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: ['analytics', 'suggestions'],
    queryFn: async () => (await api.get<SuggestionsResponse>('/api/analytics/suggestions')).data,
    staleTime: 10 * 60_000,
  });
}

export function useSourcesAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'sources'],
    queryFn: async () => (await api.get<SourcesResponse>('/api/analytics/sources')).data,
  });
}
