import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  articles, classifications, search_terms, settings,
  user_article_state, user_content_profiles, users, watch_items,
} from '../db/schema';
import {
  AiModel, FewShotExample, personalizeRank, ProfileFeedbackItem,
  RelevanceExample, summarizeContentProfile,
} from './ai/classifier';

/** Below this many 👍/👎 a global content profile isn't meaningful — clear it. */
const PROFILE_MIN_FEEDBACK = 2;

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

// ---------- Global content profile (keyword-übergreifend) ----------

/**
 * ALL of a user's 👍/👎 across ALL keywords (newest first), each tagged with the
 * keyword it was rated under. This is the raw material for the global content
 * profile — unlike loadUserFeedback it is deliberately NOT term-scoped, so the
 * AI can learn what CONTENT the reader values regardless of keyword.
 */
export async function loadAllUserFeedback(userId: string, limit = 40): Promise<ProfileFeedbackItem[]> {
  try {
    const rows = await db
      .select({
        keyword: search_terms.query_display,
        feedback: user_article_state.user_feedback,
        content: sql<string>`COALESCE(${articles.original_title}, '') || ' ' || COALESCE(${articles.raw_excerpt}, '')`,
      })
      .from(user_article_state)
      .innerJoin(classifications, eq(classifications.id, user_article_state.classification_id))
      .innerJoin(search_terms, eq(search_terms.id, classifications.search_term_id))
      .innerJoin(articles, eq(articles.id, classifications.article_id))
      .where(and(eq(user_article_state.user_id, userId), isNotNull(user_article_state.user_feedback)))
      .orderBy(desc(user_article_state.updated_at))
      .limit(limit);
    return rows
      .filter((r): r is { keyword: string; feedback: 'up' | 'down'; content: string } => r.feedback === 'up' || r.feedback === 'down')
      .map((r) => ({ keyword: r.keyword, feedback: r.feedback, content: r.content.trim().replace(/\s+/g, ' ').slice(0, 160) }));
  } catch { return []; }
}

/** The stored global content profile for a user, or null if none/blank. */
export async function loadContentProfile(userId: string): Promise<string | null> {
  try {
    const [row] = await db.select({ profile: user_content_profiles.profile })
      .from(user_content_profiles).where(eq(user_content_profiles.user_id, userId));
    return row?.profile?.trim() ? row.profile.trim() : null;
  } catch { return null; }
}

/**
 * Re-distil & persist the user's GLOBAL content profile from all their 👍/👎
 * across every keyword. Called right after a user votes, so the very next
 * ranking (this term now, other terms on their next collection/rerank) reflects
 * it. Below PROFILE_MIN_FEEDBACK signals the profile is cleared (feed falls back
 * to term-scoped feedback + base rank). Never throws — on failure the previous
 * profile is kept. Returns the current profile text (or null).
 */
export async function rebuildContentProfile(userId: string): Promise<string | null> {
  const items = await loadAllUserFeedback(userId);
  if (items.length < PROFILE_MIN_FEEDBACK) {
    await db.delete(user_content_profiles).where(eq(user_content_profiles.user_id, userId));
    return null;
  }
  const ai = await getActiveAiConfig();
  let profile: string;
  try {
    profile = await summarizeContentProfile(items, ai.model, ai.variant, ai.language);
  } catch (err) {
    console.error('[content-profile] build failed for', userId, err instanceof Error ? err.message : err);
    return loadContentProfile(userId); // keep whatever we had
  }
  if (!profile.trim()) return loadContentProfile(userId);

  await db.insert(user_content_profiles).values({
    user_id: userId, profile, feedback_count: items.length, built_at: new Date(), updated_at: new Date(),
  }).onConflictDoUpdate({
    target: user_content_profiles.user_id,
    set: { profile, feedback_count: items.length, built_at: new Date(), updated_at: new Date() },
  });
  console.log(`[content-profile] user ${userId}: Profil aus ${items.length} Bewertungen aktualisiert`);
  return profile;
}

/**
 * Immediate, automatic learning: right after a user gives feedback (in-app OR
 * Telegram) on a term, re-rank that user's recent articles for the SAME term
 * using their current 👍/👎 + rank corrections. No manual "Reranking" needed.
 * User- and term-scoped + bounded so it's fast enough to await inside a request.
 * If the user has no remaining signal for the term, personalisation is cleared
 * (the feed falls back to the shared base rank). Returns rows touched.
 */
