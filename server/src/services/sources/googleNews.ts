import Parser from 'rss-parser';
import { GeoFilter } from '../../types';
import { withRetry } from '../../lib/retry';
import { SourceArticle } from './types';

const parser = new Parser({ timeout: 15_000 });

const MAX_RESULTS = 8;
const WINDOW_MS = 48 * 60 * 60 * 1000; // last 48h

function geoParams(geo: GeoFilter): string {
  switch (geo) {
    case 'dach': return 'hl=de&gl=DE&ceid=DE:de';
    case 'austria': return 'hl=de&gl=AT&ceid=AT:de';
    default: return 'hl=en&gl=US&ceid=US:en';
  }
}

interface GnItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  source?: string | { _?: string };
}

function sourceName(item: GnItem): string | undefined {
  if (typeof item.source === 'string') return item.source;
  if (item.source && typeof item.source === 'object') return item.source._;
  // Google News titles often end with " - Publisher"
  const m = item.title?.match(/ - ([^-]+)$/);
  return m ? m[1].trim() : undefined;
}

/**
 * Google News RSS search, geo-aware. Returns up to 8 items from the last 48h.
 * Wrapped in retry; on hard failure the collector catches and logs it.
 */
export async function fetchGoogleNews(query: string, geo: GeoFilter): Promise<SourceArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${geoParams(geo)}`;

  const feed = await withRetry(() => parser.parseURL(url), { label: `googleNews("${query}")` });
  const cutoff = Date.now() - WINDOW_MS;

  const items: SourceArticle[] = (feed.items as GnItem[] | undefined ?? [])
    .filter((it) => it.link && it.title)
    .map((it) => {
      const published = it.pubDate ? new Date(it.pubDate) : null;
      return {
        source_url: it.link as string,
        source_type: 'google_news' as const,
        source_name: sourceName(it),
        title: (it.title as string).replace(/ - [^-]+$/, '').trim(),
        excerpt: (it.contentSnippet || it.content || '').slice(0, 1000),
        author: it.creator,
        published_at: published && !isNaN(published.getTime()) ? published : null,
      };
    })
    .filter((a) => !a.published_at || a.published_at.getTime() >= cutoff)
    .slice(0, MAX_RESULTS);

  return items;
}
