import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AdminUser, AppConfig } from '../types';

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

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Pick<AdminUser, 'is_active' | 'role' | 'email'>> }) =>
      (await api.put<AdminUser>(`/api/admin/users/${vars.id}`, vars.patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
