import { Router, Response } from 'express';
import { and, asc, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, user_article_state, watch_items } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { repersonalizeUserTerm } from '../services/personalize';
import { SourceTypeName } from '../types';

export const articlesRouter = Router();
articlesRouter.use(authMiddleware);

const SOURCE_TYPES: SourceTypeName[] = ['linkedin_post', 'linkedin_company', 'google_news', 'rss', 'newsroom'];

function periodCutoff(period: unknown): Date | null {
  const map: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };
  const days = typeof period === 'string' ? map[period] : undefined;
  if (!days) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const feedColumns = {
  classification_id: classifications.id,
  title: classifications.title,
  summary: classifications.summary,
  // Effective rank shown to THIS user: manual override > per-user personalised > shared base.
  rank: sql<number>`COALESCE(${user_article_state.user_rank_override}, ${user_article_state.personal_rank}, ${classifications.rank})`,
  ai_rank: classifications.rank,
  rank_reason: sql<string>`COALESCE(${user_article_state.personal_rank_reason}, ${classifications.rank_reason})`,
  sentiment: classifications.sentiment,
  tags: classifications.tags,
  signal_type: classifications.signal_type,
  ai_model_used: classifications.ai_model_used,
  classified_at: classifications.created_at,
  article_id: articles.id,
  source_url: articles.source_url,
  source_type: articles.source_type,
  source_name: articles.source_name,
  source_language: articles.source_language,
  original_title: articles.original_title,
  full_text: articles.full_text,
  author: articles.author,
  author_info: articles.author_info,
  author_type: articles.author_type,
  reactions: articles.reactions,
  comments_count: articles.comments_count,
  shares_count: articles.shares_count,
  extra_data: articles.extra_data,
  published_at: articles.published_at,
  is_read: sql<boolean>`COALESCE(${user_article_state.is_read}, false)`,
  is_bookmarked: sql<boolean>`COALESCE(${user_article_state.is_bookmarked}, false)`,
  user_rank_override: user_article_state.user_rank_override,
  user_feedback: user_article_state.user_feedback,
  watch_item_id: watch_items.id,
  watch_display_name: watch_items.display_name,
  watch_color: watch_items.color,
};

// GET /api/articles
articlesRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;

  const rank = Number(req.query.rank);
  const watchItemId = typeof req.query.watch_item_id === 'string' ? req.query.watch_item_id : undefined;
  const sourceType = typeof req.query.source_type === 'string' ? req.query.source_type : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const sort = req.query.sort === 'latest' ? 'latest' : 'top';
  const bookmarkedOnly = req.query.bookmarked === '1' || req.query.bookmarked === 'true';
  const feedback = req.query.feedback === 'up' || req.query.feedback === 'down' ? req.query.feedback : undefined;
  const sentiment = req.query.sentiment === 'positive' || req.query.sentiment === 'neutral' || req.query.sentiment === 'negative'
    ? req.query.sentiment : undefined;
  const cutoff = periodCutoff(req.query.period);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions = [eq(watch_items.user_id, userId), eq(watch_items.is_active, true)];
  if (rank === 1 || rank === 2 || rank === 3) conditions.push(eq(classifications.rank, rank));
  if (watchItemId) conditions.push(eq(watch_items.id, watchItemId));
  if (sourceType && (SOURCE_TYPES as string[]).includes(sourceType)) {
    conditions.push(eq(articles.source_type, sourceType as SourceTypeName));
  }
  if (bookmarkedOnly) conditions.push(eq(user_article_state.is_bookmarked, true));
  if (feedback) conditions.push(eq(user_article_state.user_feedback, feedback));
  if (sentiment) conditions.push(eq(classifications.sentiment, sentiment));
  if (cutoff) conditions.push(gte(articles.published_at, cutoff));
  if (search) {
    // Full-content search across every article in the user's feed: the German
    // executive headline + summary, plus the original title, snippet and full text.
    const like = `%${search}%`;
    const searchCond = or(
      ilike(classifications.title, like),
      ilike(classifications.summary, like),
      ilike(articles.original_title, like),
      ilike(articles.raw_excerpt, like),
      ilike(articles.full_text, like),
    );
    if (searchCond) conditions.push(searchCond);
  }

  const orderBy = sort === 'latest'
    ? [desc(sql`COALESCE(${articles.published_at}, ${articles.created_at})`)]
    : [
        asc(sql`COALESCE(${user_article_state.user_rank_override}, ${user_article_state.personal_rank}, ${classifications.rank})`),
        desc(sql`COALESCE(${articles.published_at}, ${articles.created_at})`),
      ];

  const rows = await db.select(feedColumns)
    .from(watch_items)
    .innerJoin(classifications, eq(classifications.search_term_id, watch_items.search_term_id))
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .leftJoin(user_article_state, and(
      eq(user_article_state.classification_id, classifications.id),
      eq(user_article_state.user_id, userId),
    ))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  res.json({ items: rows.slice(0, limit), page, limit, hasMore });
});

