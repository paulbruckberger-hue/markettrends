import Parser from 'rss-parser';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { rss_sources } from '../../db/schema';
import { feedsForGeo } from '../../lib/geo';
import { GeoFilter, SourceTypeName } from '../../types';
import { SourceArticle } from './types';

const parser = new Parser({ timeout: 15_000 });
const WINDOW_MS = 48 * 60 * 60 * 1000; // last 48h
const MAX_PER_FEED = 15;

interface RssItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
}

function toArticle(it: RssItem, sourceName: string, sourceType: SourceTypeName, prefiltered: boolean): SourceArticle | null {
  if (!it.link) return null;
  const dateStr = it.isoDate || it.pubDate;
  const published = dateStr ? new Date(dateStr) : null;
  const valid = published && !isNaN(published.getTime());
  return {
    source_url: it.link,
    source_type: sourceType,
    source_name: sourceName,
    title: (it.title || '').trim() || '(ohne Titel)',
    excerpt: (it.contentSnippet || it.content || '').slice(0, 1000),
    author: it.creator,
    published_at: valid ? published : null,
    prefiltered,
  };
}

/**
 * Fetch all geo-relevant active RSS feeds. Per-feed error isolation:
 * a dead/blocked feed records last_error and never breaks the run.
 */
export async function fetchRssArticles(geo: GeoFilter): Promise<SourceArticle[]> {
  const all = await db.select().from(rss_sources);
  const feeds = feedsForGeo(geo, all);
  const out: SourceArticle[] = [];
  const cutoff = Date.now() - WINDOW_MS;

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      let count = 0;
      for (const it of (parsed.items as RssItem[] | undefined) ?? []) {
        const art = toArticle(it, feed.name, 'rss', false);
        if (!art) continue;
        if (art.published_at && art.published_at.getTime() < cutoff) continue;
        out.push(art);
        if (++count >= MAX_PER_FEED) break;
      }
      await db.update(rss_sources).set({ last_ok_at: new Date(), last_error: null }).where(eq(rss_sources.id, feed.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[rss] feed "${feed.name}" failed: ${msg}`);
      await db.update(rss_sources).set({ last_error: msg.slice(0, 500) }).where(eq(rss_sources.id, feed.id));
    }
  }
  return out;
}

/**
 * Fetch a single feed URL (used for a company's newsroom). Everything here is
 * by definition about the company, so items are marked prefiltered.
 */
export async function fetchSingleFeed(url: string, sourceName: string, sourceType: SourceTypeName = 'newsroom'): Promise<SourceArticle[]> {
  const cutoff = Date.now() - WINDOW_MS;
  try {
    const parsed = await parser.parseURL(url);
    const out: SourceArticle[] = [];
    let count = 0;
    for (const it of (parsed.items as RssItem[] | undefined) ?? []) {
      const art = toArticle(it, sourceName, sourceType, true);
      if (!art) continue;
      if (art.published_at && art.published_at.getTime() < cutoff) continue;
      out.push(art);
      if (++count >= MAX_PER_FEED) break;
    }
    return out;
  } catch (err) {
    console.error(`[rss] newsroom feed "${url}" failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}
