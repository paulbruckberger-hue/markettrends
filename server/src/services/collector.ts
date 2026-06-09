import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, job_runs, search_terms, watch_items } from '../db/schema';
import { contentHash } from '../lib/hash';
import { matchesQuery } from '../lib/matchesQuery';
import { classify, ClassificationInput, RANK_PROMPT_VERSION } from './ai/classifier';
import { generateAliases } from './aliases';
import { getActiveAiConfig, loadGlobalFewShot, makePersonalizeContext, personalizeClassification } from './personalize';
import { fetchGoogleNews } from './sources/googleNews';
import { fetchLinkedInPosts } from './sources/apifyLinkedIn';
import { fetchCompanyPagePosts } from './sources/apifyCompanyPage';
import { apifyEnabled } from './sources/apifyClient';
import { fanOutForTerm } from './notifications';
import { SourceArticle } from './sources/types';
import { GeoFilter, WatchType } from '../types';
import { getAppConfig, AppConfig } from '../lib/appConfig';

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

/** Gather raw candidates from Google News + LinkedIn for a term. */
async function gatherCandidates(term: SearchTermRow, lookbackDays?: number, appCfg?: AppConfig): Promise<SourceArticle[]> {
  const out: SourceArticle[] = [];
  const cfg = term.sources_config;
  const geo = term.geo_filter as GeoFilter;
  const isCompany = term.type === 'company';
  const liLimit = appCfg?.linkedin_max_posts ?? 25;
  const gnLimit = appCfg?.google_news_max_results ?? 20;

  // Distinct translated aliases (excludes any that equal the original term, e.g.
  // unchanged company/brand names). Shared by every text source.
  const original = term.query_display.trim().toLowerCase();
  const aliases = (term.aliases ?? []).filter((a) => a?.q && a.q.trim().toLowerCase() !== original);

  if (cfg.google_news) {
    // Primary term in the user's geo edition (unchanged behaviour).
    try { out.push(...await fetchGoogleNews(term.query_display, geo, lookbackDays, gnLimit)); }
    catch (err) { logSourceError('google_news', term, err); }

    // Multilingual: each translated alias is searched in its own-language edition.
    for (const al of aliases) {
      try { out.push(...await fetchGoogleNews(al.q, geo, lookbackDays, gnLimit, al.lang)); }
      catch (err) { logSourceError(`google_news[${al.lang}]`, term, err); }
    }
  }

  if (cfg.linkedin_posts && apifyEnabled()) {
    // Primary term, then each translated alias (LinkedIn search is global — the
    // query string itself carries the language).
    try { out.push(...await fetchLinkedInPosts(term.query_display, lookbackDays, liLimit)); }
    catch (err) { logSourceError('linkedin_posts', term, err); }

    for (const al of aliases) {
      try { out.push(...await fetchLinkedInPosts(al.q, lookbackDays, liLimit)); }
      catch (err) { logSourceError(`linkedin_posts[${al.lang}]`, term, err); }
    }
  }

  if (cfg.linkedin_company_page && isCompany && term.company_linkedin_id && apifyEnabled()) {
    try { out.push(...await fetchCompanyPagePosts(term.company_linkedin_id, lookbackDays, liLimit)); }
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
    // Base classification uses objective relevance + global rank-correction
    // calibration only. Per-user 👍/👎 preferences are applied afterwards as a
    // separate per-user re-rank (personalizeClassification).
    const [appCfg, fewShotExamples, pctx] = await Promise.all([
      getAppConfig(),
      loadGlobalFewShot(),
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

    const candidates = await gatherCandidates(term, lookbackDays, appCfg);
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

    await db.update(search_terms).set({ last_run_at: new Date() }).where(eq(search_terms.id, term.id));

    // Notifications fan-out per subscriber (idempotent via telegram_sent).
    try {
      await fanOutForTerm(term.id);
    } catch (err) {
      console.error(`[collector] notification fan-out failed for term ${term.id}:`, err instanceof Error ? err.message : err);
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
