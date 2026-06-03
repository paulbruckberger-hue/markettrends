import { SignalType } from '../types';
import { SIGNAL_COLORS, SIGNAL_LABELS } from '../lib/labels';

export default function SignalTypeBadge({ signal }: { signal: SignalType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SIGNAL_COLORS[signal]}`}>
      {SIGNAL_LABELS[signal]}
    </span>
  );
}
