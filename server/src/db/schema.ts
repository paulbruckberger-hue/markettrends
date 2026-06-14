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
export const newsletterCadenceEnum = pgEnum('newsletter_cadence', ['weekly', 'daily']);
export const clusterDeliveryEnum = pgEnum('cluster_delivery', ['combined', 'separate']);
export const signalTypeEnum = pgEnum('signal_type', [
  'product_launch', 'expansion', 'partnership', 'personnel',
  'funding', 'regulatory', 'earnings', 'general'
]);
// Abo-Stufen. Entitlements (Keyword-Quota) leiten sich daraus ab — siehe
// lib/entitlements.ts. 'free' ist der Default jeder Selbst-Registrierung.
export const planTierEnum = pgEnum('plan_tier', ['free', 'plus', 'pro']);

// ---------- Users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  email: text('email'),
  role: text('role').notNull().default('user'),       // 'admin' | 'user'
  is_active: boolean('is_active').notNull().default(true),

  // ----- Onboarding -----
  // Interessen-Abfrage (Onboarding) erscheint genau einmal: nach der ersten
  // Anmeldung. Persistiert serverseitig (früher localStorage → pro Gerät neu).
  onboarding_completed: boolean('onboarding_completed').notNull().default(false),

  // ----- Abo / Entitlements (Freemium nach Keyword-Anzahl) -----
  plan: planTierEnum('plan').notNull().default('free'),
  // Admin: zusätzliche Gratis-Keywords ON TOP der Plan-Quota für einzelne User.
  keyword_bonus: integer('keyword_bonus').notNull().default(0),
  // Admin: voll gratis freischalten → Pro-Rechte ohne Stripe-Abo.
  is_comp: boolean('is_comp').notNull().default(false),

  // ----- Stripe (von services/stripe.ts + Webhook gepflegt) -----
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  subscription_status: text('subscription_status'),   // active|trialing|past_due|canceled|null
  current_period_end: timestamp('current_period_end'),

  created_at: timestamp('created_at').defaultNow()
});

// ---------- User Invites (Admin lädt Kund:innen per E-Mail ein) ----------
// Eine Einladung trägt den vorgesehenen Plan/Rolle/Bonus. Annahme über den
// signierten Link → /accept-invite setzt Passwort, accepted_at markiert verbraucht.
export const user_invites = pgTable('user_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  role: text('role').notNull().default('user'),
  plan: planTierEnum('plan').notNull().default('free'),
  keyword_bonus: integer('keyword_bonus').notNull().default(0),
  invited_by: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  accepted_at: timestamp('accepted_at'),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  emailIdx: index('idx_user_invites_email').on(t.email),
}));

// ---------- Bot Sessions (transienter Signup-Status für Messenger) ----------
// Cloud Run ist zustandslos → der mehrschrittige Telegram-/WhatsApp-Signup-
// Dialog speichert seinen Schritt hier (kanal-agnostisch). Kurzlebig.
export const bot_sessions = pgTable('bot_sessions', {
  channel: text('channel').notNull(),                 // 'telegram' | 'whatsapp'
  chat_id: text('chat_id').notNull(),
  step: text('step').notNull(),                       // z.B. 'awaiting_keyword' | 'awaiting_email'
  data: jsonb('data').$type<Record<string, unknown>>().default({}),
  expires_at: timestamp('expires_at'),
  updated_at: timestamp('updated_at').defaultNow()
}, (t) => ({
  pk: primaryKey({ columns: [t.channel, t.chat_id] }),
}));

// ---------- LinkedIn-Scrape-Ledger (GLOBAL, Kostenbremse) ----------
// Jeder Apify-LinkedIn-Scrape ist kostenpflichtig pro Post. Diese Tabelle stellt
// sicher, dass dieselbe Such-Query (inkl. Übersetzungs-Aliase) pro Wiener
// Kalendertag und Zeitfenster GLOBAL höchstens EINMAL läuft — egal wie viele
// Keywords/Abos dieselbe Query erzeugen oder wie oft der 6h-Scheduler feuert.
// Verhindert die Mehrfach-Abfrage identischer Queries innerhalb von 24h.
export const linkedin_query_runs = pgTable('linkedin_query_runs', {
  query_norm: text('query_norm').notNull(),     // normalisierte Such-Query (lowercase/trim)
  posted_limit: text('posted_limit').notNull(), // Apify-Fenster: '24h' | 'week' | 'month'
  day_key: text('day_key').notNull(),           // 'YYYY-MM-DD' Europe/Vienna
  last_run_at: timestamp('last_run_at').defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.query_norm, t.posted_limit, t.day_key] }),
}));

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
  // Letzter LinkedIn-Scrape (Apify, kostenpflichtig pro Post). LinkedIn wird je
  // Begriff höchstens 1×/Wiener-Kalendertag abgefragt (im 00:00-Lauf, vor dem
  // 05:00-Newsletter), damit nicht alle 6h für dieselben Posts gezahlt wird.
  // Google News läuft weiterhin im normalen 6h-Takt.
  last_linkedin_run_at: timestamp('last_linkedin_run_at'),
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
  // Optional: Newsletter-Themen-Cluster, dem dieses Abo zugeordnet ist.
  // null = "Übrige Beobachtungen"-Sammelabschnitt im Newsletter.
  cluster_id: uuid('cluster_id').references((): any => newsletter_clusters.id, { onDelete: 'set null' }),
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
  // Sehr hohe Hürde: nur wirklich marktbewegende/dringende Ereignisse. Treibt
  // die seltenen Sofort-„Breaking"-Pushes; alles andere wartet aufs Tagesbriefing.
  breaking: boolean('breaking').notNull().default(false),

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

