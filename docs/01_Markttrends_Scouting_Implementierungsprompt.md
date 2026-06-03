# Claude Code Prompt: "Markttrends Scouting" – B2B Content Intelligence Platform v4

## Projektziel

Baue eine vollständige, produktionsreife Web-App namens **"Markttrends Scouting"** – eine B2B Content Intelligence Platform für Themen- und Unternehmens-Monitoring. Sie sammelt automatisch Inhalte aus internationalen Quellen, klassifiziert sie per KI, stellt sie strukturiert dar, pusht kritische Meldungen via Telegram und versendet einen wöchentlichen HTML-Newsletter.

**Architektur-Prinzip:** Suchbegriffe sind geteilte, deduplizierte Objekte. Wenn mehrere User denselben Begriff beobachten, läuft die Suche und KI-Klassifikation **nur einmal**; alle Abonnenten greifen auf dieselben Ergebnisse zu. User-spezifisch sind nur Abo, Lese-Status, Bookmarks und Benachrichtigungen.

**MVP-Scope:**
- Single-User aktiv (User: `paul`, Passwort: `PaulB1`), Multi-User-Architektur vollständig vorbereitet aber bis auf Paul deaktiviert
- Hosting komplett auf Google Cloud Platform
- Zwei Watch-Typen: **Topics** (Themen/Branchen) und **Companies** (Unternehmen)
- AI-Modell global wählbar: Claude / Gemini / DeepSeek (Keys via Env)
- Internationale Quellen mit optionalem Geo-Filter
- Push via Telegram + wöchentlicher HTML-Newsletter

---

## Architektur (Google Cloud)

```
┌──────────────────┐     Cron      ┌──────────────────────┐
│  Cloud Scheduler │──────────────▶│  Cloud Run Job        │
│  - collect (6h)  │   triggert    │  "markttrends-collector"   │
│  - newsletter(1d)│   Job-Exec    │  (Batch-Collection)   │
└──────────────────┘               └───────────┬──────────┘
                                                │
┌──────────────────┐    HTTPS      ┌───────────▼──────────┐
│ Firebase Hosting │──────────────▶│  Cloud Run Service    │
│  (React SPA)     │   /api/*      │  "markttrends-api"         │
└──────────────────┘               │  (Express, scale-0)   │
                                    └───────────┬──────────┘
                                                │
                          ┌─────────────────────┼─────────────────┐
                          ▼                     ▼                 ▼
                  ┌───────────────┐    ┌─────────────┐   ┌──────────────┐
                  │ Supabase      │    │ Secret Mgr  │   │ Externe APIs │
                  │ (PostgreSQL)  │    │ (API-Keys)  │   │ Apify/AI/etc │
                  └───────────────┘    └─────────────┘   └──────────────┘
```

**Komponenten:**
- **Cloud Run Service `markttrends-api`** – Express-API, scale-to-zero, behandelt alle `/api/*` Routen und den Telegram-Webhook. Min-instances=0.
- **Cloud Run Job `markttrends-collector`** – Dasselbe Docker-Image, anderer Entrypoint (`node dist/jobs/collect.js`). Führt die Batch-Collection aus. Kein HTTP-Timeout, läuft bis fertig (Task-Timeout: 1h).
- **Cloud Scheduler** – Zwei Jobs: `markttrends-collect` (alle 6h) und `markttrends-newsletter` (täglich). Beide triggern via Cloud Run Admin API eine Job-Execution. Auth via OIDC-Service-Account.
- **Supabase (PostgreSQL)** – Managed, persistent. Verbindung von Cloud Run über Standard-`pg` + `DATABASE_URL` (Supabase **Session Pooler**, IPv4). Kein Supabase-SDK → portabel.
- **Firebase Hosting** – Statisches React-Build, CDN, kostenloser Tier.
- **Secret Manager** – Speichert API-Keys/Tokens, werden als Env-Vars in Cloud Run / Job injiziert.
- **Artifact Registry** – Docker-Image-Registry.

