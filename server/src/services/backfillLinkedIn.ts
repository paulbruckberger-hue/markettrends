import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, search_terms, RankCriteria } from '../db/schema';
import { contentHash } from '../lib/hash';
import { matchesQuery } from '../lib/matchesQuery';
import { classify, ClassificationInput, RANK_PROMPT_VERSION } from './ai/classifier';
import { getActiveAiConfig, loadTermFewShot, makePersonalizeContext, personalizeClassification, PersonalizeContext } from './personalize';
import { getAppConfig } from '../lib/appConfig';
import { getDatasetItems, getRunInput, listActorRuns } from './sources/apifyClient';
import { LINKEDIN_POST_ACTOR, mapLinkedInPost } from './sources/apifyLinkedIn';
import { SourceArticle } from './sources/types';
import { SourceTypeName, WatchType } from '../types';
import { FewShotExample, AiModel } from './ai/classifier';

/**
 * Backfill: classify LinkedIn posts that were ALREADY scraped (and already paid
 * for) in past Apify runs, WITHOUT launching any new scrape. We read each past
 * run's INPUT (to learn which keyword produced it), match it to a search_term,
 * pull the run's existing dataset items, and run them through the same
 * dedup → classify → personalise pipeline as the live collector. Fully
 * idempotent (article + classification dedup), so re-running is safe.
 */

type Term = typeof search_terms.$inferSelect;
interface RunInput { searchQueries?: string[]; authorUrls?: string[] }

const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');
function companyUrl(id: string): string {
  const t = id.trim();
  return t.startsWith('http') ? t : `https://www.linkedin.com/company/${t}`;
}

export interface BackfillBatchResult {
  processedRuns: number;
  skippedRuns: number;
  items: number;
  articlesNew: number;
  classificationsNew: number;
  offset: number;
  nextOffset: number;
  totalRuns: number;
  done: boolean;
  runs: { runId: string; query?: string; term?: string; items: number; classified: number; skipped?: string }[];
}

/** Count of past SUCCEEDED runs available to backfill. */
export async function backfillLinkedInStatus(): Promise<{ totalRuns: number }> {
  const { total } = await listActorRuns(LINKEDIN_POST_ACTOR, { status: 'SUCCEEDED', limit: 1, offset: 0 });
  return { totalRuns: total };
}

async function classifyAndStore(
  cand: SourceArticle,
  term: Term,
  watchType: WatchType,
  ai: { model: AiModel; variant?: string; language: string },
  rankCriteria: RankCriteria,
  fewShot: FewShotExample[],
  ctx: PersonalizeContext,
): Promise<{ articleNew: boolean; classified: boolean }> {
  const hash = contentHash(cand.source_url);

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
  let articleNew = false;
  if (inserted.length) {
    articleId = inserted[0].id;
    articleNew = true;
  } else {
    const [existing] = await db.select({ id: articles.id }).from(articles).where(eq(articles.content_hash, hash));
    if (!existing) return { articleNew: false, classified: false };
    articleId = existing.id;
  }

  const [already] = await db.select({ id: classifications.id })
    .from(classifications)
    .where(and(eq(classifications.article_id, articleId), eq(classifications.search_term_id, term.id)));
  if (already) return { articleNew, classified: false };

  const input: ClassificationInput = {
    content: `${cand.title}\n\n${cand.full_text ?? cand.excerpt ?? ''}`.trim(),
    searchQuery: term.query_display,
    watchType,
    sourceType: cand.source_type,
    language: ai.language,
  };

  let result;
  try {
    result = await classify(input, ai.model, ai.variant, { rankCriteria, fewShotExamples: fewShot });
  } catch (err) {
    console.error('[backfill] classify failed:', err instanceof Error ? err.message : err);
    return { articleNew, classified: false };
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
    ai_model_used: ai.variant ?? ai.model,
    rank_prompt_version: RANK_PROMPT_VERSION,
  }).onConflictDoNothing({ target: [classifications.article_id, classifications.search_term_id] })
    .returning({ id: classifications.id });

  if (insertedCls) {
    try {
      await personalizeClassification({
        ctx, classificationId: insertedCls.id, searchTermId: term.id,
        content: input.content, searchQuery: term.query_display, watchType, baseRank: result.rank,
      });
    } catch (err) {
      console.error('[backfill] personalize failed:', err instanceof Error ? err.message : err);
    }
  }
  return { articleNew, classified: true };
}

