import { SourceTypeName } from '../../types';

/** A normalized candidate produced by any source before dedup/classification. */
export interface SourceArticle {
  source_url: string;
  source_type: SourceTypeName;
  source_name?: string;
  title: string;
  excerpt?: string;
  author?: string;
  reactions?: number;
  published_at?: Date | null;
  /** true if the source is inherently on-topic (company page / newsroom) → skip token pre-filter. */
  prefiltered?: boolean;
}