**Manueller Run** (Button "Jetzt abrufen"): Die API triggert via Cloud Run Admin API eine Job-Execution mit Override-Env `SEARCH_TERM_ID=<id>`. Der Job verarbeitet dann nur diesen einen Suchbegriff. Status wird in `job_runs` geschrieben, Frontend pollt `/api/watchlist/:id/run-status`.

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts + **TanStack Query** (Data-Fetching/Caching/Polling)
- **Backend**: Node.js 20 + Express + TypeScript
- **Datenbank**: PostgreSQL (Supabase, angesprochen via `DATABASE_URL`)
- **ORM**: Drizzle ORM + drizzle-kit (Migrations)
- **DB-Client**: `pg` (node-postgres) über `DATABASE_URL` (SSL) – kein Supabase-SDK, daher portabel
- **Auth**: JWT (`jsonwebtoken`) + `bcryptjs` (pure JS, kein nativer Build)
- **Email**: Nodemailer (SMTP) + Handlebars
- **Scheduling**: Cloud Scheduler (extern, kein node-cron)
- **AI**: Anthropic / Google Gemini / DeepSeek (konfigurierbar, Keys via Env)
- **Scraping**: Apify
- **Container**: Docker (ein Image, zwei Entrypoints)
- **Security**: `helmet`, `express-rate-limit` (auf Auth-Routen)

---

## Projektstruktur (Monorepo)

```
markttrends-scouting/
├── client/                          # React SPA → Firebase Hosting
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                   # Button, Card, Badge, Input, Select, Toggle
│   │   │   ├── ArticleCard.tsx
│   │   │   ├── WatchItemTag.tsx
│   │   │   ├── RankBadge.tsx
│   │   │   ├── SignalTypeBadge.tsx
│   │   │   ├── SourceBadge.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── FeedPage.tsx
│   │   │   ├── IntelligencePage.tsx
│   │   │   ├── WatchListPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── hooks/                    # useAuth, useArticles, useWatchlist (TanStack Query)
│   │   ├── lib/                      # api.ts (axios + JWT interceptor), queryClient.ts
│   │   └── App.tsx
│   ├── firebase.json
│   └── vite.config.ts
│
├── server/                          # Express API + Collector Job (ein Image)
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle Schema (normalisiert)
│   │   │   ├── client.ts            # pg Pool über DATABASE_URL (SSL)
│   │   │   ├── migrate.ts            # Migrator (beim Start idempotent)
│   │   │   └── seed.ts               # User Paul + RSS Feeds
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── articles.ts
│   │   │   ├── watchlist.ts
│   │   │   ├── analytics.ts
│   │   │   ├── settings.ts
│   │   │   ├── digest.ts
│   │   │   ├── rssSources.ts
│   │   │   └── webhook.ts
│   │   ├── services/
│   │   │   ├── sources/
│   │   │   │   ├── apifyLinkedIn.ts
│   │   │   │   ├── apifyCompanyPage.ts
│   │   │   │   ├── googleNews.ts
│   │   │   │   └── rssFeeds.ts
│   │   │   ├── ai/
│   │   │   │   ├── classifier.ts     # Provider-agnostisches Interface + Prompts
│   │   │   │   ├── claude.ts
│   │   │   │   ├── gemini.ts
│   │   │   │   └── deepseek.ts
│   │   │   ├── collector.ts          # Kern-Orchestrierung (search_term-zentriert)
│   │   │   ├── notifications.ts      # Telegram-Fan-out pro User
│   │   │   ├── telegram.ts           # Telegram-Bot-Primitives
│   │   │   └── newsletter.ts         # HTML + SMTP
│   │   ├── jobs/
│   │   │   ├── collect.ts            # Job-Entrypoint: Batch oder single SEARCH_TERM_ID
│   │   │   └── sendNewsletters.ts    # Job-Entrypoint: Newsletter-Versand
│   │   ├── lib/
│   │   │   ├── jobTrigger.ts         # Cloud Run Admin API: Job-Execution triggern
│   │   │   ├── hash.ts               # content_hash + normalizeQuery
│   │   │   └── retry.ts              # Exponential Backoff für externe Calls
│   │   ├── templates/
│   │   │   └── weekly-digest.html
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── index.ts                  # API-Entrypoint
│   ├── drizzle/                      # generierte SQL-Migrations
│   ├── drizzle.config.ts
│   ├── Dockerfile
│   └── tsconfig.json
│
├── cloudbuild.yaml                   # optional: CI Build & Deploy
└── README.md
```

---

## Datenbank Schema (normalisiert)

`server/src/db/schema.ts`:

