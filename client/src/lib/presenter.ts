import { FeedItem, GeoFilter, Sentiment, SignalType, SourceTypeName } from '../types';

// ---- Rank metadata (P1–P3) ----
export const RANK_META: Record<number, { de: string; color: string; tag: string }> = {
  1: { de: 'Kritisch', color: 'var(--rank1)', tag: 'P1' },
  2: { de: 'Relevant', color: 'var(--rank2)', tag: 'P2' },
  3: { de: 'Kontext', color: 'var(--rank3)', tag: 'P3' },
};

// ---- Signal metadata ----
export const SIGNAL_META: Record<SignalType, { de: string; color: string }> = {
  product_launch: { de: 'Produktstart', color: '#00ba7c' },
  expansion: { de: 'Expansion', color: '#1d9bf0' },
  partnership: { de: 'Partnerschaft', color: '#7c5cff' },
  personnel: { de: 'Personal', color: '#f59e0b' },
  funding: { de: 'Finanzierung', color: '#00ba7c' },
  regulatory: { de: 'Regulatorik', color: '#f4212e' },
  earnings: { de: 'Zahlen', color: '#22d3ee' },
  general: { de: 'Allgemein', color: '#8b98a5' },
};

export const GEO_META: Record<GeoFilter, { de: string; flag: string }> = {
  global: { de: 'Global', flag: '🌍' },
  dach: { de: 'DACH', flag: '🇩🇪' },
  austria: { de: 'Österreich', flag: '🇦🇹' },
};

export const SRC_KIND_LABEL: Record<SourceTypeName, string> = {
  google_news: 'Google News',
  rss: 'RSS',
  newsroom: 'Newsroom',
  linkedin_post: 'LinkedIn',
  linkedin_company: 'LinkedIn Seite',
};

const AVATAR_COLORS = [
  '#1d9bf0', '#7c5cff', '#00ba7c', '#f59e0b', '#f4212e',
  '#e0245e', '#0a66c2', '#635bff', '#ff6b35', '#22d3ee', '#0abf53', '#d7a200',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function slugHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 18) || 'quelle';
}

export function hostFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

export function fullUrl(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'jetzt';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} Std`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ${days === 1 ? 'Tag' : 'Tage'}`;
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: 'short' });
}

function fullDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function summaryBullets(summary: string): string[] {
  return summary
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean);
}

export interface SourceIdentity {
  name: string;
  handle: string;
  color: string;
  glyph: string;
  kind: SourceTypeName;
  role?: string;
  verified: boolean;
}

export function sourceIdentity(item: FeedItem): SourceIdentity {
  const isLiPost = item.source_type === 'linkedin_post';
  const name = (isLiPost ? item.author : item.source_name)
    || item.source_name || item.author || hostFromUrl(item.source_url);
  return {
    name,
    handle: slugHandle(name),
    color: AVATAR_COLORS[hashStr(name) % AVATAR_COLORS.length],
    glyph: initials(name),
    kind: item.source_type,
    role: isLiPost && item.author_info ? item.author_info : undefined,
    verified: item.source_type !== 'linkedin_post',
  };
}

export interface DisplayItem {
  id: string;            // classification_id
  href: string;          // full source url
  url: string;           // display host
  watchId: string;
  watchName: string;
  watchColor: string;
  rank: number;
  signal: SignalType | null;
  sentiment: Sentiment | null;
  time: string;
  date: string;
  title: string;
  summary: string[];
  reason: string | null;
  tags: string[];
  engagement: { likes: number; comments: number; shares: number } | null;
  source: SourceIdentity;
  // per-user state
  read: boolean;
  bookmarked: boolean;
  feedback: 'up' | 'down' | null;
  raw: FeedItem;
}

export function toDisplayItem(item: FeedItem): DisplayItem {
  const isLi = item.source_type === 'linkedin_post' || item.source_type === 'linkedin_company';
  const eng = (item.reactions || item.comments_count || item.shares_count);
  return {
    id: item.classification_id,
    href: fullUrl(item.source_url),
    url: hostFromUrl(item.source_url),
    watchId: item.watch_item_id,
    watchName: item.watch_display_name,
    watchColor: item.watch_color || '#1d9bf0',
    rank: item.rank,
    signal: item.signal_type,
    sentiment: item.sentiment,
    time: relativeTime(item.published_at || item.classified_at),
    date: fullDateTime(item.published_at || item.classified_at),
    title: item.title,
    summary: summaryBullets(item.summary),
    reason: item.rank_reason,
    tags: item.tags ?? [],
    engagement: isLi && eng ? {
      likes: item.reactions ?? 0,
      comments: item.comments_count ?? 0,
      shares: item.shares_count ?? 0,
    } : null,
    source: sourceIdentity(item),
    read: item.is_read,
    bookmarked: item.is_bookmarked,
    feedback: item.user_feedback,
    raw: item,
  };
}
