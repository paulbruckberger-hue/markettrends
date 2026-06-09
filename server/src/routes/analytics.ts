import { Router, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { search_terms, settings, watch_items } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { AiModel, generateText } from '../services/ai/classifier';

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> => (await db.execute(q)).rows as Row[];
const num = (v: unknown): number => (typeof v === 'number' ? v : parseInt(String(v ?? 0), 10) || 0);

/** Parse a ?period= value (e.g. "7", "30d", "90") into a day count, clamped. */
function parsePeriodDays(v: unknown, fallback: number): number {
  const allowed = [7, 14, 30, 90];
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return allowed.includes(n) ? n : fallback;
}

/** Build a zero-filled daily series of length `days` ending today from a {date->count} map. */
function fillSeries(byDate: Map<string, number>, days: number): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDate.get(d) ?? 0);
  }
  return out;
}

/** Percentage momentum of a window vs the immediately preceding equal window. */
function momentumPct(recent: number, prior: number): number {
  if (prior > 0) return Math.round(((recent - prior) / prior) * 100);
  return recent > 0 ? 100 : 0;
}

/** Daily signal count for a search_term over the last `days` days, aligned to an array. */
async function dailySpark(termId: string, days: number): Promise<number[]> {
  const r = await rows(sql`
    SELECT to_char(date_trunc('day', COALESCE(a.published_at, a.created_at)),'YYYY-MM-DD') AS d, count(*)::int AS n
    FROM classifications c JOIN articles a ON a.id = c.article_id
    WHERE c.search_term_id = ${termId}
      AND COALESCE(a.published_at, a.created_at) >= now() - (${days} || ' days')::interval
    GROUP BY 1 ORDER BY 1`);
  const byDate = new Map<string, number>();
  for (const row of r) byDate.set(String(row.d), num(row.n));
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDate.get(d) ?? 0);
  }
  return out;
}