```typescript
import {
  pgTable, uuid, text, integer, boolean,
  timestamp, jsonb, pgEnum, unique, primaryKey
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

  is_active: boolean('is_active').notNull().default(true),  // true wenn ≥1 aktives Abo
  last_run_at: timestamp('last_run_at'),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  // DEDUP-KERN: ein Suchbegriff existiert nur einmal pro (Typ, Query, Geo)
  uniqTerm: unique('uniq_search_term').on(t.type, t.query_normalized, t.geo_filter)
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
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  uniqSub: unique('uniq_user_term').on(t.user_id, t.search_term_id)
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
  reactions: integer('reactions').default(0),     // LinkedIn-Engagement
  published_at: timestamp('published_at'),
  created_at: timestamp('created_at').defaultNow()
});

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
  signal_type: signalTypeEnum('signal_type'),   // nur bei type='company' gesetzt

  ai_model_used: text('ai_model_used'),
  created_at: timestamp('created_at').defaultNow()
}, (t) => ({
  uniqClass: unique('uniq_article_term').on(t.article_id, t.search_term_id)
}));

// ---------- User Article State (Lese-Status/Bookmark/Push, pro User) ----------
export const user_article_state = pgTable('user_article_state', {
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  classification_id: uuid('classification_id').notNull().references(() => classifications.id, { onDelete: 'cascade' }),

  is_read: boolean('is_read').default(false),
  is_bookmarked: boolean('is_bookmarked').default(false),
  user_rank_override: integer('user_rank_override'),
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

  updated_at: timestamp('updated_at').defaultNow()
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
```

**Wichtige Indizes** (in Migration ergänzen):
```sql
CREATE INDEX idx_classifications_term_rank ON classifications(search_term_id, rank, created_at DESC);
CREATE INDEX idx_classifications_article ON classifications(article_id);
CREATE INDEX idx_watch_items_user ON watch_items(user_id, is_active);
CREATE INDEX idx_search_terms_active ON search_terms(is_active);
CREATE INDEX idx_articles_published ON articles(published_at DESC);
```

---

## Datenfluss & Dedup-Logik (Kernkonzept)

**Beim Anlegen eines Watch-Items** (`POST /api/watchlist`):
1. Query normalisieren (`query_normalized = lowercase(trim(query))`).
2. `search_terms` per `(type, query_normalized, geo_filter)` upserten – existiert der Begriff bereits (auch von anderem User), wird die bestehende Zeile verwendet, **keine neue Suche angelegt**.
3. `watch_items`-Abo für den User auf diesen `search_term_id` anlegen.
4. `search_terms.is_active = true` setzen.

**Beim Löschen/Deaktivieren eines Watch-Items:**
- Prüfen ob noch andere aktive Abos auf den `search_term` zeigen. Wenn nein → `search_terms.is_active = false` (Suche pausiert, Daten bleiben).

**Collection (Cloud Run Job, search_term-zentriert):**
```
Für jeden aktiven search_term:
  job_runs-Zeile anlegen (status=running)
  Für jeden aktivierten Source-Typ (geo-gefiltert):
    Artikel fetchen → Pre-Filter (Keyword-Match)
    Für jeden Artikel:
      content_hash berechnen
      articles upserten (onConflictDoNothing auf content_hash) → article_id
      classifications-Existenz prüfen (article_id, search_term_id)
        wenn neu: KI-Klassifikation (1 Call) → classifications insert
  job_runs aktualisieren (status=success, Zähler)
  search_terms.last_run_at = now()
Nach allen search_terms:
  Notifications-Fan-out (siehe unten)
```

Dadurch: Suche **einmal pro Begriff**, KI-Klassifikation **einmal pro (Artikel, Begriff)**. Zwei User mit demselben Keyword teilen Suche *und* Klassifikation.

**Feed eines Users** (`GET /api/articles`):
```sql
SELECT c.*, a.*, COALESCE(uas.is_read,false), COALESCE(uas.is_bookmarked,false), wi.display_name, wi.color
FROM watch_items wi
JOIN classifications c ON c.search_term_id = wi.search_term_id
JOIN articles a ON a.id = c.article_id
LEFT JOIN user_article_state uas ON uas.classification_id = c.id AND uas.user_id = wi.user_id
WHERE wi.user_id = $1 AND wi.is_active = true
  [+ Filter rank/source/period/search]
ORDER BY COALESCE(uas.user_rank_override, c.rank) ASC, a.published_at DESC
LIMIT 20 OFFSET ...
```

