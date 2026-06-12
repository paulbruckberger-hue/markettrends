import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../lib/api';
import { GeoFilter, RunStatus, ScheduleInterval, WatchItem, WatchType } from '../types';

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
    onError: (err) => {
      // Tarif-Quota erreicht → globales Upgrade-Sheet öffnen (QuotaUpgradeListener).
      if (axios.isAxiosError(err) && err.response?.status === 402) {
        const data = err.response.data as { code?: string; error?: string };
        if (data?.code === 'quota_exceeded') {
          window.dispatchEvent(new CustomEvent('nl:upgrade', { detail: data.error }));
        }
      }
    },
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lookback_days }: { id: string; lookback_days?: number }) =>
      (await api.post(`/api/watchlist/${id}/run`, lookback_days ? { lookback_days } : {})).data,
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['run-status', vars.id] });
    },
  });
}

export function useSetSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; interval: ScheduleInterval }) =>
      (await api.put(`/api/watchlist/${vars.id}/schedule`, { schedule_interval: vars.interval })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useRunStatus(watchItemId: string | null, options: { enabled: boolean; fastPoll?: boolean }) {
  return useQuery({
    queryKey: ['run-status', watchItemId],
    queryFn: async () => (await api.get<RunStatus>(`/api/watchlist/${watchItemId}/run-status`)).data,
    enabled: options.enabled && !!watchItemId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (options.fastPoll) return 2000;           // just triggered – poll fast
      if (s === 'running') return 2000;             // running – poll fast
      return false;                                 // idle/done – no auto-poll
    },
    staleTime: 0,
  });
}