// GET /api/articles/:classificationId
articlesRouter.get('/:classificationId', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const [row] = await db.select(feedColumns)
    .from(watch_items)
    .innerJoin(classifications, eq(classifications.search_term_id, watch_items.search_term_id))
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .leftJoin(user_article_state, and(
      eq(user_article_state.classification_id, classifications.id),
      eq(user_article_state.user_id, userId),
    ))
    .where(and(eq(classifications.id, req.params.classificationId), eq(watch_items.user_id, userId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  res.json(row);
});

// PATCH /api/articles/:classificationId  → schreibt user_article_state
articlesRouter.patch('/:classificationId', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const classificationId = req.params.classificationId;
  const b = req.body ?? {};

  // Ensure the user actually subscribes to this classification's term.
  const [allowed] = await db.select({ id: classifications.id, search_term_id: classifications.search_term_id })
    .from(classifications)
    .innerJoin(watch_items, eq(watch_items.search_term_id, classifications.search_term_id))
    .where(and(eq(classifications.id, classificationId), eq(watch_items.user_id, userId)))
    .limit(1);
  if (!allowed) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }

  const feedbackValid = b.user_feedback === null || b.user_feedback === 'up' || b.user_feedback === 'down';

  const set: Record<string, unknown> = { updated_at: new Date() };
  if (typeof b.is_read === 'boolean') set.is_read = b.is_read;
  if (typeof b.is_bookmarked === 'boolean') set.is_bookmarked = b.is_bookmarked;
  if (b.user_rank_override === null || typeof b.user_rank_override === 'number') {
    set.user_rank_override = b.user_rank_override;
  }
  if (feedbackValid) set.user_feedback = b.user_feedback;

  const [state] = await db.insert(user_article_state).values({
    user_id: userId,
    classification_id: classificationId,
    is_read: typeof b.is_read === 'boolean' ? b.is_read : false,
    is_bookmarked: typeof b.is_bookmarked === 'boolean' ? b.is_bookmarked : false,
    user_rank_override: typeof b.user_rank_override === 'number' ? b.user_rank_override : null,
    user_feedback: feedbackValid ? b.user_feedback : null,
  }).onConflictDoUpdate({
    target: [user_article_state.user_id, user_article_state.classification_id],
    set,
  }).returning();

  // Relevance feedback → learn immediately: re-rank this user's recent articles
  // for the same term. Awaited so the feed refetch reflects the new order; the
  // optimistic UI already flipped the button, so the latency is not user-blocking.
  if (feedbackValid) {
    try {
      await repersonalizeUserTerm(userId, allowed.search_term_id);
    } catch (err) {
      console.error('[articles] repersonalize failed:', err instanceof Error ? err.message : err);
    }
  }

  res.json(state);
});
