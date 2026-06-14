import { Router, Response } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { search_terms, watch_items, job_runs } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { triggerCollector } from '../lib/jobTrigger';
import { addWatch, recomputeTermActive, QuotaExceededError } from '../services/watchlistService';
import { WatchType } from '../types';

export const watchlistRouter = Router();
watchlistRouter.use(authMiddleware);

// GET /api/watchlist
watchlistRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const rows = await db.select({
    id: watch_items.id,
    display_name: watch_items.display_name,
    label: watch_items.label,
    color: watch_items.color,
    cluster_id: watch_items.cluster_id,
    is_active: watch_items.is_active,
    schedule_interval: watch_items.schedule_interval,
    context_hint: watch_items.context_hint,
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

  // Per-watch aggregates: total signals, unread, 15-day momentum.
  const uid = req.user!.id;
  const aggRows = (await db.execute(sql`
    SELECT wi.id AS watch_item_id,
      count(c.id)::int AS signals,
      count(c.id) FILTER (WHERE uas.is_read IS NOT TRUE)::int AS unread,
      count(c.id) FILTER (WHERE COALESCE(a.published_at, a.created_at) >= now() - interval '15 days')::int AS recent,
      count(c.id) FILTER (WHERE COALESCE(a.published_at, a.created_at) >= now() - interval '30 days'
                            AND COALESCE(a.published_at, a.created_at) < now() - interval '15 days')::int AS prior
    FROM watch_items wi
    LEFT JOIN classifications c ON c.search_term_id = wi.search_term_id
    LEFT JOIN articles a ON a.id = c.article_id
    LEFT JOIN user_article_state uas ON uas.classification_id = c.id AND uas.user_id = ${uid}
    WHERE wi.user_id = ${uid}
    GROUP BY wi.id`)).rows as Array<Record<string, unknown>>;

  const n = (v: unknown): number => (typeof v === 'number' ? v : parseInt(String(v ?? 0), 10) || 0);
  const aggMap = new Map<string, { signals: number; unread: number; momentum: number }>();
  for (const r of aggRows) {
    const recent = n(r.recent), prior = n(r.prior);
    const momentum = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : (recent > 0 ? 100 : 0);
    aggMap.set(String(r.watch_item_id), { signals: n(r.signals), unread: n(r.unread), momentum });
  }

  res.json(rows.map((r) => ({ ...r, ...(aggMap.get(r.id) ?? { signals: 0, unread: 0, momentum: 0 }) })));
});

// POST /api/watchlist  → dedupliziertes search_term + User-Abo (mit Tarif-Quota)
watchlistRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const type = b.type as WatchType;
  const query = typeof b.query === 'string' ? b.query : '';
  if ((type !== 'topic' && type !== 'company') || !query.trim()) {
    res.status(400).json({ error: 'type (topic|company) und query erforderlich' });
    return;
  }
  try {
    const { watchItem, term } = await addWatch(req.user!.id, {
      type, query,
      geo_filter: b.geo_filter,
      display_name: typeof b.display_name === 'string' ? b.display_name : undefined,
      label: typeof b.label === 'string' ? b.label : undefined,
      color: typeof b.color === 'string' ? b.color : undefined,
      sources_config: b.sources_config,
      company_linkedin_id: b.company_linkedin_id,
      company_newsroom_url: b.company_newsroom_url,
      company_domain: b.company_domain,
    }, { enforceQuota: true });
    res.status(201).json({ ...watchItem, search_term: term });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      res.status(402).json({
        error: `Dein Tarif erlaubt ${err.quota} aktive${err.quota === 1 ? 's' : ''} Keyword${err.quota === 1 ? '' : 's'}. Upgrade für mehr.`,
        code: 'quota_exceeded', quota: err.quota, plan: err.plan,
      });
      return;
    }
    throw err;
  }
});

// PUT /api/watchlist/:id
watchlistRouter.put('/:id', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof b.display_name === 'string') patch.display_name = b.display_name.trim();
  if (typeof b.label === 'string') patch.label = b.label;
  if (typeof b.color === 'string') patch.color = b.color;
  if (b.cluster_id === null || typeof b.cluster_id === 'string') patch.cluster_id = b.cluster_id;
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (b.context_hint !== undefined) patch.context_hint = typeof b.context_hint === 'string' ? b.context_hint.trim() || null : null;
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
// NUR Admins: ein manueller Abruf (und erst recht ein historischer Lookback) löst
// kostenpflichtige Apify-Scrapes aus. Normale User sehen Content ausschließlich
// aus den geplanten Scraper-Intervallen — sie warten nach der Registrierung auf
// den nächsten Lauf.
watchlistRouter.post('/:id/run', async (req: AuthedRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Manueller Abruf ist Admins vorbehalten. Neue Signale erscheinen automatisch beim nächsten geplanten Lauf.' });
    return;
  }
  const [wi] = await db.select().from(watch_items)
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, req.user!.id)));
  if (!wi) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  const rawLookback = req.body?.lookback_days;
  const lookbackDays = typeof rawLookback === 'number' && rawLookback > 0 ? rawLookback : undefined;
  const { mode } = await triggerCollector(wi.search_term_id, lookbackDays);
  res.status(202).json({ triggered: true, mode, search_term_id: wi.search_term_id, lookback_days: lookbackDays ?? null });
});

// PUT /api/watchlist/:id/schedule  → set schedule_interval per watch-item
watchlistRouter.put('/:id/schedule', async (req: AuthedRequest, res: Response) => {
  const VALID = [null, 'manual', '1h', '2h', '3h', '6h', '12h', '24h', '48h', '168h'];
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