// GET /api/analytics/overview
analyticsRouter.get('/overview', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;
  const days = parsePeriodDays(req.query.period, 14);

  const [rankRows, sourceRows, sentimentRows, volumeRows, stateRows, watchRows, freshRows] = await Promise.all([
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
               AND COALESCE(a.published_at, a.created_at) >= now() - (${days} || ' days')::interval
             GROUP BY 1 ORDER BY 1`),
    rows(sql`SELECT
               count(*) FILTER (WHERE uas.is_read)::int AS read,
               count(*) FILTER (WHERE uas.is_bookmarked)::int AS bookmarked
             FROM user_article_state uas WHERE uas.user_id = ${uid}`),
    rows(sql`SELECT count(*)::int AS n FROM watch_items WHERE user_id = ${uid} AND is_active = true`),
    rows(sql`SELECT max(st.last_run_at) AS last_run
             FROM watch_items wi JOIN search_terms st ON st.id = wi.search_term_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true`),
  ]);

  const byRank: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
  let total = 0;
  for (const r of rankRows) { byRank[String(num(r.rank))] = num(r.n); total += num(r.n); }

  const bySentiment: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const r of sentimentRows) bySentiment[String(r.sentiment)] = num(r.n);

  res.json({
    total,
    watchCount: num(watchRows[0]?.n),
    period: days,
    byRank,
    bySource: sourceRows.map((r) => ({ source_type: r.source_type, n: num(r.n) })),
    bySentiment,
    volume: volumeRows.map((r) => ({ date: r.d, n: num(r.n) })),
    read: num(stateRows[0]?.read),
    bookmarked: num(stateRows[0]?.bookmarked),
    last_updated: freshRows[0]?.last_run ? new Date(freshRows[0].last_run as string).toISOString() : null,
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
  const waDays = parsePeriodDays(req.query.period, 30);

  const [volume, sentiment, topSources, topAuthors, coTags, signalTypes] = await Promise.all([
    rows(sql`SELECT to_char(date_trunc('day', COALESCE(a.published_at,a.created_at)),'YYYY-MM-DD') AS d, count(*)::int AS n
             FROM classifications c JOIN articles a ON a.id = c.article_id
             WHERE c.search_term_id = ${termId} AND COALESCE(a.published_at,a.created_at) >= now() - (${waDays} || ' days')::interval
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
    period: waDays,
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
  const bySource = await rows(sql`
    SELECT a.source_type AS source_type, count(*)::int AS n
    FROM watch_items wi JOIN classifications c ON c.search_term_id = wi.search_term_id
    JOIN articles a ON a.id = c.article_id
    WHERE wi.user_id = ${uid} AND wi.is_active = true GROUP BY a.source_type ORDER BY n DESC`);

  res.json({ bySource: bySource.map((r) => ({ source_type: r.source_type, n: num(r.n) })) });
});

// ---------- Trends: per-watch volume momentum + spike detection + emerging tags ----------
// GET /api/analytics/trends?period=7|14|30|90&type=topic|company|all
analyticsRouter.get('/trends', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;
  const days = parsePeriodDays(req.query.period, 30);
  const typeFilter = req.query.type === 'topic' || req.query.type === 'company' ? req.query.type : null;

  // One pass: per-watch daily counts across a double window (current + prior),
  // assembled into series + momentum + spike in JS.
  const [seriesRows, tagRows, freshRows] = await Promise.all([
    rows(sql`
      SELECT wi.id AS watch_item_id, wi.display_name AS name, wi.color AS color, st.type AS type,
        to_char(date_trunc('day', COALESCE(a.published_at, a.created_at)),'YYYY-MM-DD') AS d,
        count(*)::int AS n
      FROM watch_items wi
      JOIN search_terms st ON st.id = wi.search_term_id
      JOIN classifications c ON c.search_term_id = wi.search_term_id
      JOIN articles a ON a.id = c.article_id
      WHERE wi.user_id = ${uid} AND wi.is_active = true
        AND COALESCE(a.published_at, a.created_at) >= now() - (${days * 2} || ' days')::interval
      GROUP BY wi.id, wi.display_name, wi.color, st.type, d`),
    // Emerging tags: current window vs prior equal window across all watches.
    rows(sql`
      SELECT tag,
        count(*) FILTER (WHERE recent)::int AS cur,
        count(*) FILTER (WHERE NOT recent)::int AS prev
      FROM (
        SELECT lower(trim(jsonb_array_elements_text(c.tags))) AS tag,
          (COALESCE(a.published_at, a.created_at) >= now() - (${days} || ' days')::interval) AS recent
        FROM watch_items wi
        JOIN classifications c ON c.search_term_id = wi.search_term_id
        JOIN articles a ON a.id = c.article_id
        WHERE wi.user_id = ${uid} AND wi.is_active = true AND c.tags IS NOT NULL
          AND COALESCE(a.published_at, a.created_at) >= now() - (${days * 2} || ' days')::interval
      ) t
      WHERE tag <> ''
      GROUP BY tag
      ORDER BY cur DESC
      LIMIT 14`),
    rows(sql`SELECT max(st.last_run_at) AS last_run
             FROM watch_items wi JOIN search_terms st ON st.id = wi.search_term_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true`),
  ]);

  // Group daily rows per watch.
  interface Acc { name: string; color: string | null; type: string; byDate: Map<string, number> }
  const byWatch = new Map<string, Acc>();
  for (const r of seriesRows) {
    const id = String(r.watch_item_id);
    let acc = byWatch.get(id);
    if (!acc) {
      acc = { name: String(r.name), color: (r.color as string) ?? null, type: String(r.type), byDate: new Map() };
      byWatch.set(id, acc);
    }
    acc.byDate.set(String(r.d), num(r.n));
  }

  const watches = [...byWatch.entries()]
    .filter(([, a]) => !typeFilter || a.type === typeFilter)
    .map(([id, a]) => {
      const full = fillSeries(a.byDate, days * 2);     // 2× window
      const series = full.slice(days);                  // current window
      const prevSeries = full.slice(0, days);           // prior window
      const total = series.reduce((s, x) => s + x, 0);
      const prev = prevSeries.reduce((s, x) => s + x, 0);
      const today = series[series.length - 1] ?? 0;
      const avgDaily = total / days;
      const spikeFactor = avgDaily > 0 ? Math.round((today / avgDaily) * 10) / 10 : (today > 0 ? 99 : 0);
      const spike = today >= 2 && avgDaily > 0 && today >= 2 * avgDaily;
      return {
        watch_item_id: id,
        name: a.name,
        color: a.color,
        type: a.type,
        total,
        prev,
        momentum: momentumPct(total, prev),
        today,
        avg_daily: Math.round(avgDaily * 10) / 10,
        spike,
        spike_factor: spikeFactor,
        spark: series,
      };
    })
    .sort((x, y) => y.total - x.total);

  const emergingTags = tagRows
    .map((r) => ({ tag: String(r.tag), cur: num(r.cur), prev: num(r.prev), momentum: momentumPct(num(r.cur), num(r.prev)) }))
    .filter((t) => t.cur > 0);

  res.json({
    period: days,
    generated_at: new Date().toISOString(),
    last_updated: freshRows[0]?.last_run ? new Date(freshRows[0].last_run as string).toISOString() : null,
    watches,
    emergingTags,
  });
});

