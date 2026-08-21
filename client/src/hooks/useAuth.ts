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
      // Die Login-Antwort enthält nur id/username/role — ohne onboarding_completed,
      // plan und entitlements. Ohne dieses Nachladen hielte die App das Onboarding
      // für offen und zeigte bestehenden Nutzern erneut die Einrichtung.
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) =>
      (await api.post<{ token: string; user: AuthUser }>('/api/auth/register', vars)).data,
    onSuccess: (data) => {
      setToken(data.token);
      qc.setQueryData(['me'], data.user);
      qc.invalidateQueries({ queryKey: ['me'] }); // vollständiges /me (plan, entitlements) nachladen
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { token: string; password: string }) =>
      (await api.post<{ token: string; user: AuthUser }>('/api/auth/accept-invite', vars)).data,
    onSuccess: (data) => {
      setToken(data.token);
      qc.setQueryData(['me'], data.user);
      qc.invalidateQueries({ queryKey: ['me'] });
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

/** Persistiert „Onboarding erledigt" serverseitig (erscheint danach nie wieder). */
export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/api/auth/onboarding/complete')).data,
    // Optimistisch im Cache setzen, damit das Onboarding sofort verschwindet,
    // auch bevor /me neu geladen ist.
    onMutate: () => {
      qc.setQueryData<AuthUser>(['me'], (prev) =>
        prev ? { ...prev, onboarding_completed: true } : prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export const isLoggedIn = (): boolean => !!getToken();
