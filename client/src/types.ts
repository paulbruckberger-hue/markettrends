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

export interface WatchItem {
  id: string;
  display_name: string;
  label: string | null;
  color: string | null;
  is_active: boolean;
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
  original_title: string | null;
  author: string | null;
  reactions: number | null;
  published_at: string | null;
  is_read: boolean;
  is_bookmarked: boolean;
  user_rank_override: number | null;
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

export interface RunStatus {
  status: 'idle' | 'running' | 'success' | 'error';
  articles_found?: number;
  articles_new?: number;
  classifications_new?: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
