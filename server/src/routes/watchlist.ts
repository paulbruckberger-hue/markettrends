import { Router, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { search_terms, watch_items, job_runs } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { normalizeQuery } from '../lib/hash';
import { triggerCollector } from '../lib/jobTrigger';
import { GeoFilter, SourcesConfig, WatchType } from '../types';

export const watchlistRouter = Router();
watchlistRouter.use(authMiddleware);

const DEFAULT_SOURCES: SourcesConfig = {
  linkedin_posts: true, linkedin_company_page: false,
  google_news: true, rss: true, newsroom: false,
};

/** After any subscription change, a term is active iff ≥1 active abo exists. */
async function recomputeTermActive(searchTermId: string): Promise<void> {
  const active = await db.select({ id: watch_items.id })
    .from(watch_items)
    .where(and(eq(watch_items.search_term_id, searchTermId), eq(watch_items.is_active, true)));
  await db.update(search_terms)
    .set({ is_active: active.length > 0 })
    .where(eq(search_terms.id, searchTermId));
}

// GET /api/watchlist
watchlistRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const rows = await db.select({
    id: watch_items.id,
    display_name: watch_items.display_name,
    label: watch_items.label,
    color: watch_items.color,
    is_active: watch_items.is_active,
    schedule_interval: watch_items.schedule_interval,
    created_at: watch_items.created_at,
    search_term_id: search_terms.id,
    type: search_terms.type,
    query_display: search_terms.query_display,
    geo_filter: search_terms.geo_filter,
    sources_config: search_terms.sources_config,
    company_linkedin_id: search_terms.company_linkedin_id,
    company_newsroom_url: search_terms.company_newsroom_url,
    company_domain: search_terms.company_domain,
    last_run_at: search_terms.last_run_at,
  })
    .from(watch_items)
    .innerJoin(search_terms, eq(watch_items.search_term_id, search_terms.id))
    .where(eq(watch_items.user_id, req.user!.id))
    .orderBy(desc(watch_items.created_at));
  res.json(rows);
});

// POST /api/watchlist  → dedupliziertes search_term + User-Abo
watchlistRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const type = b.type as WatchType;
  const query = typeof b.query === 'string' ? b.query : '';
  if ((type !== 'topic' && type !== 'company') || !query.trim()) {
    res.status(400).json({ error: 'type (topic|company) und query erforderlich' });
    return;
  }

  const geo_filter: GeoFilter = ['global', 'dach', 'austria'].includes(b.geo_filter) ? b.geo_filter : 'global';
  const query_normalized = normalizeQuery(query);
  const sources_config: SourcesConfig = { ...DEFAULT_SOURCES, ...(b.sources_config ?? {}) };

  // 1+2. Upsert shared search_term (dedup on type+query+geo). Reuses existing row.
  const [term] = await db.insert(search_terms).values({
    type,
    query_normalized,
    query_display: query.trim(),
    geo_filter,
    sources_config,
    company_linkedin_id: type === 'company' ? (b.company_linkedin_id ?? null) : null,
    company_newsroom_url: type === 'company' ? (b.company_newsroom_url ?? null) : null,
    company_domain: type === 'company' ? (b.company_domain ?? null) : null,
    is_active: true,
  }).onConflictDoUpdate({
    target: [search_terms.type, search_terms.query_normalized, search_terms.geo_filter],
    set: { is_active: true },
  }).returning();

  // 3. Create the user's subscription (idempotent).
  const [created] = await db.insert(watch_items).values({
    user_id: req.user!.id,
    search_term_id: term.id,
    display_name: typeof b.display_name === 'string' && b.display_name.trim() ? b.display_name.trim() : query.trim(),
    label: typeof b.label === 'string' ? b.label : null,
    color: typeof b.color === 'string' ? b.color : '#3B82F6',
    is_active: true,
  }).onConflictDoNothing({ target: [watch_items.user_id, watch_items.search_term_id] }).returning();

  let watchItem = created;
  if (!watchItem) {
    // Already subscribed — return the existing (re-activate if needed).
    const [existing] = await db.update(watch_items)
      .set({ is_active: true })
      .where(and(eq(watch_items.user_id, req.user!.id), eq(watch_items.search_term_id, term.id)))
      .returning();
    watchItem = existing;
  }

  await recomputeTermActive(term.id);
  res.status(201).json({ ...watchItem, search_term: term });
});

// PUT /api/watchlist/:id
watchlistRouter.put('/:id', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof b.display_name === 'string') patch.display_name = b.display_name.trim();
  if (typeof b.label === 'string') patch.label = b.label;
  if (typeof b.color === 'string') patch.color = b.color;
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Keine gültigen Felder' });
    return;
  }

  const [updated] = await db.update(watch_items)
    .set(patch)
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, req.user!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  await recomputeTermActive(updated.search_term_id);
  res.json(updated);
});

// DELETE /api/watchlist/:id
watchlistRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const [deleted] = await db.delete(watch_items)
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, req.user!.id)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  await recomputeTermActive(deleted.search_term_id);
  res.json({ success: true });
});

// POST /api/watchlist/:id/run  → triggert Collection für diesen search_term
watchlistRouter.post('/:id/run', async (req: AuthedRequest, res: Response) => {
  const [wi] = await db.select().from(watch_items)
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, req.user!.id)));
  if (!wi) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  const { mode } = await triggerCollector(wi.search_term_id);
  res.status(202).json({ triggered: true, mode, search_term_id: wi.search_term_id });
});

// PUT /api/watchlist/:id/schedule  → set schedule_interval per watch-item
watchlistRouter.put('/:id/schedule', async (req: AuthedRequest, res: Response) => {
  const VALID = [null, 'manual', '6h', '12h', '24h', '48h', '168h'];
  const interval: string | null = req.body?.schedule_interval ?? null;
  if (!VALID.includes(interval)) {
    res.status(400).json({ error: `Ungültiges Intervall. Erlaubt: ${VALID.filter(Boolean).join(', ')} oder null` });
    return;
  }
  const [updated] = await db.update(watch_items)
    .set({ schedule_interval: interval })
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, req.user!.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  res.json(updated);
});

// GET /api/watchlist/:id/run-status  → letzter Job-Run für den search_term
watchlistRouter.get('/:id/run-status', async (req: AuthedRequest, res: Response) => {
  const [wi] = await db.select().from(watch_items)
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, req.user!.id)));
  if (!wi) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  const [run] = await db.select().from(job_runs)
    .where(eq(job_runs.search_term_id, wi.search_term_id))
    .orderBy(desc(job_runs.started_at))
    .limit(1);
  if (!run) {
    res.json({ status: 'idle' });
    return;
  }
  res.json({
    status: run.status,
    articles_found: run.articles_found,
    articles_new: run.articles_new,
    classifications_new: run.classifications_new,
    error_message: run.error_message,
    started_at: run.started_at,
    completed_at: run.completed_at,
  });
});
