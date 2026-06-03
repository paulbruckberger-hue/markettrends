import { SourceTypeName } from '../types';
import { SOURCE_LABELS } from '../lib/labels';

export default function SourceBadge({ type, name }: { type: SourceTypeName; name?: string | null }) {
  return (
    <span className="inline-flex items-center rounded-md bg-ink-800 px-2 py-0.5 text-xs text-slate-300 border border-ink-700">
      {name || SOURCE_LABELS[type] || type}
    </span>
  );
}