---

## Notifications – Fan-out pro User

`server/src/services/notifications.ts`:

Nach der Collection: Für jede **neue** `classification` mit `rank IN (1,2)`:
1. Alle aktiven `watch_items` finden, die auf den `search_term` abonniert sind.
2. Pro betroffenem User: `settings` prüfen (`notify_rank_1`/`notify_rank_2`, `telegram_connected`).
3. `user_article_state` prüfen ob bereits `telegram_sent`. Wenn nein und Bedingung erfüllt: Telegram senden, `telegram_sent=true` setzen.

So bekommt jeder Abonnent seine Push nach seinen eigenen Settings – aber Suche/Klassifikation lief nur einmal.

---

## AI Classifier – Provider-agnostisch

`server/src/services/ai/classifier.ts`:

```typescript
export interface ClassificationInput {
  content: string;          // original_title + raw_excerpt
  searchQuery: string;
  watchType: 'topic' | 'company';
  sourceType: string;
}

export interface ClassificationResult {
  rank: 1 | 2 | 3;
  rank_reason: string;
  title: string;
  summary: string;          // "• …\n• …\n• …"
  sentiment: 'positive' | 'negative' | 'neutral';
  tags: string[];           // max 3
  signal_type?: 'product_launch'|'expansion'|'partnership'|'personnel'|'funding'|'regulatory'|'earnings'|'general';
}

// Eine gemeinsame Funktion, die je nach settings.ai_model an claude.ts/gemini.ts/deepseek.ts delegiert.
// Jede Provider-Implementierung nimmt den Prompt-String + parst robustes JSON (mit Fallback).
export async function classify(input: ClassificationInput, model: AiModel): Promise<ClassificationResult>;
```

**Prompts** (TOPIC_PROMPT / COMPANY_PROMPT) wie in v3 – unverändert sinnvoll. Der COMPANY_PROMPT extrahiert zusätzlich `signal_type`. Wichtig: Antwort als reines JSON ohne Markdown-Fences erzwingen, beim Parsen `try/catch` mit Fallback (rank=3, generischer Text), niemals den ganzen Run wegen eines Parse-Fehlers abbrechen.

**Modell-Varianten** (Defaults):
- claude → `claude-sonnet-4-20250514`
- gemini → `gemini-2.0-flash`
- deepseek → `deepseek-chat`

**Robustheit:** Alle externen Calls (AI, Apify, RSS) durch `lib/retry.ts` mit Exponential Backoff (3 Versuche, Basis 1s) wrappen. Bei AI-429 backoff, bei dauerhaftem Fehler Artikel überspringen + in job_runs.error_message protokollieren.

---

## Content Sources

### Pre-Filter (wichtig – ersetzt naives Substring-Matching)
`lib/matchesQuery.ts`: Tokenisiert `query_normalized` in Wörter (split on whitespace), entfernt Stoppwörter (`in`, `the`, `und`, `der`, …). Ein Artikel matcht, wenn **alle** signifikanten Tokens (oder bei >2 Tokens: mindestens die Hälfte) in `title + description` (lowercase) vorkommen. Für `type='company'` reicht das Vorkommen des Firmennamens. So matchen Mehrwort-Topics wie "AI in lending" auch dann, wenn die exakte Phrase nicht im Text steht.

### `googleNews.ts`
Geo-abhängige URL:
- global: `hl=en&gl=US&ceid=US:en`
- dach: `hl=de&gl=DE&ceid=DE:de`
- austria: `hl=de&gl=AT&ceid=AT:de`
Format: `https://news.google.com/rss/search?q={encodeURIComponent(query)}&{geoParams}`. Letzte 48h, max 8 Results.

### `rssFeeds.ts`
Holt aktive `rss_sources` (geo-gefiltert, siehe unten), parsed via `rss-parser`. **Per-Feed-Error-Handling**: Ein toter/blockierter Feed darf den Run nicht stoppen – Fehler in `rss_sources.last_error` schreiben, `last_ok_at` bei Erfolg. Danach Pre-Filter gegen den search_term.
> Hinweis: Einige Feeds (Reuters, Bloomberg, FT) sind unzuverlässig oder geblockt. Beim Seed nur als `is_active=true` setzen, aber defensiv behandeln; Google News deckt diese Publisher ohnehin ab.

