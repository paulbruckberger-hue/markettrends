import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, settings, user_article_state, users, watch_items } from '../db/schema';
import {
  AiModel, FewShotExample, personalizeRank, RelevanceExample,
} from './ai/classifier';

/**
 * Determine which AI model/variant/language to use for the (shared) base
 * classification and for per-user re-ranking. Reads the admin's settings.
 */
export async function getActiveAiConfig(): Promise<{ model: AiModel; variant?: string; language: string }> {
  const [admin] = await db.select().from(users).where(eq(users.role, 'admin'));
  if (admin) {
    const [s] = await db.select().from(settings).where(eq(settings.user_id, admin.id));
    if (s) return { model: s.ai_model as AiModel, variant: s.ai_model_variant ?? undefined, language: s.language ?? 'de' };
  }
  return { model: 'claude', language: 'de' };
}

/**
 * Rank corrections for ONE search term (any user) — objective calibration for
 * that term's shared base rank. Term-scoped on purpose: corrections made on
 * keyword A must never influence the base ranking of keyword B.
 */
export async function loadTermFewShot(searchTermId: string, limit = 10): Promise<FewShotExample[]> {
  try {
    const rows = await db
      .select({
        content: sql<string>`COALESCE(${articles.original_title}, '') || ' ' || COALESCE(${articles.raw_excerpt}, '')`,
        ai_rank: classifications.rank,
        user_rank: user_article_state.user_rank_override,
      })
      .from(user_article_state)
      .innerJoin(classifications, eq(classifications.id, user_article_state.classification_id))
      .innerJoin(articles, eq(articles.id, classifications.article_id))
      .where(and(
        eq(classifications.search_term_id, searchTermId),
        isNotNull(user_article_state.user_rank_override),
        ne(user_article_state.user_rank_override, classifications.rank),
      ))
      .orderBy(desc(user_article_state.updated_at))
      .limit(limit);
    return rows
      .filter((r) => r.user_rank !== null)
      .map((r) => ({ content: r.content.trim(), ai_rank: r.ai_rank, user_rank: r.user_rank as number }));
  } catch { return []; }
}

/** One user's 👍/👎 relevance feedback for ONE search term (this user, this keyword only). */
export async function loadUserFeedback(userId: string, searchTermId: string, limit = 12): Promise<RelevanceExample[]> {
  try {
    const rows = await db
      .select({
        content: sql<string>`COALESCE(${articles.original_title}, '') || ' ' || COALESCE(${articles.raw_excerpt}, '')`,
        feedback: user_article_state.user_feedback,
      })
      .from(user_article_state)
      .innerJoin(classifications, eq(classifications.id, user_article_state.classification_id))
      .innerJoin(articles, eq(articles.id, classifications.article_id))
      .where(and(
        eq(user_article_state.user_id, userId),
        eq(classifications.search_term_id, searchTermId),
        isNotNull(user_article_state.user_feedback),
      ))
      .orderBy(desc(user_article_state.updated_at))
      .limit(limit);
    return rows
      .filter((r): r is { content: string; feedback: 'up' | 'down' } => r.feedback === 'up' || r.feedback === 'down')
      .map((r) => ({ content: r.content.trim(), feedback: r.feedback }));
  } catch { return []; }
}

/** One user's own rank corrections for ONE search term (this user, this keyword only). */
export async function loadUserCorrections(userId: string, searchTermId: string, limit = 8): Promise<FewShotExample[]> {
  try {
    const rows = await db
      .select({
        content: sql<string>`COALESCE(${articles.original_title}, '') || ' ' || COALESCE(${articles.raw_excerpt}, '')`,
        ai_rank: classifications.rank,
        user_rank: user_article_state.user_rank_override,
      })
      .from(user_article_state)
      .innerJoin(classifications, eq(classifications.id, user_article_state.classification_id))
      .innerJoin(articles, eq(articles.id, classifications.article_id))
      .where(and(
        eq(user_article_state.user_id, userId),
        eq(classifications.search_term_id, searchTermId),
        isNotNull(user_article_state.user_rank_override),
        ne(user_article_state.user_rank_override, classifications.rank),
      ))
      .orderBy(desc(user_article_state.updated_at))
      .limit(limit);
    return rows
      .filter((r) => r.user_rank !== null)
      .map((r) => ({ content: r.content.trim(), ai_rank: r.ai_rank, user_rank: r.user_rank as number }));
  } catch { return []; }
}

interface UserSignals { feedback: RelevanceExample[]; corrections: FewShotExample[]; hasAny: boolean }

export interface PersonalizeContext {
  model: AiModel;
  variant?: string;
  language: string;
  /**
   * Caches each user's per-term feedback so we load it once per run, not per
   * article. Key is `${userId}:${searchTermId}` — feedback is scoped to the
   * keyword, so learning on one term never bleeds into another.
   */
  cache: Map<string, UserSignals>;
}

export async function makePersonalizeContext(): Promise<PersonalizeContext> {
  const ai = await getActiveAiConfig();
  return { model: ai.model, variant: ai.variant, language: ai.language, cache: new Map() };
}

async function userSignals(userId: string, searchTermId: string, ctx: PersonalizeContext): Promise<UserSignals> {
  const key = `${userId}:${searchTermId}`;
  const cached = ctx.cache.get(key);
  if (cached) return cached;
  const [feedback, corrections] = await Promise.all([
    loadUserFeedback(userId, searchTermId),
    loadUserCorrections(userId, searchTermId),
  ]);
  const sig: UserSignals = { feedback, corrections, hasAny: feedback.length > 0 || corrections.length > 0 };
  ctx.cache.set(key, sig);
  return sig;
}

/**
 * Compute & store a per-user personalised rank for one classification, for every
 * active subscriber of the term who has given feedback ON THIS TERM. Feedback is
 * scoped to (user, search_term), so a user's 👍/👎 on one keyword never affects
 * how their articles for another keyword are ranked. Returns how many users were
 * personalised. Never throws — a failed user is logged and skipped.
 */
export async function personalizeClassification(params: {
  ctx: PersonalizeContext;
  classificationId: string;
  searchTermId: string;
  content: string;
  searchQuery: string;
  watchType: 'topic' | 'company';
  baseRank: number;
}): Promise<number> {
  const { ctx } = params;
  const subs = await db.select({ user_id: watch_items.user_id })
    .from(watch_items)
    .where(and(eq(watch_items.search_term_id, params.searchTermId), eq(watch_items.is_active, true)));

  let personalised = 0;
  for (const sub of subs) {
    const sig = await userSignals(sub.user_id, params.searchTermId, ctx);
    if (!sig.hasAny) continue;
    try {
      const { rank, rank_reason } = await personalizeRank(
        { content: params.content, searchQuery: params.searchQuery, watchType: params.watchType, baseRank: params.baseRank, language: ctx.language },
        ctx.model, ctx.variant,
        { relevanceFeedback: sig.feedback, fewShotExamples: sig.corrections },
      );
      await db.insert(user_article_state).values({
        user_id: sub.user_id,
        classification_id: params.classificationId,
        personal_rank: rank,
        personal_rank_reason: rank_reason || null,
        personal_rank_at: new Date(),
      }).onConflictDoUpdate({
        target: [user_article_state.user_id, user_article_state.classification_id],
        set: { personal_rank: rank, personal_rank_reason: rank_reason || null, personal_rank_at: new Date(), updated_at: new Date() },
      });
      personalised++;
    } catch (err) {
      console.error('[personalize] failed for user', sub.user_id, err instanceof Error ? err.message : err);
    }
  }
  return personalised;
}
