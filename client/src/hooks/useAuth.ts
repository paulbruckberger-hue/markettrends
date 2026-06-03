import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clearToken, getToken, setToken } from '../lib/api';
import { AuthUser } from '../types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ user: AuthUser }>('/api/auth/me')).data.user,
    enabled: !!getToken(),
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { username: string; password: string }) =>
      (await api.post<{ token: string; user: AuthUser }>('/api/auth/login', vars)).data,
    onSuccess: (data) => {
      setToken(data.token);
      qc.setQueryData(['me'], data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    clearToken();
    qc.clear();
    window.location.href = '/login';
  };
}

export const isLoggedIn = (): boolean => !!getToken();
