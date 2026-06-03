import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { GeoFilter, RunStatus, WatchItem, WatchType } from '../types';

export interface CreateWatchInput {
  type: WatchType;
  query: string;
  display_name?: string;
  label?: string;
  color?: string;
  geo_filter?: GeoFilter;
  company_linkedin_id?: string;
  company_newsroom_url?: string;
  company_domain?: string;
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => (await api.get<WatchItem[]>('/api/watchlist')).data,
  });
}

export function useCreateWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWatchInput) => (await api.post('/api/watchlist', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useDeleteWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/watchlist/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useRunWatch() {
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/watchlist/${id}/run`)).data,
  });
}

export function useRunStatus(watchItemId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['run-status', watchItemId],
    queryFn: async () => (await api.get<RunStatus>(`/api/watchlist/${watchItemId}/run-status`)).data,
    enabled: enabled && !!watchItemId,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}
