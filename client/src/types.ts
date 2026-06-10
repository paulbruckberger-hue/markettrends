export type WatchType = 'topic' | 'company';
export type GeoFilter = 'global' | 'dach' | 'austria';
export type Sentiment = 'positive' | 'negative' | 'neutral';
export type SignalType =
  | 'product_launch' | 'expansion' | 'partnership' | 'personnel'
  | 'funding' | 'regulatory' | 'earnings' | 'general';
export type SourceTypeName =
  | 'linkedin_post' | 'linkedin_company' | 'google_news' | 'rss' | 'newsroom';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  email?: string | null;
}

export interface SourcesConfig {
  linkedin_posts: boolean;
  linkedin_company_page: boolean;
  google_news: boolean;
  rss: boolean;
  newsroom: boolean;
}

export type ScheduleInterval = null | 'manual' | '1h' | '2h' | '3h' | '6h' | '12h' | '24h' | '48h' | '168h';

export interface WatchItem {
  id: string;
  display_name: string;
  label: string | null;
  color: string | null;
  cluster_id: string | null;
  is_active: boolean;
  schedule_interval: ScheduleInterval;
  context_hint: string | null;
  created_at: string | null;
  search_term_id: string;
  type: WatchType;
  query_display: string;
  geo_filter: GeoFilter;
  sources_config: SourcesConfig;
  company_linkedin_id: string | null;
  company_newsroom_url: string | null;
  company_domain: string | null;
  last_run_at: string | null;
  // Per-watch aggregates (from GET /api/watchlist)
  signals?: number;
  unread?: number;
  momentum?: number;
}

export interface FeedItem {
  classification_id: string;
  title: string;
  summary: string;
  rank: 1 | 2 | 3;
  rank_reason: string | null;
  sentiment: Sentiment | null;
  tags: string[] | null;
  signal_type: SignalType | null;
  ai_model_used: string | null;
  classified_at: string | null;
  article_id: string;
  source_url: string;
  source_type: SourceTypeName;
  source_name: string | null;
  source_language: string | null;
  original_title: string | null;
  full_text: string | null;
  author: string | null;
  author_info: string | null;
  author_type: string | null;
  reactions: number | null;
  comments_count: number | null;
  shares_count: number | null;
  extra_data: Record<string, unknown> | null;
  published_at: string | null;
  is_read: boolean;
  is_bookmarked: boolean;
  user_rank_override: number | null;
  user_feedback: 'up' | 'down' | null;
  watch_item_id: string;
  watch_display_name: string;
  watch_color: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export type AiModel = 'claude' | 'gemini' | 'deepseek';

export type ClusterDelivery = 'combined' | 'separate';
export type NewsletterCadence = 'weekly' | 'daily';

export interface NewsletterCluster {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  delivery: ClusterDelivery;
  cadence: NewsletterCadence;
  day: string | null;
  sort_order: number;
  created_at: string | null;
  member_ids: string[];
}

export interface SuggestedCluster {
  name: string;
  color: string;
  member_ids: string[];
}

export interface AppSettings {
  user_id: string;
  language: 'de' | 'en';
  ai_model: AiModel;
  ai_model_variant: string | null;
  telegram_chat_id: string | null;
  telegram_connected: boolean | null;
  notify_rank_1: boolean | null;
  notify_rank_2: boolean | null;
  newsletter_email: string | null;
  newsletter_enabled: boolean | null;
  newsletter_day: string | null;
  newsletter_time: string | null;
  newsletter_last_sent: string | null;
  telegram_bot_username: string | null;
  keys: { claude: boolean; gemini: boolean; deepseek: boolean };
  smtp_configured: boolean;
}

export interface Overview {
  total: number;
  watchCount: number;
  period?: number;
  byRank: Record<string, number>;
  bySource: { source_type: SourceTypeName; n: number }[];
  bySentiment: Record<string, number>;
  volume: { date: string; n: number }[];
  read: number;
  bookmarked: number;
  last_updated?: string | null;
}

export interface WatchAnalytics {
  watchItem: { id: string; display_name: string; type: WatchType };
  period?: number;
  volume: { date: string; n: number }[];
  sentiment: Record<string, number>;
  topSources: { source: string; n: number }[];
  topAuthors: { author: string; n: number }[];
  coTags: { tag: string; n: number }[];
  signalTypes: { signal_type: SignalType; n: number }[];
}

export interface SourcesResponse {
  bySource: { source_type: SourceTypeName; n: number }[];
}

export interface TrendWatch {
  watch_item_id: string;
  name: string;
  color: string | null;
  type: WatchType;
  total: number;
  prev: number;
  momentum: number;
  today: number;
  avg_daily: number;
  spike: boolean;
  spike_factor: number;
  spark: number[];
}

export interface EmergingTag {
  tag: string;
  cur: number;
  prev: number;
  momentum: number;
}

export interface TrendsResponse {
  period: number;
  generated_at: string;
  last_updated: string | null;
  watches: TrendWatch[];
  emergingTags: EmergingTag[];
}

export interface TodayWatch {
  watch_item_id: string;
  name: string;
  color: string | null;
  type: WatchType;
  today: number;
}

export interface TodayResponse {
  today: number;
  yesterday: number;
  rank1_today: number;
  perWatch: TodayWatch[];
  last_updated: string | null;
}

export interface Suggestion {
  name: string;
  count: number;
}

export interface SuggestionsResponse {
  companies: Suggestion[];
  topics: Suggestion[];
}

export interface CompetitorSov {
  watch_item_id: string;
  name: string;
  color: string | null;
  share: number;
  up: number;
  you: boolean;
}

export interface CompetitorMomentum {
  name: string;
  up: number;
  spark: number[];
}

export interface CompetitorMove {
  date: string;
  rank: number;
  signal_type: SignalType | null;
  text: string;
  src: string;
}

export interface CompetitorAnalysis {
  watch_item_id: string;
  subject: string;
  domain: string | null;
  geo: GeoFilter;
  color: string | null;
  summary: string;
  sov: CompetitorSov[];
  momentum: CompetitorMomentum[];
  signals: { signal_type: SignalType | null; n: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
  moves: CompetitorMove[];
  strengths: string[];
  watchouts: string[];
  detectedRivals: { name: string; count: number }[];
  aiRivals: string[];
  ai_used: boolean;
}

export interface RankCriteriaLang {
  rank1: string;
  rank2: string;
  rank3: string;
}

export interface RankCriteria {
  de: RankCriteriaLang;
  en: RankCriteriaLang;
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

export interface AppConfig {
  id: number;
  linkedin_max_posts: number;
  linkedin_posted_limit: string;
  google_news_max_results: number;
  collector_max_classifications: number;
  rank_criteria: RankCriteria;
  updated_at: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string | null;
}

export interface RunStatus {
  status: 'idle' | 'running' | 'success' | 'error';
  articles_found?: number;
  articles_new?: number;
  classifications_new?: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
