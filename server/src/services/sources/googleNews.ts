import Parser from 'rss-parser';
import { GeoFilter } from '../../types';
import { withRetry } from '../../lib/retry';
import { SourceArticle } from './types';

const parser = new Parser({ timeout: 15_000 });

const DEFAULT_MAX_RESULTS = 20;
const WINDOW_MS = 48 * 60 * 60 * 1000; // default: last 48h

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
 * Google News RSS search, geo-aware. Returns up to MAX_RESULTS items.
 * lookbackDays overrides the default 48h window — adds `after:YYYY-MM-DD` to the query
 * so Google surfaces older articles in the result set.
 */
export async function fetchGoogleNews(query: string, geo: GeoFilter, lookbackDays?: number, maxResults = DEFAULT_MAX_RESULTS): Promise<SourceArticle[]> {
  const effectiveDays = lookbackDays ?? 2;
  const afterDate = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);
  // Add the after: operator only when we want to go further back than the default feed window
  const q = effectiveDays > 2
    ? `${query} after:${afterDate.toISOString().slice(0, 10)}`
    : query;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${geoParams(geo)}`;

  const feed = await withRetry(() => parser.parseURL(url), { label: `googleNews("${query}")` });
  const cutoff = afterDate.getTime();

  const items: SourceArticle[] = (feed.items as GnItem[] | undefined ?? [])
    .filter((it) => it.link && it.title)
    .map((it) => {
      const published = it.pubDate ? new Date(it.pubDate) : null;
      const bodyText = (it.contentSnippet || it.content || '').trim();
      return {
        source_url: it.link as string,
        source_type: 'google_news' as const,
        source_name: sourceName(it),
        title: (it.title as string).replace(/ - [^-]+$/, '').trim(),
        excerpt: bodyText.slice(0, 1000),
        full_text: bodyText || undefined,  // RSS only provides snippet; stored as-is
        author: it.creator,
        published_at: published && !isNaN(published.getTime()) ? published : null,
        source_language: geo === 'global' ? 'en' : 'de',
      };
    })
    .filter((a) => !a.published_at || a.published_at.getTime() >= cutoff)
    .slice(0, maxResults);

  return items;
}