### `apifyLinkedIn.ts` (Topic-Suche)
Actor `5QnEH5N71IK2mFLrP`, Input `{ keyword, date_filter:'past-24h', limit:5, sort_type:'date_posted' }`. Polling mit Backoff, max 90s.

### `apifyCompanyPage.ts` (Company Page Posts)
Nur für `type='company'` mit `company_linkedin_id`. Actor `wk2BYTuW3oOGW2xGj`, Input `{ companyId, limit:10 }`. `company_newsroom_url` wird als normaler RSS-Feed behandelt (kein Pre-Filter nötig – alles ist per Definition über die Firma).

### Geo-Filter (Feed-Auswahl)
```typescript
function feedsForGeo(geo: GeoFilter, feeds: RssSource[]): RssSource[] {
  const map = {
    global:  feeds,                                            // alle aktiven
    dach:    feeds.filter(f => ['global_fintech','dach','austria','regulatory'].includes(f.category)),
    austria: feeds.filter(f => ['austria','regulatory'].includes(f.category)),
  };
  return map[geo].filter(f => f.is_active);
}
```

---

## Newsletter

`server/src/jobs/sendNewsletters.ts` (Cloud Run Job, täglich von Scheduler getriggert):
1. Alle User mit `newsletter_enabled=true` UND `newsletter_day == heute`.
2. Pro User: Top-Klassifikationen der letzten 7 Tage (Rank 1+2) aus seinen Abos holen.
3. Ein KI-Call für Executive Summary + "Markttrend der Woche".
4. Handlebars-Template rendern, via Nodemailer/SMTP senden, `newsletter_last_sent` setzen.

HTML-Template (`templates/weekly-digest.html`): responsives Inline-CSS, dunkles Design (`#0A0F1E` Background, `#111827` Cards), max-width 600px. Sektionen: Header (Woche) → Executive Summary → Rank-1 (volle Karten) → Rank-2 (kompakte Liste) → "Markttrend der Woche" → Stats-Footer. Alle Links als farbige Anchor-Buttons.

Template-Variablen: `weekLabel`, `executiveSummary`, `rank1Articles[]`, `rank2Articles[]`, `weeklySignal`, `stats{total,rank1,sources}`, `webViewUrl`.

`GET /api/digest/preview` rendert dasselbe Template on-demand für die Browser-Vorschau.

---

## API Routes

```
# Auth (rate-limited)
POST   /api/auth/login            → { token }
POST   /api/auth/logout           → client dropt Token (stateless)
GET    /api/auth/me

# Watch List (Topics + Companies; legt search_terms dedupliziert an)
GET    /api/watchlist
POST   /api/watchlist             → { type, query, display_name, label, color, geo_filter, ...company_fields, sources_config? }
PUT    /api/watchlist/:id         → display_name, label, color, is_active
DELETE /api/watchlist/:id
POST   /api/watchlist/:id/run     → triggert Cloud Run Job mit SEARCH_TERM_ID → { jobRunId }
GET    /api/watchlist/:id/run-status → { status, articles_found, articles_new, started_at }

# Articles / Feed
GET    /api/articles              → ?rank=&watch_item_id=&source_type=&period=&search=&page=&limit=20
GET    /api/articles/:classificationId
PATCH  /api/articles/:classificationId → { is_read, is_bookmarked, user_rank_override }  (schreibt user_article_state)

# Analytics
GET    /api/analytics/overview
GET    /api/analytics/watchitem/:id   → Volume-Trend, Sentiment, Top-Sources, Top-Authors, Co-Tags, Markttrends Scouting-Types
GET    /api/analytics/sources

# Newsletter
GET    /api/digest/preview        → HTML
POST   /api/digest/send           → sofort an eigenen Account

# Settings
GET    /api/settings
PUT    /api/settings              → { ai_model, ai_model_variant, notify_*, newsletter_* }
POST   /api/settings/test-ai      → testet aktives Modell (Key aus Env)
POST   /api/settings/test-telegram
POST   /api/settings/test-email

# RSS Sources (Admin)
GET    /api/rss-sources           → inkl. last_ok_at / last_error (Health)
PUT    /api/rss-sources/:id       → { is_active }

# Telegram Webhook (public, secret-verifiziert)
POST   /webhook/telegram

# Internal (nur via OIDC vom Scheduler/Job-Service-Account)
POST   /internal/admin/setup-telegram-webhook
```