// ---------- Today: fresh-signal overview ("was ist neu") ----------
// GET /api/analytics/today
analyticsRouter.get('/today', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;

  const [totals, perWatch, freshRows] = await Promise.all([
    rows(sql`
      SELECT
        count(*) FILTER (WHERE day = 0)::int AS today,
        count(*) FILTER (WHERE day = 1)::int AS yesterday,
        count(*) FILTER (WHERE day = 0 AND c.rank = 1)::int AS rank1_today
      FROM (
        SELECT c.id, c.rank,
          floor(extract(epoch FROM (date_trunc('day', now()) - date_trunc('day', COALESCE(a.published_at, a.created_at)))) / 86400)::int AS day
        FROM watch_items wi
        JOIN classifications c ON c.search_term_id = wi.search_term_id
        JOIN articles a ON a.id = c.article_id
        WHERE wi.user_id = ${uid} AND wi.is_active = true
          AND COALESCE(a.published_at, a.created_at) >= now() - interval '2 days'
      ) c`),
    rows(sql`
      SELECT wi.id AS watch_item_id, wi.display_name AS name, wi.color AS color, st.type AS type,
        count(*)::int AS today
      FROM watch_items wi
      JOIN search_terms st ON st.id = wi.search_term_id
      JOIN classifications c ON c.search_term_id = wi.search_term_id
      JOIN articles a ON a.id = c.article_id
      WHERE wi.user_id = ${uid} AND wi.is_active = true
        AND date_trunc('day', COALESCE(a.published_at, a.created_at)) = date_trunc('day', now())
      GROUP BY wi.id, wi.display_name, wi.color, st.type
      ORDER BY today DESC`),
    rows(sql`SELECT max(st.last_run_at) AS last_run
             FROM watch_items wi JOIN search_terms st ON st.id = wi.search_term_id
             WHERE wi.user_id = ${uid} AND wi.is_active = true`),
  ]);

  res.json({
    today: num(totals[0]?.today),
    yesterday: num(totals[0]?.yesterday),
    rank1_today: num(totals[0]?.rank1_today),
    perWatch: perWatch.map((r) => ({
      watch_item_id: String(r.watch_item_id), name: String(r.name),
      color: (r.color as string) ?? null, type: String(r.type), today: num(r.today),
    })),
    last_updated: freshRows[0]?.last_run ? new Date(freshRows[0].last_run as string).toISOString() : null,
  });
});

