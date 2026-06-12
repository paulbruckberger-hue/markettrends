import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AdminUser, AdminWatchItem, AppConfig, PlanTier, UserInvite, WatchType } from '../types';

// ── Config ──────────────────────────────────────────────────────────────────

export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin-config'],
    queryFn: async () => (await api.get<AppConfig>('/api/admin/config')).data,
  });
}

export function useUpdateAdminConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppConfig>) =>
      (await api.put<AppConfig>('/api/admin/config', patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-config'] }),
  });
}

// ── Users ────────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<AdminUser[]>('/api/admin/users')).data,
  });
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  role: 'admin' | 'user';
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await api.post<AdminUser>('/api/admin/users', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export interface UpdateUserPatch {
  is_active?: boolean;
  role?: 'admin' | 'user';
  email?: string | null;
  plan?: PlanTier;
  is_comp?: boolean;
  keyword_bonus?: number;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: UpdateUserPatch }) =>
      (await api.put<AdminUser>(`/api/admin/users/${vars.id}`, vars.patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (vars: { id: string; password: string }) =>
      (await api.post(`/api/admin/users/${vars.id}/reset-password`, { password: vars.password })).data,
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/admin/users/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

// ── Einladungen ───────────────────────────────────────────────────────────────

export function useInvites() {
  return useQuery({
    queryKey: ['admin-invites'],
    queryFn: async () => (await api.get<UserInvite[]>('/api/admin/invites')).data,
  });
}

export interface CreateInviteInput {
  email: string;
  role?: 'admin' | 'user';
  plan?: PlanTier;
  keyword_bonus?: number;
}

export interface CreateInviteResult {
  invite: UserInvite;
  emailed: boolean;
  accept_url: string;
  email_error?: string;
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInviteInput) =>
      (await api.post<CreateInviteResult>('/api/admin/invites', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invites'] }),
  });
}

export function useDeleteInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/admin/invites/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invites'] }),
  });
}

// ── Keywords eines Users verwalten ─────────────────────────────────────────────

export function useUserWatchlist(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-watchlist', userId],
    queryFn: async () => (await api.get<AdminWatchItem[]>(`/api/admin/users/${userId}/watchlist`)).data,
    enabled: !!userId,
  });
}

export function useAddUserWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; type: WatchType; query: string }) =>
      (await api.post(`/api/admin/users/${vars.userId}/watchlist`, { type: vars.type, query: vars.query })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-user-watchlist', vars.userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useDeleteUserWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; itemId: string }) =>
      (await api.delete(`/api/admin/users/${vars.userId}/watchlist/${vars.itemId}`)).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-user-watchlist', vars.userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

// ── Rerank (re-rank existing articles with current prompt + per-user ranks) ───

export interface RerankProgress { total: number; done: number; remaining: number; version: number }
export interface RerankBatchResult { processed: number; personalised: number; remaining: number; done: boolean }

export function useRerankStatus() {
  return useQuery({
    queryKey: ['admin-rerank'],
    queryFn: async () => (await api.get<RerankProgress>('/api/admin/rerank')).data,
  });
}

export function useRerankBatch() {
  const qc = useQueryClient();
  return useMutation<RerankBatchResult, Error, number>({
    mutationFn: async (limit: number) =>
      (await api.post<RerankBatchResult>('/api/admin/rerank', { limit })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rerank'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
