import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CompetitorAnalysis } from '../types';

export function useCompetitor(watchItemId: string | null) {
  return useQuery({
    queryKey: ['competitor', watchItemId],
    queryFn: async () =>
      (await api.get<CompetitorAnalysis>(`/api/analytics/competitor/${watchItemId}`)).data,
    enabled: !!watchItemId,
    staleTime: 5 * 60_000,
  });
}