// ---------- User Content Profile (GLOBAL, keyword-übergreifend) ----------
// Verdichtetes "Was diese Leser:in inhaltlich interessiert", per KI destilliert
// aus ALLEN 👍/👎 der Nutzer:in über alle Keywords hinweg. Anders als das
// term-skopierte user_article_state.user_feedback wirkt dieses Profil
// keyword-übergreifend und fließt in JEDE Personalisierung ein — so lernt die
// KI aus dem INHALT (nicht nur dem Keyword), was relevant ist.
export const user_content_profiles = pgTable('user_content_profiles', {
  user_id: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  profile: text('profile').notNull(),                              // natürlichsprachiges Interessenprofil
  feedback_count: integer('feedback_count').notNull().default(0),  // aus wie vielen 👍/👎 destilliert
  built_at: timestamp('built_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

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

  // Push-Kanal pro User: 'telegram' (Default, mit interaktiven Buttons) oder
  // 'whatsapp' (via CallMeBot, kostenlos, aber ohne Buttons). Die WhatsApp-
  // Felder werden über die Settings-Maske befüllt; whatsapp_connected wird true,
  // sobald Telefonnummer + CallMeBot-API-Key hinterlegt sind. Später ist ein
  // Wechsel auf die offizielle WhatsApp-Cloud-API allein in services/whatsapp.ts
  // möglich, ohne dieses Schema zu ändern.
  push_channel: text('push_channel').notNull().default('telegram'),  // 'telegram' | 'whatsapp'
  whatsapp_phone: text('whatsapp_phone'),
  whatsapp_apikey: text('whatsapp_apikey'),
  whatsapp_connected: boolean('whatsapp_connected').notNull().default(false),

  // Tagesbriefing (1×/Tag kuratierter Push statt Sofort-Push pro Artikel) +
  // seltene Breaking-Sofort-Alerts. Stunde = lokale Versandstunde (Europe/Vienna).
  daily_push_enabled: boolean('daily_push_enabled').notNull().default(true),
  daily_push_hour: integer('daily_push_hour').notNull().default(8),
  daily_push_last_sent: timestamp('daily_push_last_sent'),
  breaking_alerts_enabled: boolean('breaking_alerts_enabled').notNull().default(true),

  newsletter_email: text('newsletter_email'),
  newsletter_enabled: boolean('newsletter_enabled').default(false),
  // 'weekly' = an newsletter_day, 'few' = Mo/Mi/Fr, 'daily' = täglich
  newsletter_frequency: text('newsletter_frequency').notNull().default('weekly'),
  newsletter_day: text('newsletter_day').default('monday'),
  newsletter_time: text('newsletter_time').default('07:00'),
  newsletter_last_sent: timestamp('newsletter_last_sent'),

  language: text('language').notNull().default('de'),  // 'de' | 'en'

  updated_at: timestamp('updated_at').defaultNow()
});

// ---------- Newsletter Clusters (pro User: Themen-Bündel für den Newsletter) ----------
// Der User gruppiert seine Beobachtungen (watch_items.cluster_id) in Cluster.
// delivery='combined' → eigener Abschnitt in der EINEN Sammelmail (Hybrid-Default).
// delivery='separate' → eigene, fokussierte Mail mit eigenem Rhythmus (cadence/day).
export const newsletter_clusters = pgTable('newsletter_clusters', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#3B82F6'),
  delivery: clusterDeliveryEnum('delivery').notNull().default('combined'),
  cadence: newsletterCadenceEnum('cadence').notNull().default('weekly'),
  day: text('day').default('monday'),            // nur relevant bei cadence='weekly'
  sort_order: integer('sort_order').notNull().default(0),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('idx_clusters_user').on(t.user_id),
}));

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