// ---------- Data-driven watch suggestions (from real mentions + tags) ----------
// GET /api/analytics/suggestions
analyticsRouter.get('/suggestions', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;

  // What the user already watches — exclude these from suggestions.
  const watched = await db.select({
    type: search_terms.type,
    query_normalized: search_terms.query_normalized,
    display_name: watch_items.display_name,
  }).from(watch_items)
    .innerJoin(search_terms, eq(search_terms.id, watch_items.search_term_id))
    .where(eq(watch_items.user_id, uid));

  const watchedKeys = new Set<string>();
  for (const w of watched) {
    watchedKeys.add(w.query_normalized.toLowerCase());
    if (w.display_name) watchedKeys.add(w.display_name.toLowerCase());
  }

  const [entityRows, tagRows] = await Promise.all([
    // Most-mentioned organisations across the user's classifications (real entities).
    rows(sql`
      SELECT mode() WITHIN GROUP (ORDER BY ent_raw) AS display, lower(ent_raw) AS k, count(*)::int AS n
      FROM (
        SELECT trim(jsonb_array_elements_text(c.entities)) AS ent_raw
        FROM watch_items wi
        JOIN classifications c ON c.search_term_id = wi.search_term_id
        WHERE wi.user_id = ${uid} AND wi.is_active = true AND c.entities IS NOT NULL
      ) t
      WHERE ent_raw <> ''
      GROUP BY lower(ent_raw)
      ORDER BY n DESC
      LIMIT 40`),
    // Most-used tags → topic suggestions.
    rows(sql`
      SELECT mode() WITHIN GROUP (ORDER BY tag_raw) AS display, lower(tag_raw) AS k, count(*)::int AS n
      FROM (
        SELECT trim(jsonb_array_elements_text(c.tags)) AS tag_raw
        FROM watch_items wi
        JOIN classifications c ON c.search_term_id = wi.search_term_id
        WHERE wi.user_id = ${uid} AND wi.is_active = true AND c.tags IS NOT NULL
      ) t
      WHERE tag_raw <> ''
      GROUP BY lower(tag_raw)
      ORDER BY n DESC
      LIMIT 40`),
  ]);

  const companies = entityRows
    .filter((r) => !watchedKeys.has(String(r.k)))
    .map((r) => ({ name: String(r.display), count: num(r.n) }))
    .slice(0, 6);
  const topics = tagRows
    .filter((r) => !watchedKeys.has(String(r.k)))
    .map((r) => ({ name: String(r.display), count: num(r.n) }))
    .slice(0, 6);

  res.json({ companies, topics });
});

// ---------- Competitor analysis (hybrid: real aggregation + AI enrichment) ----------

interface AiEnrichment {
  summary: string;
  strengths: string[];
  watchouts: string[];
  rivals: string[];
}

function coerceStrings(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, max);
}

async function enrichWithAi(
  subject: string, domain: string | null, geoLabel: string,
  moveTitles: string[], lang: 'de' | 'en', model: AiModel, variant: string | undefined,
): Promise<AiEnrichment | null> {
  const movesList = moveTitles.length
    ? moveTitles.map((t) => `- ${t}`).join('\n')
    : (lang === 'en' ? '- (few recent signals)' : '- (wenige aktuelle Signale)');
  const prompt = lang === 'en'
    ? `You are a B2B competitive analyst (fintech/banking context). Give a compact competitive read on "${subject}"${domain ? ` (${domain})` : ''} in the ${geoLabel} market.
Recent signals observed:
${movesList}

Reply with ONE JSON object only, no Markdown:
{
  "summary": "2 sentences on the competitive position",
  "strengths": ["3 short strengths"],
  "watchouts": ["2 short risks / things to watch"],
  "rivals": ["3-5 names of direct competitors"]
}`
    : `Du bist B2B-Wettbewerbsanalyst (Fintech-/Banking-Kontext). Gib eine kompakte Wettbewerbseinordnung für "${subject}"${domain ? ` (${domain})` : ''} im ${geoLabel}-Markt.
Aktuelle beobachtete Signale:
${movesList}

Antworte AUSSCHLIESSLICH mit EINEM JSON-Objekt, ohne Markdown:
{
  "summary": "2 Sätze zur Wettbewerbsposition",
  "strengths": ["3 kurze Stärken"],
  "watchouts": ["2 kurze Risiken / worauf achten"],
  "rivals": ["3-5 Namen direkter Wettbewerber"]
}`;
  try {
    const raw = await generateText(prompt, model, variant);
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first === -1 || last <= first) return null;
    const obj = JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
    return {
      summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
      strengths: coerceStrings(obj.strengths, 4),
      watchouts: coerceStrings(obj.watchouts, 3),
      rivals: coerceStrings(obj.rivals, 6),
    };
  } catch {
    return null;
  }
}

