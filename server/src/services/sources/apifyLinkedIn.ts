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

function extractAuthor(p: LiPost): string | undefined {
  const direct = asString(pick(p, ['authorName', 'authorFullName', 'author_name']));
  if (direct) return direct;
  const author = p.author as Record<string, unknown> | string | undefined;
  if (typeof author === 'string') return asString(author);
  if (author && typeof author === 'object') {
    return asString(author.name) || asString(author.fullName) || asString(author.title);
  }
  return undefined;
}

function extractDate(p: LiPost): Date | null {
  const raw = pick(p, ['postedAt', 'postedDate', 'publishedAt', 'date', 'time', 'createdAt']);
  if (!raw) return null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const v = obj.date ?? obj.timestamp ?? obj.iso ?? obj.value;
    const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

function extractReactions(p: LiPost): number {
  const raw = pick(p, ['reactionsCount', 'numLikes', 'likesCount', 'reactions', 'totalReactions']);
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return parseInt(raw, 10);
  const eng = p.engagement as Record<string, unknown> | undefined;
  if (eng && typeof eng === 'object' && typeof eng.reactions === 'number') return eng.reactions;
  return 0;
}

export function mapLinkedInPost(p: LiPost, sourceType: SourceTypeName, prefiltered: boolean): SourceArticle | null {
  const url = asString(pick(p, ['linkedinUrl', 'url', 'postUrl', 'link', 'post_url']));
  if (!url) return null;
  const text = asString(pick(p, ['content', 'text', 'postContent', 'description'])) ?? '';
  const author = extractAuthor(p);
  const title = (text.split('\n')[0] || author || 'LinkedIn-Beitrag').slice(0, 140);
  return {
    source_url: url,
    source_type: sourceType,
    source_name: author ? `LinkedIn · ${author}` : 'LinkedIn',
    title,
    excerpt: text.slice(0, 1500),
    author,
    reactions: extractReactions(p),
    published_at: extractDate(p),
    prefiltered,
    source_language: null,  // LinkedIn is multilingual; detection not reliable without NLP
  };
}

/** Topic search: posts matching a keyword from the last 24h. */
export async function fetchLinkedInPosts(query: string, limit = 5): Promise<SourceArticle[]> {
  const items = await runActorSync<LiPost>(LINKEDIN_POST_ACTOR, {
    searchQueries: [query],
    maxPosts: limit,
    postedLimit: '24h',
    sortBy: 'date',
  });
  return items.map((p) => mapLinkedInPost(p, 'linkedin_post', false)).filter((a): a is SourceArticle => a !== null);
}
