export type WatchType = 'topic' | 'company';
export type GeoFilter = 'global' | 'dach' | 'austria';
export type SourceTypeName =
  | 'linkedin_post' | 'linkedin_company' | 'google_news' | 'rss' | 'newsroom';

export interface SourcesConfig {
  linkedin_posts: boolean;
  linkedin_company_page: boolean;
  google_news: boolean;
  rss: boolean;
  newsroom: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}
