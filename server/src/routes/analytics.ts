import { Router, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { rss_sources, search_terms, watch_items } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> => (await db.execute(q)).rows as Row[];
const num = (v: unknown): number => (typeof v === 'number' ? v : parseInt(String(v ?? 0), 10) || 0);

// GET /api/analytics/overview
analyticsRouter.get('/overview', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;

  const [rankRows, sourceRows, sentimentRows, volumeRows, stateRows, watchRows] = await Promise.all([
    rows(sql`SELECT c.rank::int AS rank, count(*)::int AS n
             FROM watch_items wi JOIN classifications c ON c.search_term_id = wi.search_term_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true GROUP BY c.rank`),
    rows(sql`SELECT a.source_type AS source_type, count(*)::int AS n
             FROM watch_items wi JOIN classifications c ON c.search_term_id = wi.search_term_id
             JOIN articles a ON a.id = c.article_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true GROUP BY a.source_type ORDER BY n DESC`),
    rows(sql`SELECT COALESCE(c.sentiment::text,'neutral') AS sentiment, count(*)::int AS n
             FROM watch_items wi JOIN classifications c ON c.search_term_id = wi.search_term_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true GROUP BY c.sentiment`),
    rows(sql`SELECT to_char(date_trunc('day', COALESCE(a.published_at, a.created_at)),'YYYY-MM-DD') AS d, count(*)::int AS n
             FROM watch_items wi JOIN classifications c ON c.search_term_id = wi.search_term_id
             JOIN articles a ON a.id = c.article_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true
               AND COALESCE(a.published_at, a.created_at) >= now() - interval '14 days'
             GROUP BY 1 ORDER BY 1`),
    rows(sql`SELECT
               count(*) FILTER (WHERE uas.is_read)::int AS read,
               count(*) FILTER (WHERE uas.is_bookmarked)::int AS bookmarked
             FROM user_article_state uas WHERE uas.user_id = ${uid}`),
    rows(sql`SELECT count(*)::int AS n FROM watch_items WHERE user_id = ${uid} AND is_active = true`),
  ]);

  const byRank: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
  let total = 0;
  for (const r of rankRows) { byRank[String(num(r.rank))] = num(r.n); total += num(r.n); }

  const bySentiment: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const r of sentimentRows) bySentiment[String(r.sentiment)] = num(r.n);

  res.json({
    total,
    watchCount: num(watchRows[0]?.n),
    byRank,
    bySource: sourceRows.map((r) => ({ source_type: r.source_type, n: num(r.n) })),
    bySentiment,
    volume: volumeRows.map((r) => ({ date: r.d, n: num(r.n) })),
    read: num(stateRows[0]?.read),
    bookmarked: num(stateRows[0]?.bookmarked),
  });
});

// GET /api/analytics/watchitem/:id
analyticsRouter.get('/watchitem/:id', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;
  const [wi] = await db.select({
    id: watch_items.id,
    display_name: watch_items.display_name,
    search_term_id: watch_items.search_term_id,
    type: search_terms.type,
  }).from(watch_items)
    .innerJoin(search_terms, eq(search_terms.id, watch_items.search_term_id))
    .where(and(eq(watch_items.id, req.params.id), eq(watch_items.user_id, uid)));
  if (!wi) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  const termId = wi.search_term_id;

  const [volume, sentiment, topSources, topAuthors, coTags, signalTypes] = await Promise.all([
    rows(sql`SELECT to_char(date_trunc('day', COALESCE(a.published_at,a.created_at)),'YYYY-MM-DD') AS d, count(*)::int AS n
             FROM classifications c JOIN articles a ON a.id = c.article_id
             WHERE c.search_term_id = ${termId} AND COALESCE(a.published_at,a.created_at) >= now() - interval '30 days'
             GROUP BY 1 ORDER BY 1`),
    rows(sql`SELECT COALESCE(c.sentiment::text,'neutral') AS sentiment, count(*)::int AS n
             FROM classifications c WHERE c.search_term_id = ${termId} GROUP BY c.sentiment`),
    rows(sql`SELECT COALESCE(a.source_name, a.source_type::text) AS source, count(*)::int AS n
             FROM classifications c JOIN articles a ON a.id = c.article_id
             WHERE c.search_term_id = ${termId} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    rows(sql`SELECT a.author AS author, count(*)::int AS n
             FROM classifications c JOIN articles a ON a.id = c.article_id
             WHERE c.search_term_id = ${termId} AND a.author IS NOT NULL AND a.author <> ''
             GROUP BY a.author ORDER BY n DESC LIMIT 8`),
    rows(sql`SELECT tag, count(*)::int AS n FROM (
               SELECT jsonb_array_elements_text(c.tags) AS tag
               FROM classifications c WHERE c.search_term_id = ${termId} AND c.tags IS NOT NULL
             ) t GROUP BY tag ORDER BY n DESC LIMIT 15`),
    rows(sql`SELECT c.signal_type::text AS signal_type, count(*)::int AS n
             FROM classifications c WHERE c.search_term_id = ${termId} AND c.signal_type IS NOT NULL
             GROUP BY c.signal_type ORDER BY n DESC`),
  ]);

  const sentimentMap: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const r of sentiment) sentimentMap[String(r.sentiment)] = num(r.n);

  res.json({
    watchItem: { id: wi.id, display_name: wi.display_name, type: wi.type },
    volume: volume.map((r) => ({ date: r.d, n: num(r.n) })),
    sentiment: sentimentMap,
    topSources: topSources.map((r) => ({ source: r.source, n: num(r.n) })),
    topAuthors: topAuthors.map((r) => ({ author: r.author, n: num(r.n) })),
    coTags: coTags.map((r) => ({ tag: r.tag, n: num(r.n) })),
    signalTypes: signalTypes.map((r) => ({ signal_type: r.signal_type, n: num(r.n) })),
  });
});

// GET /api/analytics/sources
analyticsRouter.get('/sources', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;
  const [bySource, feeds] = await Promise.all([
    rows(sql`SELECT a.source_type AS source_type, count(*)::int AS n
             FROM watch_items wi JOIN classifications c ON c.search_term_id = wi.search_term_id
             JOIN articles a ON a.id = c.article_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true GROUP BY a.source_type ORDER BY n DESC`),
    db.select().from(rss_sources).orderBy(rss_sources.category, rss_sources.name),
  ]);

  res.json({
    bySource: bySource.map((r) => ({ source_type: r.source_type, n: num(r.n) })),
    feeds,
  });
});
