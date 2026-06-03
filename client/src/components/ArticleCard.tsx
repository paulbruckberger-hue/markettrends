import { Bookmark, BookmarkCheck, Check, ExternalLink, Circle } from 'lucide-react';
import { FeedItem } from '../types';
import { formatDate } from '../lib/labels';
import RankBadge from './RankBadge';
import SignalTypeBadge from './SignalTypeBadge';
import SourceBadge from './SourceBadge';

interface Props {
  item: FeedItem;
  onToggleRead: (item: FeedItem) => void;
  onToggleBookmark: (item: FeedItem) => void;
}

export default function ArticleCard({ item, onToggleRead, onToggleBookmark }: Props) {
  const bullets = (item.summary || '')
    .split('\n')
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

  return (
    <article
      className={`rounded-xl border border-ink-700 bg-ink-850 p-5 transition ${
        item.is_read ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
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

      <h3 className="text-lg font-semibold leading-snug text-slate-100">{item.title}</h3>

      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent-400">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-slate-400">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge type={item.source_type} name={item.source_name} />
          <span>{formatDate(item.published_at)}</span>
          {item.author && <span>· {item.author}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleRead(item)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-ink-800"
            title={item.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
          >
            {item.is_read ? <Check size={15} className="text-emerald-400" /> : <Circle size={15} />}
            {item.is_read ? 'Gelesen' : 'Ungelesen'}
          </button>
          <button
            onClick={() => onToggleBookmark(item)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-ink-800"
            title="Lesezeichen"
          >
            {item.is_bookmarked ? (
              <BookmarkCheck size={15} className="text-accent-400" />
            ) : (
              <Bookmark size={15} />
            )}
          </button>
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-2.5 py-1 font-medium text-white hover:bg-accent-500"
          >
            <ExternalLink size={14} /> Quelle
          </a>
        </div>
      </div>
    </article>
  );
}