export async function repersonalizeUserTerm(
  userId: string,
  searchTermId: string,
  limit = 15,
  opts?: { skipProfileRebuild?: boolean },
): Promise<number> {
  const [term] = await db.select({ query: search_terms.query_display, type: search_terms.type })
    .from(search_terms).where(eq(search_terms.id, searchTermId));
  if (!term) return 0;

  // Refresh the GLOBAL, keyword-übergreifende Profil first, so this very vote
  // also teaches the AI which CONTENT matters — not just this keyword. Bulk
  // re-apply passes skipProfileRebuild (profiles are seeded once up front).
  const profile = opts?.skipProfileRebuild
    ? await loadContentProfile(userId)
    : await rebuildContentProfile(userId);

  const [feedback, corrections] = await Promise.all([
    loadUserFeedback(userId, searchTermId),
    loadUserCorrections(userId, searchTermId),
  ]);

  const rows = await db.select({
    id: classifications.id,
    baseRank: classifications.rank,
    title: articles.original_title,
    excerpt: articles.raw_excerpt,
    full_text: articles.full_text,
  })
    .from(classifications)
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .where(eq(classifications.search_term_id, searchTermId))
    .orderBy(desc(classifications.created_at))
    .limit(Math.min(200, limit));

  // No signal left at all (term feedback AND global profile) → clear any
  // personalisation so the feed resets to the shared base rank.
  if (feedback.length === 0 && corrections.length === 0 && !profile) {
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await db.update(user_article_state)
        .set({ personal_rank: null, personal_rank_reason: null, personal_rank_at: null, updated_at: new Date() })
        .where(and(eq(user_article_state.user_id, userId), inArray(user_article_state.classification_id, ids)));
    }
    return 0;
  }

  const ai = await getActiveAiConfig();
  const watchType = term.type as 'topic' | 'company';
  let n = 0;
  const CHUNK = 5;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const ranks = await Promise.all(rows.slice(i, i + CHUNK).map(async (r) => {
      const content = `${r.title ?? ''}\n\n${r.full_text ?? r.excerpt ?? ''}`.trim();
      try {
        const { rank, rank_reason } = await personalizeRank(
          { content, searchQuery: term.query, watchType, baseRank: r.baseRank, language: ai.language },
          ai.model, ai.variant,
          { relevanceFeedback: feedback, fewShotExamples: corrections, contentProfile: profile ?? undefined },
        );
        await db.insert(user_article_state).values({
          user_id: userId, classification_id: r.id,
          personal_rank: rank, personal_rank_reason: rank_reason || null, personal_rank_at: new Date(),
        }).onConflictDoUpdate({
          target: [user_article_state.user_id, user_article_state.classification_id],
          set: { personal_rank: rank, personal_rank_reason: rank_reason || null, personal_rank_at: new Date(), updated_at: new Date() },
        });
        return 1;
      } catch (err) {
        console.error('[repersonalize] failed for', r.id, err instanceof Error ? err.message : err);
        return 0;
      }
    }));
    n += ranks.reduce((a: number, b) => a + b, 0);
  }
  if (n > 0) console.log(`[repersonalize] user ${userId} term ${searchTermId}: ${n} Artikel sofort neu personalisiert`);
  return n;
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
  /**
   * Caches each user's GLOBAL content profile (keyword-übergreifend) so we load
   * it once per run. Key is `${userId}`. Unlike `cache`, this signal applies to
   * every term — it's how content (not just the keyword) drives the ranking.
   */
  profileCache: Map<string, string | null>;
}

export async function makePersonalizeContext(): Promise<PersonalizeContext> {
  const ai = await getActiveAiConfig();
  return { model: ai.model, variant: ai.variant, language: ai.language, cache: new Map(), profileCache: new Map() };
}

/** One user's global content profile, loaded once per run and cached. */
async function userProfile(userId: string, ctx: PersonalizeContext): Promise<string | null> {
  const hit = ctx.profileCache.get(userId);
  if (hit !== undefined) return hit;
  const p = await loadContentProfile(userId);
  ctx.profileCache.set(userId, p);
  return p;
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
    const profile = await userProfile(sub.user_id, ctx);
    // Personalise if the user has term-specific feedback OR a global content
    // profile — the latter lets a 👍 on keyword A lift similar content under
    // keyword B, even with no feedback on B.
    if (!sig.hasAny && !profile) continue;
    try {
      const { rank, rank_reason } = await personalizeRank(
        { content: params.content, searchQuery: params.searchQuery, watchType: params.watchType, baseRank: params.baseRank, language: ctx.language },
        ctx.model, ctx.variant,
        { relevanceFeedback: sig.feedback, fewShotExamples: sig.corrections, contentProfile: profile ?? undefined },
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
