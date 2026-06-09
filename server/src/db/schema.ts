import {
  pgTable, uuid, text, integer, boolean,
  timestamp, jsonb, pgEnum, unique, primaryKey, index
} from 'drizzle-orm/pg-core';

// ---------- Enums ----------
export const watchTypeEnum = pgEnum('watch_type', ['topic', 'company']);
export const geoFilterEnum = pgEnum('geo_filter', ['global', 'dach', 'austria']);
export const aiModelEnum = pgEnum('ai_model', ['claude', 'gemini', 'deepseek']);
export const sourceTypeEnum = pgEnum('source_type', [
  'linkedin_post', 'linkedin_company', 'google_news', 'rss', 'newsroom'
]);
export const sentimentEnum = pgEnum('sentiment', ['positive', 'negative', 'neutral']);
export const signalTypeEnum = pgEnum('signal_type', [
  'product_launch', 'expansion', 'partnership', 'personnel',
  'funding', 'regulatory', 'earnings', 'general'
]);

// ---------- Users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  email: text('email'),
  role: text('role').notNull().default('user'),       // 'admin' | 'user'
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow()
});

// ---------- Search Terms (GETEILT, dedupliziert über alle User) ----------
// Hier läuft jede Suche genau einmal. Mehrere User-Abos zeigen auf dieselbe Zeile.
export const search_terms = pgTable('search_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: watchTypeEnum('type').notNull(),
  query_normalized: text('query_normalized').notNull(),  // lowercase/trimmed Suchbegriff
  query_display: text('query_display').notNull(),         // Original-Schreibweise
  geo_filter: geoFilterEnum('geo_filter').notNull().default('global'),

  // Nur für type='company'
  company_linkedin_id: text('company_linkedin_id'),
  company_newsroom_url: text('company_newsroom_url'),
  company_domain: text('company_domain'),

  // Welche Source-Typen für diesen Begriff abgefragt werden (geteilt)
  sources_config: jsonb('sources_config').$type<{
    linkedin_posts: boolean;
    linkedin_company_page: boolean;
    google_news: boolean;
    rss: boolean;
    newsroom: boolean;
  }>().notNull().default({
    linkedin_posts: true, linkedin_company_page: false,
    google_news: true, rss: true, newsroom: false
  }),

  // Multilingual search aliases (DE/EN/FR/ES/IT), generated once per shared term
  // by the AI on first collection. Each entry: { lang, q }. Empty = not yet generated.
  // For companies/brands the name is kept unchanged across languages.
  aliases: jsonb('aliases').$type<{ lang: string; q: string }[]>().default([]),

  is_active: boolean('is_active').notNull().default(true),  // true wenn ≥1 aktives Abo
  last_run_at: timestamp('last_run_at'),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  // DEDUP-KERN: ein Suchbegriff existiert nur einmal pro (Typ, Query, Geo)
  uniqTerm: unique('uniq_search_term').on(t.type, t.query_normalized, t.geo_filter),
  activeIdx: index('idx_search_terms_active').on(t.is_active)
}));

// ---------- Watch Items (USER-ABO auf einen search_term) ----------
export const watch_items = pgTable('watch_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  search_term_id: uuid('search_term_id').notNull().references(() => search_terms.id, { onDelete: 'restrict' }),

  display_name: text('display_name').notNull(),  // wie der User es nennt
  label: text('label'),                          // Kategorie z.B. "Wettbewerber"
  color: text('color').default('#3B82F6'),
  is_active: boolean('is_active').notNull().default(true),
  // null = default global schedule (every 6h); 'manual' = never auto-run; '24h' | '168h' = daily/weekly
  schedule_interval: text('schedule_interval'),
  // Free-text hint that guides the AI classifier: what matters for this specific subscription
  context_hint: text('context_hint'),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  uniqSub: unique('uniq_user_term').on(t.user_id, t.search_term_id),
  userIdx: index('idx_watch_items_user').on(t.user_id, t.is_active)
}));

// ---------- Articles (GLOBAL, dedupliziert per content_hash) ----------
// Reiner Content – keine Klassifikation, kein User.
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  content_hash: text('content_hash').notNull().unique(),  // MD5(normalisierte URL)
  source_url: text('source_url').notNull(),
  source_type: sourceTypeEnum('source_type').notNull(),
  source_name: text('source_name'),
  original_title: text('original_title'),
  raw_excerpt: text('raw_excerpt'),               // gekürzter Originaltext (für Re-Klassifikation)
  author: text('author'),
  author_info: text('author_info'),               // LinkedIn: Person-Headline oder Firmen-Tagline
  author_type: text('author_type'),               // 'profile' | 'company' | null
  reactions: integer('reactions').default(0),     // Likes
  comments_count: integer('comments_count').default(0),
  shares_count: integer('shares_count').default(0),
  full_text: text('full_text'),                   // vollständiger Originaltext (kein Limit)
  source_language: text('source_language'),       // 'de' | 'en' | null = unknown
  extra_data: jsonb('extra_data'),                // flexible: Post-Bilder, Post-ID etc.
  published_at: timestamp('published_at'),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  publishedIdx: index('idx_articles_published').on(t.published_at.desc())
}));

