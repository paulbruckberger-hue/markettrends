const STYLES: Record<number, { label: string; cls: string }> = {
  1: { label: 'Rang 1', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  2: { label: 'Rang 2', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  3: { label: 'Rang 3', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
};

export default function RankBadge({ rank }: { rank: number }) {
  const s = STYLES[rank] ?? STYLES[3];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}
