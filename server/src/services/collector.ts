import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, job_runs, search_terms, watch_items } from '../db/schema';
import { contentHash } from '../lib/hash';
import { matchesQuery } from '../lib/matchesQuery';
import { classify, ClassificationInput, RANK_PROMPT_VERSION } from './ai/classifier';
import { generateAliases } from './aliases';
import { getActiveAiConfig, loadTermFewShot, makePersonalizeContext, personalizeClassification } from './personalize';
import { fetchGoogleNews } from './sources/googleNews';
import { fetchLinkedInPosts, toPostedLimit } from './sources/apifyLinkedIn';
import { fetchCompanyPagePosts } from './sources/apifyCompanyPage';
import { apifyEnabled } from './sources/apifyClient';
import { fanOutBreaking } from './notifications';
import { SourceArticle } from './sources/types';
import { GeoFilter, WatchType } from '../types';
import { getAppConfig, AppConfig } from '../lib/appConfig';

// LinkedIn (Apify) is billed per scraped post, so it must not be re-pulled on
// every 6h run. We key its cadence to the Vienna calendar day: 'YYYY-MM-DD' in
// Europe/Vienna. The first scheduled run of each day (00:00, before the 05:00
// newsletter) does the single daily LinkedIn scrape; later runs that day skip it.
const VIENNA_TZ = 'Europe/Vienna';
function viennaDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VIENNA_TZ }).format(d); // YYYY-MM-DD
}

export interface RunSummary {
  jobRunId: string;
  searchTermId: string;
  status: 'success' | 'error';
  articles_found: number;
  articles_new: number;
  classifications_new: number;
  error_message?: string;
}

type SearchTermRow = typeof search_terms.$inferSelect;

function logSourceError(source: string, term: SearchTermRow, err: unknown): void {
  console.error(`[collector] ${source} failed for "${term.query_display}":`, err instanceof Error ? err.message : err);
}

interface GatherOptions {
  lookbackDays?: number;
  /** Whether to query LinkedIn (Apify, paid) on this run — see collectForSearchTerm. */
  includeLinkedIn: boolean;
  /** Apify `postedLimit` window for LinkedIn ('24h' on scheduled runs). */
  linkedinPostedLimit: string;
  appCfg?: AppConfig;
}

/** Gather raw candidates from Google News + LinkedIn for a term. */
async function gatherCandidates(term: SearchTermRow, opts: GatherOptions): Promise<SourceArticle[]> {
  const { lookbackDays, includeLinkedIn, linkedinPostedLimit, appCfg } = opts;
  const out: SourceArticle[] = [];
  const cfg = term.sources_config;
  const geo = term.geo_filter as GeoFilter;
  const isCompany = term.type === 'company';
  const liLimit = appCfg?.linkedin_max_posts ?? 25;
  const gnLimit = appCfg?.google_news_max_results ?? 20;

  // All translated aliases. Each is searched in its OWN language edition, so a
  // keyword whose translation is spelled identically (e.g. "Leasing", or a German
  // term under geo=global) still gets its language edition queried.
  const allAliases = (term.aliases ?? []).filter((a) => a?.q && a.q.trim());

  if (cfg.google_news) {
    // Dedup by (language edition + query) — the original in the geo edition and a
    // same-spelled alias in another edition are NOT duplicates and both run.
    const geoEditionKey = (g: GeoFilter): string => (g === 'dach' ? 'DE' : g === 'austria' ? 'AT' : 'US');
    const langEditionKey: Record<string, string> = { de: 'DE', en: 'US', fr: 'FR', es: 'ES', it: 'IT' };
    const issued = new Set<string>();
    const gn = async (q: string, lang?: string): Promise<void> => {
      const edition = lang ? (langEditionKey[lang] ?? 'US') : geoEditionKey(geo);
      const key = `${edition}|${q.trim().toLowerCase()}`;
      if (issued.has(key)) return;
      issued.add(key);
      try { out.push(...await fetchGoogleNews(q, geo, lookbackDays, gnLimit, lang)); }
      catch (err) { logSourceError(`google_news${lang ? `[${lang}]` : ''}`, term, err); }
    };
    await gn(term.query_display);                          // primary in geo edition
    for (const al of allAliases) await gn(al.q, al.lang);  // each alias in its own edition
  }

  if (cfg.linkedin_posts && includeLinkedIn && apifyEnabled()) {
    // LinkedIn search is global (no language edition) → dedup by query only, so
    // identically-spelled translations don't trigger redundant Apify calls.
    const issued = new Set<string>();
    const li = async (q: string, lang?: string): Promise<void> => {
      const key = q.trim().toLowerCase();
      if (issued.has(key)) return;
      issued.add(key);
      try { out.push(...await fetchLinkedInPosts(q, linkedinPostedLimit, liLimit)); }
      catch (err) { logSourceError(`linkedin_posts${lang ? `[${lang}]` : ''}`, term, err); }
    };
    await li(term.query_display);
    for (const al of allAliases) await li(al.q, al.lang);
  }

  if (cfg.linkedin_company_page && isCompany && term.company_linkedin_id && includeLinkedIn && apifyEnabled()) {
    try { out.push(...await fetchCompanyPagePosts(term.company_linkedin_id, linkedinPostedLimit, liLimit)); }
    catch (err) { logSourceError('linkedin_company_page', term, err); }
  }

  return out;
}

