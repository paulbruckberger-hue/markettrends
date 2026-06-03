import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, job_runs, search_terms, settings, users } from '../db/schema';
import { contentHash } from '../lib/hash';
import { matchesQuery } from '../lib/matchesQuery';
import { classify, AiModel, ClassificationInput } from './ai/classifier';
import { fetchGoogleNews } from './sources/googleNews';
import { fetchRssArticles, fetchSingleFeed } from './sources/rssFeeds';
import { fetchLinkedInPosts } from './sources/apifyLinkedIn';
import { fetchCompanyPagePosts } from './sources/apifyCompanyPage';
import { apifyEnabled } from './sources/apifyClient';
import { SourceArticle } from './sources/types';
import { GeoFilter, WatchType } from '../types';

// Soft cap on AI calls per term per run to protect the API budget.
const MAX_NEW_CLASSIFICATIONS_PER_RUN = 30;

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

/**
 * Determine which AI model/variant to use for the (shared) classification.
 * MVP is single-user, so we read the admin's settings; falls back to Claude.
 */
async function getActiveAiConfig(): Promise<{ model: AiModel; variant?: string }> {
  const [admin] = await db.select().from(users).where(eq(users.role, 'admin'));
  if (admin) {
    const [s] = await db.select().from(settings).where(eq(settings.user_id, admin.id));
    if (s) return { model: s.ai_model as AiModel, variant: s.ai_model_variant ?? undefined };
  }
  return { model: 'claude' };
}

function logSourceError(source: string, term: SearchTermRow, err: unknown): void {
  console.error(`[collector] ${source} failed for "${term.query_display}":`, err instanceof Error ? err.message : err);
}

/** Gather raw candidates from every enabled + implemented source for a term. */
async function gatherCandidates(term: SearchTermRow): Promise<SourceArticle[]> {
  const out: SourceArticle[] = [];
  const cfg = term.sources_config;
  const geo = term.geo_filter as GeoFilter;
  const isCompany = term.type === 'company';

  if (cfg.google_news) {
    try { out.push(...await fetchGoogleNews(term.query_display, geo)); }
    catch (err) { logSourceError('google_news', term, err); }
  }

  if (cfg.rss) {
    try { out.push(...await fetchRssArticles(geo)); }
    catch (err) { logSourceError('rss', term, err); }
  }

  if (cfg.linkedin_posts && apifyEnabled()) {
    try { out.push(...await fetchLinkedInPosts(term.query_display)); }
    catch (err) { logSourceError('linkedin_posts', term, err); }
  }

  if (cfg.linkedin_company_page && isCompany && term.company_linkedin_id && apifyEnabled()) {
    try { out.push(...await fetchCompanyPagePosts(term.company_linkedin_id)); }
    catch (err) { logSourceError('linkedin_company_page', term, err); }
  }

  if (cfg.newsroom && isCompany && term.company_newsroom_url) {
    try { out.push(...await fetchSingleFeed(term.company_newsroom_url, `${term.query_display} Newsroom`, 'newsroom')); }
    catch (err) { logSourceError('newsroom', term, err); }
  }

  return out;
}

/** Run collection for a single shared search_term. Never throws. */
export async function collectForSearchTerm(
  term: SearchTermRow,
  trigger: 'scheduled' | 'manual'
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
    const aiCfg = await getActiveAiConfig();
    const watchType = term.type as WatchType;

    const candidates = await gatherCandidates(term);
    summary.articles_found = candidates.length;

    // Dedup within this run by content_hash (same URL from multiple sources).
    const seen = new Set<string>();

    for (const cand of candidates) {
      if (summary.classifications_new >= MAX_NEW_CLASSIFICATIONS_PER_RUN) {
        console.log(`[collector] reached cap of ${MAX_NEW_CLASSIFICATIONS_PER_RUN} new classifications for "${term.query_display}"`);
        break;
      }
      const hash = contentHash(cand.source_url);
      if (seen.has(hash)) continue;
      seen.add(hash);

      // Pre-filter (token-based). Inherently on-topic sources (company page /
      // newsroom) carry prefiltered=true and skip this.
      if (!cand.prefiltered) {
        const haystack = `${cand.title} ${cand.excerpt ?? ''}`;
        if (!matchesQuery(term.query_normalized, haystack, watchType)) continue;
      }

      // --- Upsert article (global dedup on content_hash) ---
      const inserted = await db.insert(articles).values({
        content_hash: hash,
        source_url: cand.source_url,
        source_type: cand.source_type,
        source_name: cand.source_name ?? null,
        original_title: cand.title,
        raw_excerpt: cand.excerpt ?? null,
        author: cand.author ?? null,
        reactions: cand.reactions ?? 0,
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
        content: `${cand.title}\n\n${cand.excerpt ?? ''}`.trim(),
        searchQuery: term.query_display,
        watchType,
        sourceType: cand.source_type,
      };

      let result;
      try {
        result = await classify(input, aiCfg.model, aiCfg.variant);
      } catch (err) {
        console.error(`[collector] classify failed (article ${articleId}):`, err instanceof Error ? err.message : err);
        continue; // skip this article, keep the run alive
      }

      await db.insert(classifications).values({
        article_id: articleId,
        search_term_id: term.id,
        title: result.title,
        summary: result.summary,
        rank: result.rank,
        rank_reason: result.rank_reason,
        sentiment: result.sentiment,
        tags: result.tags,
        signal_type: watchType === 'company' ? (result.signal_type ?? 'general') : null,
        ai_model_used: aiCfg.variant ?? aiCfg.model,
      }).onConflictDoNothing({ target: [classifications.article_id, classifications.search_term_id] });

      summary.classifications_new++;
    }

    await db.update(job_runs).set({
      status: 'success',
      articles_found: summary.articles_found,
      articles_new: summary.articles_new,
      classifications_new: summary.classifications_new,
      completed_at: new Date(),
    }).where(eq(job_runs.id, run.id));

    await db.update(search_terms).set({ last_run_at: new Date() }).where(eq(search_terms.id, term.id));
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

/** Batch collection over all active search_terms. */
export async function collectAll(trigger: 'scheduled' | 'manual'): Promise<RunSummary[]> {
  const terms = await db.select().from(search_terms).where(eq(search_terms.is_active, true));
  console.log(`[collector] collecting ${terms.length} active search_terms ...`);
  const summaries: RunSummary[] = [];
  for (const term of terms) {
    const s = await collectForSearchTerm(term, trigger);
    summaries.push(s);
    console.log(`[collector] term "${term.query_display}" → ${s.status} (new articles: ${s.articles_new}, classifications: ${s.classifications_new})`);
  }
  // Notifications fan-out → Meilenstein 3.
  return summaries;
}
