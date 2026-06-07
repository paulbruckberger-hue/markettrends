import { eq, lt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, search_terms } from '../db/schema';
import { classify, ClassificationInput, RANK_PROMPT_VERSION } from './ai/classifier';
import { getAppConfig } from '../lib/appConfig';
import { loadGlobalFewShot, makePersonalizeContext, personalizeClassification } from './personalize';
import { WatchType } from '../types';

export interface RerankProgress {
  total: number;        // all classifications
  done: number;         // already at current prompt version
  remaining: number;    // still on an older version
  version: number;      // current RANK_PROMPT_VERSION
}

/** Count how many classifications still carry an outdated ranking-prompt version. */
export async function rerankStatus(): Promise<RerankProgress> {
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(classifications);
  const [{ stale }] = await db.select({ stale: sql<number>`count(*)::int` })
    .from(classifications)
    .where(lt(classifications.rank_prompt_version, RANK_PROMPT_VERSION));
  return { total, done: total - stale, remaining: stale, version: RANK_PROMPT_VERSION };
}

/**
 * Re-rank a batch of stale classifications with the current base prompt, then
 * recompute per-user personalised ranks for subscribers with feedback. Resumable
 * and idempotent: only rows with rank_prompt_version < CURRENT are touched, and
 * each processed row is stamped to the current version. Returns batch progress.
 */
export async function rerankBatch(limit = 20): Promise<{ processed: number; personalised: number; remaining: number; done: boolean }> {
  const safeLimit = Math.min(40, Math.max(1, limit));
  const [appCfg, fewShot, ctx] = await Promise.all([getAppConfig(), loadGlobalFewShot(), makePersonalizeContext()]);

  const rows = await db.select({
    id: classifications.id,
    search_term_id: classifications.search_term_id,
    title: articles.original_title,
    excerpt: articles.raw_excerpt,
    full_text: articles.full_text,
    source_type: articles.source_type,
    query_display: search_terms.query_display,
    type: search_terms.type,
  })
    .from(classifications)
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .innerJoin(search_terms, eq(search_terms.id, classifications.search_term_id))
    .where(lt(classifications.rank_prompt_version, RANK_PROMPT_VERSION))
    .orderBy(classifications.created_at)
    .limit(safeLimit);

  let processed = 0;
  let personalised = 0;

  for (const r of rows) {
    const watchType = r.type as WatchType;
    const content = `${r.title ?? ''}\n\n${r.full_text ?? r.excerpt ?? ''}`.trim();
    const input: ClassificationInput = {
      content, searchQuery: r.query_display, watchType, sourceType: r.source_type, language: ctx.language,
    };
    try {
      const result = await classify(input, ctx.model, ctx.variant, {
        rankCriteria: appCfg.rank_criteria,
        fewShotExamples: fewShot,
      });
      await db.update(classifications).set({
        rank: result.rank,
        rank_reason: result.rank_reason,
        signal_type: watchType === 'company' ? (result.signal_type ?? 'general') : null,
        rank_prompt_version: RANK_PROMPT_VERSION,
      }).where(eq(classifications.id, r.id));
      processed++;
      personalised += await personalizeClassification({
        ctx, classificationId: r.id, searchTermId: r.search_term_id,
        content, searchQuery: r.query_display, watchType, baseRank: result.rank,
      });
    } catch (err) {
      // Stamp the version anyway so a poison row can't stall the resumable loop.
      console.error('[rerank] failed for classification', r.id, err instanceof Error ? err.message : err);
      await db.update(classifications).set({ rank_prompt_version: RANK_PROMPT_VERSION }).where(eq(classifications.id, r.id));
    }
  }

  const status = await rerankStatus();
  return { processed, personalised, remaining: status.remaining, done: status.remaining === 0 };
}
