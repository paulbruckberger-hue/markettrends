import { users } from '../db/schema';

/**
 * Single source of truth für das Freemium-Modell (Quota nach Keyword-Anzahl).
 * Verwendet von: Watchlist-Quota-Check (routes/watchlist.ts), Admin-Anzeige
 * (routes/admin.ts) und GET /api/auth/me.
 *
 * Plan-Stufen (plan_tier enum):
 *   free → 1, plus (€4,99) → 3, pro (€9,99) → 10
 * Übersteuerungen:
 *   - Admin:        unbegrenzt
 *   - is_comp:      gratis freigeschaltet → Pro-Rechte ohne Stripe-Abo
 *   - keyword_bonus: zusätzliche Gratis-Keywords ON TOP der Plan-Quota
 */

export type PlanTier = 'free' | 'plus' | 'pro';
export type DbUser = typeof users.$inferSelect;

/** Keyword-Quota je Plan. Hier zentral ändern, um Tarif-Limits anzupassen. */
export const PLAN_QUOTA: Record<PlanTier, number> = {
  free: 1,
  plus: 3,
  pro: 10,
};

/** Monatspreis in EUR je kostenpflichtigem Plan (Anzeige; Stripe ist führend). */
export const PLAN_PRICE_EUR: Record<Exclude<PlanTier, 'free'>, number> = {
  plus: 4.99,
  pro: 9.99,
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  free: 'Gratis',
  plus: 'Plus',
  pro: 'Pro',
};

export const UNLIMITED = Number.POSITIVE_INFINITY;

/** Felder, die zur Entitlement-Berechnung nötig sind (volle Users-Row ⊇ davon). */
type EntInput = Pick<DbUser, 'role' | 'plan' | 'is_comp' | 'keyword_bonus'>;

/** Wirksamer Plan: comp zählt wie 'pro'. */
export function effectivePlan(u: EntInput): PlanTier {
  return u.is_comp ? 'pro' : u.plan;
}

/** Erlaubte Anzahl aktiver Keywords (watch_items). Admin = unbegrenzt. */
export function keywordQuota(u: EntInput): number {
  if (u.role === 'admin') return UNLIMITED;
  return PLAN_QUOTA[effectivePlan(u)] + (u.keyword_bonus ?? 0);
}

export function isUnlimited(quota: number): boolean {
  return !Number.isFinite(quota);
}

export interface Entitlements {
  plan: PlanTier;
  effective_plan: PlanTier;
  quota: number | null;     // null = unbegrenzt (Infinity ist nicht JSON-fähig)
  unlimited: boolean;
  is_comp: boolean;
  is_admin: boolean;
  keyword_bonus: number;
}

/** JSON-taugliches Entitlement-Objekt für API-Antworten (z.B. /me, Admin). */
export function entitlementsFor(u: EntInput): Entitlements {
  const quota = keywordQuota(u);
  const unlimited = isUnlimited(quota);
  return {
    plan: u.plan,
    effective_plan: effectivePlan(u),
    quota: unlimited ? null : quota,
    unlimited,
    is_comp: !!u.is_comp,
    is_admin: u.role === 'admin',
    keyword_bonus: u.keyword_bonus ?? 0,
  };
}

/**
 * Darf der User ein NEUES aktives Keyword anlegen?
 * @param activeCount aktuell aktive watch_items des Users.
 */
export function canAddKeyword(u: EntInput, activeCount: number): boolean {
  return activeCount < keywordQuota(u);
}
