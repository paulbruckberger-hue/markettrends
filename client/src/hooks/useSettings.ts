import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AppSettings } from '../types';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<AppSettings>('/api/settings')).data,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => (await api.put<AppSettings>('/api/settings', patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export interface TestResult { ok: boolean; message: string; model?: string }

export function useTestAi() {
  return useMutation({ mutationFn: async () => (await api.post<TestResult>('/api/settings/test-ai')).data });
}
export function useTestTelegram() {
  return useMutation({ mutationFn: async () => (await api.post<TestResult>('/api/settings/test-telegram')).data });
}
export function useTestEmail() {
  return useMutation({ mutationFn: async () => (await api.post<TestResult>('/api/settings/test-email')).data });
}
export function useSendDigest() {
  return useMutation({ mutationFn: async () => (await api.post<{ sent: boolean; message: string }>('/api/digest/send')).data });
}

/** Fetch the digest preview HTML (with auth) and open it in a new window. */
export async function openDigestPreview(): Promise<void> {
  const { data } = await api.get<string>('/api/digest/preview', { responseType: 'text' });
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(data); w.document.close(); }
}