Alle `/api/*` via JWT-Middleware. `/internal/*` nur mit gültigem Google-OIDC-Token des Job-Service-Accounts.

---

## Frontend – Page-Spezifikationen

(Im Wesentlichen wie v3, mit diesen Änderungen:)

### `SettingsPage.tsx` – **kein API-Key-Feld mehr**
**AI-Modell:**
```
Aktives Modell: [● Claude] [○ Gemini] [○ DeepSeek]
Variante:       [claude-sonnet-4-20250514 ▼]
Key-Status:     ● konfiguriert (via Env)   [🔍 Verbindung testen]
```
Quellen/RSS-Health, Telegram, Newsletter wie v3. Globale Source-Toggles **entfernt** – Quellen werden über RSS-Feed-`is_active` (Admin) + `sources_config` pro search_term gesteuert (zwei Ebenen, klare Präzedenz).

### `LoginPage.tsx`, `DashboardPage.tsx`, `FeedPage.tsx`, `IntelligencePage.tsx`, `WatchListPage.tsx`
Wie v3 spezifiziert. ArticleCard zeigt `signal_type` als farbiges Badge (nur Companies). Feed/Status/Polling über TanStack Query. IntelligencePage für Companies zusätzlich: Signal-Type-Donut + Event-Timeline.

**Design System** (Farben, Fonts, Sidebar): identisch zu v3.

---

## Deployment (Google Cloud)

### Dockerfile (`server/Dockerfile`)
Multi-stage Node-20-Build. Ein Image, Default-CMD startet die API (`node dist/index.js`). Der Collector-Job überschreibt das Command (`node dist/jobs/collect.js`), der Newsletter-Job (`node dist/jobs/sendNewsletters.js`).

### Datenbank: Supabase
Die DB ist ein Supabase-Projekt (managed PostgreSQL). Der Code spricht ausschließlich
Standard-Postgres über `DATABASE_URL` (Drizzle + `pg`), **nicht** das Supabase-SDK –
dadurch bleibt das Projekt portabel und kann später ohne Code-Änderung auf Cloud SQL
oder eine andere Postgres migriert werden.

> **Wichtig (Supabase + Cloud Run):** Den **Pooler-Connection-String** verwenden
> (in Supabase unter "Connect" → "Session pooler"), nicht die Direktverbindung.
> Der Pooler liefert IPv4, das Cloud Run für die Egress-Verbindung braucht.
> Migrations und Runtime nutzen denselben Session-Pooler-String.

### Cloud Run
- Service `markttrends-api`: min-instances=0, max=2, Concurrency 80, Cloud-SQL-Connection attached, Env aus Secret Manager.
- Job `markttrends-collector`: Task-Timeout 3600s, max-retries 1, Command überschrieben.
- Job `markttrends-newsletter`: analog.

### Cloud Scheduler (OIDC-authentifiziert auf Cloud Run Admin API)
- `markttrends-collect`: `0 */6 * * *` → executes Job `markttrends-collector`.
- `markttrends-newsletter`: `0 5 * * *` (täglich 05:00 UTC) → executes Job `markttrends-newsletter` (Job filtert intern nach Wochentag/User-Settings).

### Firebase Hosting
`client/firebase.json`: SPA-Rewrite aller Routen auf `/index.html`, Build-Output `dist/`. API-Calls gehen an die `markttrends-api` Cloud-Run-URL (in `VITE_API_URL`).

### Migrations
`drizzle-kit generate` erzeugt SQL nach `server/drizzle/`. Beim **Container-Start der API** läuft `migrate.ts` (Migrator, idempotent) einmalig vor dem Server-Listen. Seed (`seed.ts`) ebenfalls beim Start, idempotent (User Paul + RSS Feeds via `onConflictDoNothing`).