// ---------- Classifications (Artikel × search_term, dedupliziert) ----------
// Derselbe Artikel kann von mehreren search_terms gefunden & unterschiedlich bewertet werden.
export const classifications = pgTable('classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  article_id: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  search_term_id: uuid('search_term_id').notNull().references(() => search_terms.id, { onDelete: 'cascade' }),

  title: text('title').notNull(),               // Executive Headline (Deutsch)
  summary: text('summary').notNull(),           // 3 Bullet Points
  rank: integer('rank').notNull(),              // 1 | 2 | 3
  rank_reason: text('rank_reason'),
  sentiment: sentimentEnum('sentiment'),
  tags: jsonb('tags').$type<string[]>().default([]),
  // Named organisations/companies mentioned in the content (max ~6). Powers
  // automatic competitor detection + data-driven watch suggestions.
  entities: jsonb('entities').$type<string[]>().default([]),
  signal_type: signalTypeEnum('signal_type'),   // nur bei type='company' gesetzt

  ai_model_used: text('ai_model_used'),
  // Version of the ranking prompt that produced this rank. Lets us re-rank
  // only the rows produced by an older prompt (resumable bulk rerank).
  rank_prompt_version: integer('rank_prompt_version').notNull().default(0),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  uniqClass: unique('uniq_article_term').on(t.article_id, t.search_term_id),
  termRankIdx: index('idx_classifications_term_rank').on(t.search_term_id, t.rank, t.created_at.desc()),
  articleIdx: index('idx_classifications_article').on(t.article_id)
}));

// ---------- User Article State (Lese-Status/Bookmark/Push, pro User) ----------
export const user_article_state = pgTable('user_article_state', {
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  classification_id: uuid('classification_id').notNull().references(() => classifications.id, { onDelete: 'cascade' }),

  is_read: boolean('is_read').default(false),
  is_bookmarked: boolean('is_bookmarked').default(false),
  user_rank_override: integer('user_rank_override'),
  // Relevance feedback that trains the AI ranking: 'up' (more like this) | 'down' (less) | null
  user_feedback: text('user_feedback').$type<'up' | 'down' | null>(),
  // Per-user AI-personalised rank, learned from THIS user's 👍/👎 feedback.
  // Effective rank precedence in the feed: user_rank_override > personal_rank > classifications.rank
  personal_rank: integer('personal_rank'),
  personal_rank_reason: text('personal_rank_reason'),
  personal_rank_at: timestamp('personal_rank_at'),
  telegram_sent: boolean('telegram_sent').default(false),
  telegram_sent_at: timestamp('telegram_sent_at'),
  updated_at: timestamp('updated_at').defaultNow()
}, (t) => ({
  pk: primaryKey({ columns: [t.user_id, t.classification_id] })
}));

// ---------- RSS Sources (global, Admin-verwaltet) ----------
export const rss_sources = pgTable('rss_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull().unique(),
  category: text('category').notNull(),
  // 'global_tech'|'global_finance'|'global_fintech'|'dach'|'austria'|'regulatory'
  language: text('language').default('en'),
  is_active: boolean('is_active').default(true),
  last_ok_at: timestamp('last_ok_at'),            // letzter erfolgreicher Fetch
  last_error: text('last_error'),                 // letzter Fehler (für Health-Anzeige)
  created_at: timestamp('created_at').defaultNow()
});

// ---------- Settings (pro User) ----------
export const settings = pgTable('settings', {
  user_id: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),

  ai_model: aiModelEnum('ai_model').notNull().default('claude'),
  ai_model_variant: text('ai_model_variant').default('claude-sonnet-4-20250514'),

  telegram_chat_id: text('telegram_chat_id'),
  telegram_connected: boolean('telegram_connected').default(false),
  notify_rank_1: boolean('notify_rank_1').default(true),
  notify_rank_2: boolean('notify_rank_2').default(false),

  newsletter_email: text('newsletter_email'),
  newsletter_enabled: boolean('newsletter_enabled').default(false),
  newsletter_day: text('newsletter_day').default('monday'),
  newsletter_time: text('newsletter_time').default('07:00'),
  newsletter_last_sent: timestamp('newsletter_last_sent'),

  language: text('language').notNull().default('de'),  // 'de' | 'en'

  updated_at: timestamp('updated_at').defaultNow()
});

// ---------- App Config (global, Admin-verwaltet, immer Zeile id=1) ----------
export interface RankCriteria {
  de: { rank1: string; rank2: string; rank3: string };
  en: { rank1: string; rank2: string; rank3: string };
}

export const DEFAULT_RANK_CRITERIA: RankCriteria = {
  de: {
    rank1: 'hochrelevant: bedeutendes Marktsignal, direkt zum Begriff, handlungsrelevant.',
    rank2: 'relevant: klarer Bezug, beobachtenswert, aber nicht dringend.',
    rank3: 'am Rande: schwacher/indirekter Bezug oder generische Nachricht.',
  },
  en: {
    rank1: 'highly relevant: significant market signal, directly related, actionable.',
    rank2: 'relevant: clear connection, worth watching, not urgent.',
    rank3: 'marginal: weak/indirect connection or generic news.',
  },
};

export const app_config = pgTable('app_config', {
  id: integer('id').primaryKey().default(1),
  linkedin_max_posts: integer('linkedin_max_posts').notNull().default(25),
  linkedin_posted_limit: text('linkedin_posted_limit').notNull().default('week'),
  google_news_max_results: integer('google_news_max_results').notNull().default(20),
  collector_max_classifications: integer('collector_max_classifications').notNull().default(30),
  rank_criteria: jsonb('rank_criteria').$type<RankCriteria>(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// ---------- Job Runs (Observability + Run-Status-Polling) ----------
export const job_runs = pgTable('job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  search_term_id: uuid('search_term_id').references(() => search_terms.id),
  trigger: text('trigger'),                       // 'scheduled' | 'manual'
  status: text('status').notNull().default('running'), // 'running'|'success'|'error'
  articles_found: integer('articles_found').default(0),
  articles_new: integer('articles_new').default(0),
  classifications_new: integer('classifications_new').default(0),
  error_message: text('error_message'),
  started_at: timestamp('started_at').defaultNow(),
  completed_at: timestamp('completed_at')
});