/**
 * Process a batch of `maxRuns` past runs starting at `offset` (newest first).
 * Resumable: call repeatedly with the returned nextOffset until done. Small
 * batches keep each request comfortably under the request timeout.
 */
export async function backfillLinkedInRuns(offset = 0, maxRuns = 3): Promise<BackfillBatchResult> {
  const terms = await db.select().from(search_terms);
  const byQuery = new Map<string, Term>();
  const byCompany = new Map<string, Term>();
  for (const t of terms) {
    byQuery.set(norm(t.query_normalized), t);
    for (const a of (t.aliases ?? [])) if (a?.q) byQuery.set(norm(a.q), t);
    if (t.company_linkedin_id) byCompany.set(norm(companyUrl(t.company_linkedin_id)), t);
  }

  const [{ total, items: runs }, appCfg, ai] = await Promise.all([
    listActorRuns(LINKEDIN_POST_ACTOR, { status: 'SUCCEEDED', limit: maxRuns, offset }),
    getAppConfig(),
    getActiveAiConfig(),
  ]);
  const ctx = await makePersonalizeContext();

  const res: BackfillBatchResult = {
    processedRuns: 0, skippedRuns: 0, items: 0, articlesNew: 0, classificationsNew: 0,
    offset, nextOffset: offset + runs.length, totalRuns: total, done: offset + runs.length >= total, runs: [],
  };

  for (const run of runs) {
    res.processedRuns++;
    const detail: BackfillBatchResult['runs'][number] = { runId: run.id, items: 0, classified: 0 };

    if (!run.defaultKeyValueStoreId || !run.defaultDatasetId) {
      detail.skipped = 'kein Store'; res.skippedRuns++; res.runs.push(detail); continue;
    }
    const input = await getRunInput<RunInput>(run.defaultKeyValueStoreId);
    let term: Term | undefined;
    let sourceType: SourceTypeName;
    let prefiltered: boolean;
    if (input?.searchQueries?.length) {
      detail.query = input.searchQueries[0];
      term = byQuery.get(norm(input.searchQueries[0]));
      sourceType = 'linkedin_post'; prefiltered = false;
    } else if (input?.authorUrls?.length) {
      detail.query = input.authorUrls[0];
      term = byCompany.get(norm(input.authorUrls[0]));
      sourceType = 'linkedin_company'; prefiltered = true;
    } else {
      detail.skipped = 'kein Input'; res.skippedRuns++; res.runs.push(detail); continue;
    }
    if (!term) { detail.skipped = 'kein passendes Keyword'; res.skippedRuns++; res.runs.push(detail); continue; }
    detail.term = term.query_display;

    const fewShot = await loadTermFewShot(term.id);
    const watchType = term.type as WatchType;
    const matchTerms = [term.query_normalized, ...(term.aliases ?? []).map((a) => a.q)];

    // Map + dedup the run's dataset items up front, then classify in parallel
    // chunks. Article/classification dedup is enforced at the DB level too.
    const rawItems = await getDatasetItems(run.defaultDatasetId);
    detail.items = rawItems.length; res.items += rawItems.length;
    const seen = new Set<string>();
    const cands: SourceArticle[] = [];
    for (const raw of rawItems) {
      const cand = mapLinkedInPost(raw, sourceType, prefiltered);
      if (!cand) continue;
      const h = contentHash(cand.source_url);
      if (seen.has(h)) continue;
      seen.add(h);
      if (!cand.prefiltered) {
        const hay = `${cand.title} ${cand.excerpt ?? ''}`;
        if (!matchTerms.some((mt) => matchesQuery(mt, hay, watchType))) continue;
      }
      cands.push(cand);
    }

    const CHUNK = 5;
    for (let i = 0; i < cands.length; i += CHUNK) {
      const outcomes = await Promise.all(
        cands.slice(i, i + CHUNK).map((c) => classifyAndStore(c, term as Term, watchType, ai, appCfg.rank_criteria, fewShot, ctx)),
      );
      for (const o of outcomes) {
        if (o.articleNew) res.articlesNew++;
        if (o.classified) { res.classificationsNew++; detail.classified++; }
      }
    }
    res.runs.push(detail);
  }

  return res;
}
