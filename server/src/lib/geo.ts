import { GeoFilter } from '../types';

export interface FeedLike {
  category: string;
  is_active: boolean | null;
}

/**
 * Select which RSS feeds apply for a geo filter.
 *   global  → all active feeds
 *   dach    → fintech (global) + DACH + Austria + regulatory
 *   austria → Austria + regulatory
 */
export function feedsForGeo<T extends FeedLike>(geo: GeoFilter, feeds: T[]): T[] {
  const active = feeds.filter((f) => f.is_active);
  if (geo === 'global') return active;
  if (geo === 'dach') {
    return active.filter((f) => ['global_fintech', 'dach', 'austria', 'regulatory'].includes(f.category));
  }
  return active.filter((f) => ['austria', 'regulatory'].includes(f.category));
}
