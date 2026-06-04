import { SourceTypeName } from '../types';
import { SOURCE_LABELS } from '../lib/labels';

function sourceIcon(type: SourceTypeName, name?: string | null): string {
  if (type === 'linkedin_post' || type === 'linkedin_company') return '💼';
  if (type === 'google_news') return '📰';
  if (type === 'newsroom') return '🏢';
  if (name?.toLowerCase().includes('linkedin')) return '💼';
  return '📡';
}

export default function SourceBadge({ type, name }: { type: SourceTypeName; name?: string | null }) {
  // Clean up "LinkedIn · AuthorName" → just show LinkedIn for the badge
  const displayName = name?.startsWith('LinkedIn ·')
    ? 'LinkedIn'
    : (name || SOURCE_LABELS[type] || type);
  const icon = sourceIcon(type, name);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-0.5 text-xs text-slate-300 border border-ink-700 font-medium">
      <span>{icon}</span>
      <span>{displayName}</span>
    </span>
  );
}
