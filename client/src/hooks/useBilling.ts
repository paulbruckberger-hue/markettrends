import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PlanTier } from '../types';

export interface BillingPlan {
  id: PlanTier;
  label: string;
  price_eur: number;
  quota: number;
  purchasable: boolean;
}

export interface PlansResponse {
  enabled: boolean;
  plans: BillingPlan[];
}

export function usePlans() {
  return useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => (await api.get<PlansResponse>('/api/billing/plans')).data,
  });
}

/** Startet Stripe-Checkout und leitet bei Erfolg direkt weiter. */
export function useCheckout() {
  return useMutation({
    mutationFn: async (plan: PlanTier) =>
      (await api.post<{ url: string }>('/api/billing/checkout', { plan })).data,
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });
}

/** Öffnet das Stripe-Kundenportal (Abo verwalten/kündigen). */
export function usePortal() {
  return useMutation({
    mutationFn: async () => (await api.post<{ url: string }>('/api/billing/portal')).data,
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });
}
