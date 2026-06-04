import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Heart, HeartOff, MessageSquare, Repeat2, ThumbsUp } from 'lucide-react';
import { FeedItem } from '../types';
import { formatDate } from '../lib/labels';
import RankBadge from './RankBadge';
import SignalTypeBadge from './SignalTypeBadge';
import SourceBadge from './SourceBadge';

interface Props {
  item: FeedItem;
  onToggleRead: (item: FeedItem) => void;
  onToggleFavorite: (item: FeedItem) => void;
}

const LANG_FLAG: Record<string, string> = {
  de: '🇩🇪', en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸',
  it: '🇮🇹', pl: '🇵🇱', nl: '🇳🇱', pt: '🇵🇹',
};

function LangFlag({ lang }: { lang: string | null }) {
  if (!lang) return null;
  const flag = LANG_FLAG[lang.toLowerCase().slice(0, 2)];
  if (!flag) return null;
  return <span title={`Quellsprache: ${lang.toUpperCase()}`}>{flag}</span>;
}

function EngagementRow({ item }: { item: FeedItem }) {
  const isLinkedIn = item.source_type === 'linkedin_post' || item.source_type === 'linkedin_company';
  if (!isLinkedIn) return null;
  const likes = item.reactions ?? 0;
  const comments = item.comments_count ?? 0;
  const shares = item.shares_count ?? 0;
  if (likes === 0 && comments === 0 && shares === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
      {likes > 0 && (
        <span className="inline-flex items-center gap-1">
          <ThumbsUp size={12} /> {likes}
        </span>
      )}
      {comments > 0 && (
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} /> {comments}
        </span>
      )}
      {shares > 0 && (
        <span className="inline-flex items-center gap-1">
          <Repeat2 size={12} /> {shares}
        </span>
      )}
    </div>
  );
}

function FullTextToggle({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false);
  const text = item.full_text;
  if (!text || text.length < 100) return null;
  // Only show for LinkedIn where full_text adds real value beyond the excerpt
  const isLinkedIn = item.source_type === 'linkedin_post' || item.source_type === 'linkedin_company';
  if (!isLinkedIn) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
      >
        {open ? <><ChevronUp size={12} /> Originaltext ausblenden</> : <><ChevronDown size={12} /> Originaltext anzeigen</>}
      </button>
      {open && (
        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400 bg-ink-900 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed font-sans border border-ink-800">
          {text}
        </pre>
      )}
    </div>
  );
}

export default function ArticleCard({ item, onToggleRead, onToggleFavorite }: Props) {
  const bullets = (item.summary || '')
    .split('\n')
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

  const handleLinkClick = () => {
    if (!item.is_read) onToggleRead(item);
  };

  return (
    <article className={`rounded-xl border border-ink-800 bg-ink-850 p-4 md:p-5 transition ${item.is_read ? 'opacity-60' : ''}`}>
      {/* Top row: rank + signal type + watch tag */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <RankBadge rank={item.user_rank_override ?? item.rank} />
        {item.signal_type && <SignalTypeBadge signal={item.signal_type} />}
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-300"
          title="Beobachtung"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: item.watch_color || '#3B82F6' }} />
          {item.watch_display_name}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base md:text-lg font-semibold leading-snug text-slate-100">{item.title}</h3>

      {/* Bullets */}
      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent-400 shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-slate-400">#{t}</span>
          ))}
        </div>
      )}

      {/* Engagement (LinkedIn only) */}
      <EngagementRow item={item} />

      {/* Full text toggle (LinkedIn only) */}
      <FullTextToggle item={item} />

      {/* Footer row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 pt-3">
        {/* Source info */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <SourceBadge type={item.source_type} name={item.source_name} />
          <LangFlag lang={item.source_language} />
          <span>{formatDate(item.published_at)}</span>
          {item.author && (
            <span
              className="hidden sm:inline truncate max-w-[200px]"
              title={item.author_info ?? item.author}
            >
              · {item.author}
            </span>
          )}
          {item.author_info && (
            <span className="hidden lg:inline text-slate-500 truncate max-w-[180px]" title={item.author_info}>
              — {item.author_info}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleFavorite(item)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-ink-800 ${item.is_bookmarked ? 'text-rose-400' : 'text-slate-500'}`}
            title={item.is_bookmarked ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          >
            {item.is_bookmarked ? <Heart size={15} fill="currentColor" /> : <HeartOff size={15} />}
            <span className="hidden sm:inline">{item.is_bookmarked ? 'Favorit' : 'Favorit'}</span>
          </button>

          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            onClick={handleLinkClick}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-500 active:scale-[0.97]"
          >
            <ExternalLink size={13} />
            <span>Quelle</span>
          </a>
        </div>
      </div>
    </article>
  );
}
