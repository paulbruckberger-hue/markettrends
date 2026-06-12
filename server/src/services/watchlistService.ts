import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { search_terms, watch_items, users } from '../db/schema';
import { normalizeQuery } from '../lib/hash';
import { keywordQuota } from '../lib/entitlements';
import { GeoFilter, SourcesConfig, WatchType } from '../types';

/**
 * Gemeinsame Watchlist-Logik (search_term-Dedup + User-Abo + Aktiv-Neuberechnung).
 * Wird sowohl von der End-User-Route (routes/watchlist.ts, mit Quota) als auch von
 * der Admin-„User-Keywords"-Route (routes/admin.ts, ohne Quota) genutzt.
 */

const DEFAULT_SOURCES: SourcesConfig = {
  linkedin_posts: true, linkedin_company_page: false,
  google_news: true, rss: true, newsroom: false,
};

/** Geworfen, wenn ein neues aktives Keyword die Tarif-Quota überschreiten würde. */
export class QuotaExceededError extends Error {
  constructor(public quota: number, public plan: string) {
    super('Keyword-Quota erreicht');
    this.name = 'QuotaExceededError';
  }
}

/** Nach jeder Abo-Änderung: search_term ist aktiv, sobald ≥1 aktives Abo existiert. */
export async function recomputeTermActive(searchTermId: string): Promise<void> {
  const active = await db.select({ id: watch_items.id })
    .from(watch_items)
    .where(and(eq(watch_items.search_term_id, searchTermId), eq(watch_items.is_active, true)));
  await db.update(search_terms)
    .set({ is_active: active.length > 0 })
    .where(eq(search_terms.id, searchTermId));
}

/** Anzahl aktiver Abos des Users (Basis des Quota-Checks + used-Anzeige). */
export async function activeWatchCount(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(watch_items)
    .where(and(eq(watch_items.user_id, userId), eq(watch_items.is_active, true)));
  return Number(row?.cnt ?? 0);
}

export interface AddWatchInput {
  type: WatchType;
  query: string;
  geo_filter?: GeoFilter;
  display_name?: string;
  label?: string | null;
  color?: string;
  sources_config?: Partial<SourcesConfig>;
  company_linkedin_id?: string | null;
  company_newsroom_url?: string | null;
  company_domain?: string | null;
}

export interface AddWatchResult {
  watchItem: typeof watch_items.$inferSelect;
  term: typeof search_terms.$inferSelect;
  created: boolean;
}

/**
 * Legt ein (dedupliziertes) Abo des Users auf einen Suchbegriff an bzw. reaktiviert es.
 * @param enforceQuota true (End-User): wirft QuotaExceededError, wenn ein NEUES aktives
 *        Abo die Keyword-Quota überschreitet. false (Admin): keine Begrenzung.
 */
export async function addWatch(
  userId: string,
  input: AddWatchInput,
  opts: { enforceQuota?: boolean } = {},
): Promise<AddWatchResult> {
  const query = (input.query ?? '').trim();
  const geo_filter: GeoFilter = ['global', 'dach', 'austria'].includes(input.geo_filter as string)
    ? (input.geo_filter as GeoFilter) : 'global';
  const query_normalized = normalizeQuery(query);
  const sources_config: SourcesConfig = { ...DEFAULT_SOURCES, ...(input.sources_config ?? {}) };

  // 1+2. Geteilten search_term upserten (Dedup auf type+query+geo).
  const [term] = await db.insert(search_terms).values({
    type: input.type,
    query_normalized,
    query_display: query,
    geo_filter,
    sources_config,
    company_linkedin_id: input.type === 'company' ? (input.company_linkedin_id ?? null) : null,
    company_newsroom_url: input.type === 'company' ? (input.company_newsroom_url ?? null) : null,
    company_domain: input.type === 'company' ? (input.company_domain ?? null) : null,
    is_active: true,
  }).onConflictDoUpdate({
    target: [search_terms.type, search_terms.query_normalized, search_terms.geo_filter],
    set: { is_active: true },
  }).returning();

  // Schon abonniert? Reaktivierung eines inaktiven Abos belegt ebenfalls einen Slot.
  const [existing] = await db.select().from(watch_items)
    .where(and(eq(watch_items.user_id, userId), eq(watch_items.search_term_id, term.id)));
  const wouldBeNewActive = !existing || !existing.is_active;

  // 2a. Quota-Vorprüfung (nur für echte Neu-Aktivierungen).
  if (opts.enforceQuota && wouldBeNewActive) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const quota = keywordQuota(user);
    if (Number.isFinite(quota)) {
      const active = await activeWatchCount(userId);
      if (active >= quota) throw new QuotaExceededError(quota, user?.plan ?? 'free');
    }
  }

  // 3. Abo anlegen oder reaktivieren.
  let watchItem: typeof watch_items.$inferSelect;
  if (!existing) {
    const [created] = await db.insert(watch_items).values({
      user_id: userId,
      search_term_id: term.id,
      display_name: input.display_name?.trim() || query,
      label: typeof input.label === 'string' ? input.label : null,
      color: typeof input.color === 'string' ? input.color : '#3B82F6',
      is_active: true,
    }).returning();
    watchItem = created;
  } else {
    const [updated] = await db.update(watch_items)
      .set({ is_active: true })
      .where(and(eq(watch_items.user_id, userId), eq(watch_items.search_term_id, term.id)))
      .returning();
    watchItem = updated;
  }

  await recomputeTermActive(term.id);
  return { watchItem, term, created: !existing };
}