// GET /api/analytics/competitor/:watchItemId
analyticsRouter.get('/competitor/:watchItemId', async (req: AuthedRequest, res: Response) => {
  const uid = req.user!.id;
  const wantAi = req.query.ai !== '0';

  const [wi] = await db.select({
    id: watch_items.id,
    display_name: watch_items.display_name,
    color: watch_items.color,
    search_term_id: watch_items.search_term_id,
    type: search_terms.type,
    geo_filter: search_terms.geo_filter,
    company_domain: search_terms.company_domain,
  }).from(watch_items)
    .innerJoin(search_terms, eq(search_terms.id, watch_items.search_term_id))
    .where(and(eq(watch_items.id, req.params.watchItemId), eq(watch_items.user_id, uid)));
  if (!wi) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  if (wi.type !== 'company') { res.status(400).json({ error: 'Wettbewerbsanalyse nur für Unternehmen' }); return; }

  const termId = wi.search_term_id;
  const geoLabel = { global: 'Global', dach: 'DACH', austria: 'Österreich' }[wi.geo_filter] ?? 'Global';

  // --- Real aggregation for the subject ---
  const [signalRows, sentimentRows, moveRows, sovRows, rivalRows] = await Promise.all([
    rows(sql`SELECT c.signal_type::text AS signal_type, count(*)::int AS n
             FROM classifications c WHERE c.search_term_id = ${termId} AND c.signal_type IS NOT NULL
             GROUP BY c.signal_type ORDER BY n DESC`),
    rows(sql`SELECT COALESCE(c.sentiment::text,'neutral') AS sentiment, count(*)::int AS n
             FROM classifications c WHERE c.search_term_id = ${termId} GROUP BY c.sentiment`),
    rows(sql`SELECT to_char(COALESCE(a.published_at, a.created_at),'DD. Mon') AS date,
                    c.rank::int AS rank, c.signal_type::text AS signal_type, c.title AS title,
                    COALESCE(a.source_name, a.source_type::text) AS src
             FROM classifications c JOIN articles a ON a.id = c.article_id
             WHERE c.search_term_id = ${termId}
             ORDER BY c.rank ASC, COALESCE(a.published_at, a.created_at) DESC LIMIT 8`),
    // Share of Voice across this user's company watches (30-day signal volume + 15d momentum)
    rows(sql`
      SELECT wi.id AS watch_item_id, wi.display_name AS name, wi.color AS color, wi.search_term_id AS term_id,
        count(c.id) FILTER (WHERE COALESCE(a.published_at, a.created_at) >= now() - interval '30 days')::int AS n,
        count(c.id) FILTER (WHERE COALESCE(a.published_at, a.created_at) >= now() - interval '15 days')::int AS recent,
        count(c.id) FILTER (WHERE COALESCE(a.published_at, a.created_at) >= now() - interval '30 days'
                              AND COALESCE(a.published_at, a.created_at) < now() - interval '15 days')::int AS prior
      FROM watch_items wi
      JOIN search_terms st ON st.id = wi.search_term_id AND st.type = 'company'
      LEFT JOIN classifications c ON c.search_term_id = wi.search_term_id
      LEFT JOIN articles a ON a.id = c.article_id
      WHERE wi.user_id = ${uid} AND wi.is_active = true
      GROUP BY wi.id, wi.display_name, wi.color, wi.search_term_id`),
    // Organisations co-mentioned in this subject's coverage (real entity extraction).
    rows(sql`
      SELECT mode() WITHIN GROUP (ORDER BY ent_raw) AS display, lower(ent_raw) AS k, count(*)::int AS n
      FROM (
        SELECT trim(jsonb_array_elements_text(c.entities)) AS ent_raw
        FROM classifications c
        WHERE c.search_term_id = ${termId} AND c.entities IS NOT NULL
      ) t
      WHERE ent_raw <> ''
      GROUP BY lower(ent_raw)
      ORDER BY n DESC
      LIMIT 12`),
  ]);

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const r of sentimentRows) {
    const k = String(r.sentiment) as keyof typeof sentiment;
    if (k in sentiment) sentiment[k] = num(r.n);
  }

  const totalSov = sovRows.reduce((s, r) => s + num(r.n), 0) || 1;
  const sov = sovRows
    .map((r) => {
      const recent = num(r.recent), prior = num(r.prior);
      const up = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : (recent > 0 ? 100 : 0);
      return {
        watch_item_id: String(r.watch_item_id),
        name: String(r.name),
        color: (r.color as string) ?? null,
        share: Math.round((num(r.n) / totalSov) * 100),
        up,
        you: String(r.term_id) === termId,
      };
    })
    .sort((a, b) => b.share - a.share);

  // Momentum sparklines: subject + up to 2 most-active tracked rivals
  const subjectSov = sov.find((s) => s.you);
  const others = sov.filter((s) => !s.you).slice(0, 2);
  const momentumTargets = [subjectSov, ...others].filter(Boolean) as typeof sov;
  const momentum = await Promise.all(momentumTargets.map(async (s) => ({
    name: s.name,
    up: s.up,
    spark: await dailySpark(
      sovRows.find((r) => String(r.watch_item_id) === s.watch_item_id)!.term_id as string, 12),
  })));

  const moves = moveRows.map((r) => ({
    date: String(r.date),
    rank: num(r.rank),
    signal_type: r.signal_type as string | null,
    text: String(r.title),
    src: String(r.src),
  }));

  // --- AI enrichment (best-effort) ---
  let ai: AiEnrichment | null = null;
  if (wantAi) {
    const [s] = await db.select().from(settings).where(eq(settings.user_id, uid));
    const model = (s?.ai_model as AiModel) ?? 'claude';
    const lang = (s?.language as 'de' | 'en') ?? 'de';
    ai = await enrichWithAi(
      wi.display_name, wi.company_domain, geoLabel,
      moves.slice(0, 6).map((m) => m.text), lang, model, s?.ai_model_variant ?? undefined,
    );
  }

  const trackedNames = new Set(sov.map((s) => s.name.toLowerCase()));
  const subjectKey = wi.display_name.toLowerCase();
  const domainKey = (wi.company_domain ?? '').toLowerCase();
  // Real co-mentioned organisations — the data-backed rival list.
  const detectedRivals = rivalRows
    .map((r) => ({ name: String(r.display), count: num(r.n), k: String(r.k) }))
    .filter((r) => r.k !== subjectKey && !trackedNames.has(r.k)
      && !subjectKey.includes(r.k) && !r.k.includes(subjectKey)
      && (!domainKey || !domainKey.includes(r.k)))
    .slice(0, 6)
    .map((r) => ({ name: r.name, count: r.count }));
  const detectedKeys = new Set(detectedRivals.map((r) => r.name.toLowerCase()));
  const aiRivals = (ai?.rivals ?? []).filter((n) => !trackedNames.has(n.toLowerCase()) && !detectedKeys.has(n.toLowerCase()));

  const totalSignals = signalRows.reduce((s, r) => s + num(r.n), 0);
  const fallbackSummary = `${wi.display_name}: ${totalSignals} klassifizierte Signale, ${subjectSov?.share ?? 0}% Share-of-Voice unter deinen beobachteten Unternehmen.`;

  res.json({
    watch_item_id: wi.id,
    subject: wi.display_name,
    domain: wi.company_domain,
    geo: wi.geo_filter,
    color: wi.color,
    summary: ai?.summary || fallbackSummary,
    sov,
    momentum,
    signals: signalRows.map((r) => ({ signal_type: r.signal_type, n: num(r.n) })),
    sentiment,
    moves,
    strengths: ai?.strengths ?? [],
    watchouts: ai?.watchouts ?? [],
    detectedRivals,
    aiRivals,
    ai_used: !!ai,
  });
});