### Environment Variables (in Secret Manager → Cloud Run Env)
```env
# Database (Supabase – Session Pooler Connection String, IPv4)
DATABASE_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres

# Auth
JWT_SECRET=

# AI (nur das aktive Modell braucht einen Key)
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=

# Apify
APIFY_API_TOKEN=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_BOT_USERNAME=

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Markttrends Scouting <noreply@markttrends.app>

# GCP (für Job-Triggering aus der API)
GCP_PROJECT_ID=
GCP_REGION=
COLLECTOR_JOB_NAME=markttrends-collector

# App
PORT=8080            # Cloud Run erwartet 8080
NODE_ENV=production
CLIENT_URL=          # Firebase Hosting URL (CORS)
```

---

## Key Implementation Notes

1. **Such-Dedup ist das Herzstück**: `search_terms` ist global geteilt und unique über `(type, query_normalized, geo_filter)`. Watch-Items sind User-Abos darauf. Collection läuft pro search_term genau einmal.

2. **Klassifikations-Dedup**: `classifications` ist unique über `(article_id, search_term_id)`. Ein bereits klassifizierter Artikel wird für denselben Begriff nie erneut an die KI geschickt.

3. **Artikel-Dedup**: `articles.content_hash` global unique (MD5 der normalisierten URL: lowercase, Tracking-Parameter entfernt).

4. **Scheduling via Cloud Scheduler + Cloud Run Job** – kein node-cron (würde auf scale-to-zero nicht feuern). Job hat kein HTTP-Timeout.

5. **Manueller Run** triggert dieselbe Job-Definition mit `SEARCH_TERM_ID`-Override; Status über `job_runs` + Polling.

6. **Notifications nach Settings, Suche nur einmal**: Fan-out iteriert über Abonnenten eines search_terms; jeder User bekommt Push nach seinen eigenen Settings; `user_article_state.telegram_sent` verhindert Doppel-Push.

7. **Pre-Filter token-basiert**, nicht naives Substring-Matching.

8. **Robustheit**: Per-Feed/Per-Artikel-Error-Isolation, Exponential Backoff, JSON-Parse-Fallback. Ein Fehler killt nie den ganzen Run.

9. **Keys nur in Env/Secret Manager**, kein API-Key-UI.

10. **TypeScript strict, keine `any`**. Drizzle inferiert Typen aus dem Schema.

---

## Implementation-Reihenfolge (Vertical Slice First)

**Meilenstein 1 – Lauffähiger vertikaler Schnitt (nur Google News + Claude):**
1. Monorepo + Dockerfile + tsconfig (strict)
2. Drizzle Schema + `drizzle-kit generate` + Migrator + Seed (User Paul, RSS Feeds)
3. Supabase-Verbindung (pg Pool über DATABASE_URL, SSL) + DB-Client
4. Auth (Login + JWT-Middleware + rate-limit + helmet)
5. Watch-List CRUD **inkl. search_term-Dedup-Logik**
6. AI Classifier-Interface + **nur Claude** implementieren
7. Source **nur googleNews.ts** + Pre-Filter
8. `collector.ts` + `jobs/collect.ts` (search_term-zentriert, mit Dedup)
9. Articles/Feed-Route (der Join-Query)
10. Minimal-Frontend: Login + WatchList + Feed
→ **Checkpoint: Watch-Item anlegen, Job lokal laufen lassen, klassifizierte Artikel im Feed sehen.**

**Meilenstein 2 – Quellen & Modelle vervollständigen:**
11. rssFeeds.ts, apifyLinkedIn.ts, apifyCompanyPage.ts
12. Gemini + DeepSeek Implementierungen
13. Geo-Filter
14. Analytics-Routen + Dashboard + IntelligencePage

**Meilenstein 3 – Notifications & Deployment:**
15. Telegram-Service + Webhook + Notifications-Fan-out
16. Newsletter-Service + Template + `jobs/sendNewsletters.ts`
17. Settings-Page komplett
18. GCP-Deploy: Dockerfile → Artifact Registry → Cloud Run Service + Jobs + Scheduler + Firebase Hosting (DB = Supabase, extern)
19. README mit vollständiger Setup- & Deploy-Anleitung

**Arbeitsweise:** Starte mit Meilenstein 1 und stelle sicher, dass der vertikale Schnitt *end-to-end kompiliert und läuft*, bevor Meilenstein 2 beginnt. TypeScript muss nach jedem Meilenstein fehlerfrei kompilieren (`tsc --noEmit`). Triff pragmatische Entscheidungen; frage nur bei echten Blockern.