/** Run collection for a single shared search_term. Never throws. */
export async function collectForSearchTerm(
  term: SearchTermRow,
  trigger: 'scheduled' | 'manual',
  lookbackDays?: number,
): Promise<RunSummary> {
  const [run] = await db.insert(job_runs).values({
    search_term_id: term.id,
    trigger,
    status: 'running',
  }).returning();

  const summary: RunSummary = {
    jobRunId: run.id,
    searchTermId: term.id,
    status: 'success',
    articles_found: 0,
    articles_new: 0,
    classifications_new: 0,
  };

  try {
    // Base classification uses objective relevance + this term's own rank-correction
    // calibration only (term-scoped: corrections on other keywords are ignored).
    // Per-user 👍/👎 preferences are applied afterwards as a separate per-user,
    // per-term re-rank (personalizeClassification).
    const [appCfg, fewShotExamples, pctx] = await Promise.all([
      getAppConfig(),
      loadTermFewShot(term.id),
      makePersonalizeContext(),
    ]);
    const maxClassifications = appCfg.collector_max_classifications;
    const watchType = term.type as WatchType;

    // Multilingual aliases: generated once per shared term by the AI, then reused
    // on every run. Lets the collector search translated keywords across language
    // editions. Failure is non-fatal — we fall back to the original term only.
    if (!term.aliases || term.aliases.length === 0) {
      try {
        const aliases = await generateAliases(term.query_display, watchType, pctx.model, pctx.variant);
        if (aliases.length) {
          await db.update(search_terms).set({ aliases }).where(eq(search_terms.id, term.id));
          term.aliases = aliases;
          console.log(`[collector] aliases for "${term.query_display}": ${aliases.map((a) => `${a.lang}:${a.q}`).join(', ')}`);
        }
      } catch (err) {
        console.error(`[collector] alias generation failed for "${term.query_display}":`, err instanceof Error ? err.message : err);
      }
    }
    // Prefilter accepts the original term OR any translated alias (an article is in
    // one language → only the matching-language alias can hit).
    const matchTerms = [term.query_normalized, ...(term.aliases ?? []).map((a) => a.q)];

    // Get context hint from the first active subscriber for this term
    const [sub] = await db.select({ context_hint: watch_items.context_hint })
      .from(watch_items)
      .where(and(eq(watch_items.search_term_id, term.id), eq(watch_items.is_active, true)))
      .limit(1);
    const contextHint = sub?.context_hint ?? null;

    // --- LinkedIn (Apify, paid) cadence -------------------------------------
    // Scrape LinkedIn at most ONCE per Vienna day per term, on the day's first
    // run (00:00 → before the 05:00 newsletter / morning briefing), with a 24h
    // window. Manual / lookback runs always scrape — the user asked for it.
    const collectedToday =
      !!term.last_linkedin_run_at && viennaDayKey(term.last_linkedin_run_at) === viennaDayKey(new Date());
    const includeLinkedIn = trigger === 'manual' || !collectedToday;
    const linkedinPostedLimit =
      lookbackDays ? toPostedLimit(lookbackDays)   // explicit backfill window
      : trigger === 'scheduled' ? '24h'            // daily run → only the last day
      : 'week';                                    // manual "Jetzt abrufen" → last week
    const wantsLinkedIn = apifyEnabled() && (
      term.sources_config.linkedin_posts ||
      (term.sources_config.linkedin_company_page && term.type === 'company' && !!term.company_linkedin_id)
    );

    const candidates = await gatherCandidates(term, { lookbackDays, includeLinkedIn, linkedinPostedLimit, appCfg });
    summary.articles_found = candidates.length;

    // Dedup within this run by content_hash (same URL from multiple sources).
    const seen = new Set<string>();

    for (const cand of candidates) {
      if (summary.classifications_new >= maxClassifications) {
        console.log(`[collector] reached cap of ${maxClassifications} new classifications for "${term.query_display}"`);
        break;
      }
      const hash = contentHash(cand.source_url);
      if (seen.has(hash)) continue;
      seen.add(hash);

      // Pre-filter (token-based). Inherently on-topic sources (company page /
      // newsroom) carry prefiltered=true and skip this.
      if (!cand.prefiltered) {
        const haystack = `${cand.title} ${cand.excerpt ?? ''}`;
        if (!matchTerms.some((mt) => matchesQuery(mt, haystack, watchType))) continue;
      }

      // --- Upsert article (global dedup on content_hash) ---
      const inserted = await db.insert(articles).values({
        content_hash: hash,
        source_url: cand.source_url,
        source_type: cand.source_type,
        source_name: cand.source_name ?? null,
        original_title: cand.title,
        raw_excerpt: cand.excerpt ?? null,
        full_text: cand.full_text ?? null,
        author: cand.author ?? null,
        author_info: cand.author_info ?? null,
        author_type: cand.author_type ?? null,
        reactions: cand.reactions ?? 0,
        comments_count: cand.comments_count ?? 0,
        shares_count: cand.shares_count ?? 0,
        extra_data: cand.extra_data ?? null,
        source_language: cand.source_language ?? null,
        published_at: cand.published_at ?? null,
      }).onConflictDoNothing({ target: articles.content_hash }).returning({ id: articles.id });

      let articleId: string;
      if (inserted.length) {
        articleId = inserted[0].id;
        summary.articles_new++;
      } else {
        const [existing] = await db.select({ id: articles.id })
          .from(articles).where(eq(articles.content_hash, hash));
        if (!existing) continue;
        articleId = existing.id;
      }

      // --- Classification dedup (article × search_term) ---
      const [already] = await db.select({ id: classifications.id })
        .from(classifications)
        .where(and(eq(classifications.article_id, articleId), eq(classifications.search_term_id, term.id)));
      if (already) continue;

      // --- Classify (1 AI call) ---
      const input: ClassificationInput = {
        // Use full_text when available (LinkedIn posts); fall back to excerpt (Google News snippets)
        content: `${cand.title}\n\n${cand.full_text ?? cand.excerpt ?? ''}`.trim(),
        searchQuery: term.query_display,
        watchType,
        sourceType: cand.source_type,
        language: pctx.language,
        contextHint,
      };

      let result;
      try {
        result = await classify(input, pctx.model, pctx.variant, {
          rankCriteria: appCfg.rank_criteria,
          fewShotExamples,
        });
      } catch (err) {
        console.error(`[collector] classify failed (article ${articleId}):`, err instanceof Error ? err.message : err);
        continue; // skip this article, keep the run alive
      }

      const [insertedCls] = await db.insert(classifications).values({
        article_id: articleId,
        search_term_id: term.id,
        title: result.title,
        summary: result.summary,
        rank: result.rank,
        rank_reason: result.rank_reason,
        sentiment: result.sentiment,
        tags: result.tags,
        entities: result.entities ?? [],
        signal_type: watchType === 'company' ? (result.signal_type ?? 'general') : null,
        breaking: result.breaking,
        ai_model_used: pctx.variant ?? pctx.model,
        rank_prompt_version: RANK_PROMPT_VERSION,
      }).onConflictDoNothing({ target: [classifications.article_id, classifications.search_term_id] })
        .returning({ id: classifications.id });

      summary.classifications_new++;

      // Per-user personalisation: re-rank this signal for each subscriber who
      // has given feedback, learning from THAT user's own 👍/👎.
      if (insertedCls) {
        try {
          await personalizeClassification({
            ctx: pctx,
            classificationId: insertedCls.id,
            searchTermId: term.id,
            content: input.content,
            searchQuery: term.query_display,
            watchType,
            baseRank: result.rank,
          });
        } catch (err) {
          console.error(`[collector] personalize failed (article ${articleId}):`, err instanceof Error ? err.message : err);
        }
      }
    }

    await db.update(job_runs).set({
      status: 'success',
      articles_found: summary.articles_found,
      articles_new: summary.articles_new,
      classifications_new: summary.classifications_new,
      completed_at: new Date(),
    }).where(eq(job_runs.id, run.id));

    await db.update(search_terms).set({
      last_run_at: new Date(),
      // Mark the daily LinkedIn scrape as done so the remaining 6h runs today skip it.
      ...(includeLinkedIn && wantsLinkedIn ? { last_linkedin_run_at: new Date() } : {}),
    }).where(eq(search_terms.id, term.id));

    // Instant push ONLY for rare "breaking" items (idempotent via telegram_sent).
    // Everything else is bundled into the once-daily briefing, never per-article.
    try {
      await fanOutBreaking(term.id);
    } catch (err) {
      console.error(`[collector] breaking fan-out failed for term ${term.id}:`, err instanceof Error ? err.message : err);
    }
  } catch (err) {
    summary.status = 'error';
    summary.error_message = err instanceof Error ? err.message : String(err);
    console.error(`[collector] run failed for term ${term.id}:`, summary.error_message);
    await db.update(job_runs).set({
      status: 'error',
      error_message: summary.error_message,
      articles_found: summary.articles_found,
      articles_new: summary.articles_new,
      classifications_new: summary.classifications_new,
      completed_at: new Date(),
    }).where(eq(job_runs.id, run.id));
  }

  return summary;
}

