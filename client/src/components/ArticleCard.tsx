import { ExternalLink, Heart, HeartOff } from 'lucide-react';
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
  de: '🇩🇪',
  en: '🇬🇧',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  pl: '🇵🇱',
  nl: '🇳🇱',
  pt: '🇵🇹',
};

function LangFlag({ lang }: { lang: string | null }) {
  if (!lang) return null;
  const flag = LANG_FLAG[lang.toLowerCase().slice(0, 2)];
  if (!flag) return null;
  return <span title={`Quellsprache: ${lang.toUpperCase()}`}>{flag}</span>;
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

      {/* Footer row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 pt-3">
        {/* Source info — prominent */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <SourceBadge type={item.source_type} name={item.source_name} />
          <LangFlag lang={item.source_language} />
          <span>{formatDate(item.published_at)}</span>
          {item.author && <span className="hidden sm:inline">· {item.author}</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Favorites / Lesezeichen */}
          <button
            onClick={() => onToggleFavorite(item)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-ink-800 ${item.is_bookmarked ? 'text-rose-400' : 'text-slate-500'}`}
            title={item.is_bookmarked ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          >
            {item.is_bookmarked ? <Heart size={15} fill="currentColor" /> : <HeartOff size={15} />}
            <span className="hidden sm:inline">{item.is_bookmarked ? 'Favorit' : 'Favorit'}</span>
          </button>

          {/* Open source */}
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
