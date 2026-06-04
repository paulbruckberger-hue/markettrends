import { SourceTypeName } from '../../types';

/** A normalized candidate produced by any source before dedup/classification. */
export interface SourceArticle {
  source_url: string;
  source_type: SourceTypeName;
  source_name?: string;
  title: string;
  excerpt?: string;           // short preview (max ~1000 chars), used for display
  full_text?: string;         // complete original text (no truncation), used for AI classification
  author?: string;
  author_info?: string;       // LinkedIn: person headline / company tagline
  author_type?: string;       // 'profile' | 'company' | null
  reactions?: number;         // likes count
  comments_count?: number;
  shares_count?: number;
  extra_data?: Record<string, unknown>; // source-specific: images, post_id, etc.
  published_at?: Date | null;
  /** true if the source is inherently on-topic (company page / newsroom) → skip token pre-filter. */
  prefiltered?: boolean;
  /** BCP-47 language code of the source (e.g. 'de', 'en'). null = unknown. */
  source_language?: string | null;
}