const SCHEDULE_INTERVAL_HOURS: Record<string, number> = {
  '1h': 1, '2h': 2, '3h': 3, '6h': 6, '12h': 12, '24h': 24, '48h': 48, '168h': 168,
};

/** Check if a search_term is due for a scheduled run based on its subscribers' schedule_interval. */
async function isDueForRun(term: SearchTermRow): Promise<boolean> {
  const items = await db.select({ schedule_interval: watch_items.schedule_interval })
    .from(watch_items)
    .where(and(eq(watch_items.search_term_id, term.id), eq(watch_items.is_active, true)));

  if (items.length === 0) return false;

  // If any watch_item has the default schedule (null) → always run with global cadence
  const hasDefault = items.some((wi) => !wi.schedule_interval);
  if (hasDefault) return true;

  // All 'manual' → skip
  const allManual = items.every((wi) => wi.schedule_interval === 'manual');
  if (allManual) return false;

  // Find shortest interval among scheduled items
  const hours = items
    .map((wi) => wi.schedule_interval && SCHEDULE_INTERVAL_HOURS[wi.schedule_interval])
    .filter((h): h is number => typeof h === 'number');
  if (hours.length === 0) return false;
  const minHours = Math.min(...hours);

  if (!term.last_run_at) return true;
  const nextRun = new Date(term.last_run_at.getTime() + minHours * 3_600_000);
  return nextRun <= new Date();
}

/** Batch collection over all active search_terms (schedule-aware). */
export async function collectAll(trigger: 'scheduled' | 'manual'): Promise<RunSummary[]> {
  const terms = await db.select().from(search_terms).where(eq(search_terms.is_active, true));
  console.log(`[collector] ${terms.length} active search_terms, checking schedules...`);
  const summaries: RunSummary[] = [];
  for (const term of terms) {
    const due = trigger === 'manual' || await isDueForRun(term);
    if (!due) {
      console.log(`[collector] term "${term.query_display}" → skipped (not due)`);
      continue;
    }
    const s = await collectForSearchTerm(term, trigger);
    summaries.push(s);
    console.log(`[collector] term "${term.query_display}" → ${s.status} (new articles: ${s.articles_new}, classifications: ${s.classifications_new})`);
  }
  return summaries;
}
