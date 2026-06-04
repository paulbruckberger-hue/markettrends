import { runActorSync } from './apifyClient';
import { SourceArticle } from './types';
import { SourceTypeName } from '../../types';

export const LINKEDIN_POST_ACTOR = 'harvestapi/linkedin-post-search';

type LiPost = Record<string, unknown>;

function pick(o: LiPost, keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
  return 0;
}

function extractAuthor(p: LiPost): { name?: string; info?: string; type?: string } {
  const author = p.author as Record<string, unknown> | string | undefined;
  if (typeof author === 'string') return { name: asString(author) };
  if (author && typeof author === 'object') {
    return {
      name: asString(author.name) || asString(author.fullName) || asString(author.title),
      info: asString(author.info),
      type: asString(author.type),  // 'profile' | 'company'
    };
  }
  // fallback: top-level fields
  const name = asString(pick(p, ['authorName', 'authorFullName', 'author_name']));
  return { name };
}

function extractDate(p: LiPost): Date | null {
  const raw = pick(p, ['postedAt', 'postedDate', 'publishedAt', 'date', 'time', 'createdAt']);
  if (!raw) return null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // prefer timestamp (epoch ms) for reliability
    if (typeof obj.timestamp === 'number') return new Date(obj.timestamp);
    const v = obj.date ?? obj.iso ?? obj.value;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

function extractEngagement(p: LiPost): { reactions: number; comments: number; shares: number } {
  const eng = p.engagement as Record<string, unknown> | undefined;
  if (eng && typeof eng === 'object') {
    return {
      reactions: asNumber(eng.likes),     // likes count (not the reactions-breakdown array)
      comments: asNumber(eng.comments),
      shares: asNumber(eng.shares),
    };
  }
  // fallback top-level fields
  return {
    reactions: asNumber(pick(p, ['reactionsCount', 'numLikes', 'likesCount', 'totalReactions'])),
    comments: 0,
    shares: 0,
  };
}

function extractImages(p: LiPost): { url: string; width?: number; height?: number }[] {
  const imgs = p.postImages;
  if (!Array.isArray(imgs)) return [];
  return (imgs as Record<string, unknown>[])
    .map((img) => ({
      url: asString(img.url) ?? '',
      width: typeof img.width === 'number' ? img.width : undefined,
      height: typeof img.height === 'number' ? img.height : undefined,
    }))
    .filter((img) => img.url);
}

export function mapLinkedInPost(p: LiPost, sourceType: SourceTypeName, prefiltered: boolean): SourceArticle | null {
  const url = asString(pick(p, ['linkedinUrl', 'url', 'postUrl', 'link', 'post_url']));
  if (!url) return null;

  const fullText = asString(pick(p, ['content', 'text', 'postContent', 'description'])) ?? '';
  const { name: authorName, info: authorInfo, type: authorType } = extractAuthor(p);
  const title = (fullText.split('\n')[0] || authorName || 'LinkedIn-Beitrag').slice(0, 140);
  const eng = extractEngagement(p);
  const images = extractImages(p);
  const postId = asString(p.id as unknown);

  const extraData: Record<string, unknown> = {};
  if (images.length > 0) extraData.images = images;
  if (postId) extraData.post_id = postId;

  return {
    source_url: url,
    source_type: sourceType,
    source_name: authorName ? `LinkedIn · ${authorName}` : 'LinkedIn',
    title,
    excerpt: fullText.slice(0, 1000),      // short preview for display
    full_text: fullText || undefined,       // complete original text for AI
    author: authorName,
    author_info: authorInfo,
    author_type: authorType,
    reactions: eng.reactions,
    comments_count: eng.comments,
    shares_count: eng.shares,
    extra_data: Object.keys(extraData).length > 0 ? extraData : undefined,
    published_at: extractDate(p),
    prefiltered,
    source_language: null,  // LinkedIn is multilingual; detection not reliable without NLP
  };
}

/** Map lookbackDays to Apify's postedLimit string. */
function toPostedLimit(lookbackDays?: number): string {
  if (!lookbackDays || lookbackDays <= 7) return 'week';
  return 'month';
}

/** Topic search: posts matching a keyword. Default: last week, up to 25 posts. */
export async function fetchLinkedInPosts(query: string, lookbackDays?: number, limit = 25): Promise<SourceArticle[]> {
  const items = await runActorSync<LiPost>(LINKEDIN_POST_ACTOR, {
    searchQueries: [query],
    maxPosts: limit,
    postedLimit: toPostedLimit(lookbackDays),
    sortBy: 'date',
    profileScraperMode: 'short',
    startPage: 1,
  });
  return items.map((p) => mapLinkedInPost(p, 'linkedin_post', false)).filter((a): a is SourceArticle => a !== null);
}
