import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Overview, SourcesResponse, WatchAnalytics } from '../types';

export function useOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get<Overview>('/api/analytics/overview')).data,
  });
}

export function useWatchAnalytics(watchItemId: string | null) {
  return useQuery({
    queryKey: ['analytics', 'watchitem', watchItemId],
    queryFn: async () => (await api.get<WatchAnalytics>(`/api/analytics/watchitem/${watchItemId}`)).data,
    enabled: !!watchItemId,
  });
}

export function useSourcesAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'sources'],
    queryFn: async () => (await api.get<SourcesResponse>('/api/analytics/sources')).data,
  });
}
