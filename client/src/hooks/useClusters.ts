import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { NewsletterCluster, SuggestedCluster } from '../types';

interface ClustersResponse {
  clusters: NewsletterCluster[];
  unassigned_count: number;
}

export function useClusters() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: async () => (await api.get<ClustersResponse>('/api/clusters')).data,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['clusters'] });
  void qc.invalidateQueries({ queryKey: ['watchlist'] });
}

export function useCreateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) =>
      (await api.post<NewsletterCluster>('/api/clusters', input)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<NewsletterCluster>) =>
      (await api.put<NewsletterCluster>(`/api/clusters/${id}`, patch)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/clusters/${id}`)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useAssignWatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { cluster_id: string | null; watch_item_ids: string[] }) =>
      (await api.post('/api/clusters/assign', vars)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useSuggestClusters() {
  return useMutation({
    mutationFn: async () => (await api.get<{ suggestions: SuggestedCluster[] }>('/api/clusters/suggest')).data.suggestions,
  });
}

export function useApplySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clusters: SuggestedCluster[]) =>
      (await api.post('/api/clusters/apply-suggestion', { clusters })).data,
    onSuccess: () => invalidate(qc),
  });
}
