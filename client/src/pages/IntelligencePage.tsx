import { useEffect, useState } from 'react';
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Layout from '../components/Layout';
import { useWatchlist } from '../hooks/useWatchlist';
import { useWatchAnalytics } from '../hooks/useAnalytics';
import { useFeed } from '../hooks/useArticles';
import { SIGNAL_LABELS, formatDate } from '../lib/labels';
import RankBadge from '../components/RankBadge';
import SignalTypeBadge from '../components/SignalTypeBadge';
import { SignalType } from '../types';

const tooltipStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' };
const SENTIMENT_COLORS: Record<string, string> = { positive: '#22c55e', neutral: '#64748b', negative: '#f43f5e' };
const SIGNAL_PALETTE = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#4ade80', '#fb7185', '#22d3ee', '#94a3b8'];

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-800 bg-ink-900 p-5 ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

export default function IntelligencePage() {
  const { data: watchlist } = useWatchlist();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!selectedId && watchlist && watchlist.length > 0) setSelectedId(watchlist[0].id);
  }, [watchlist, selectedId]);

  const { data, isLoading } = useWatchAnalytics(selectedId || null);
  const { data: feed } = useFeed({ watch_item_id: selectedId || undefined });
  const timeline = feed?.pages.flatMap((p) => p.items).slice(0, 10) ?? [];

  const isCompany = data?.watchItem.type === 'company';
  const volume = data?.volume.map((v) => ({ date: v.date.slice(5), n: v.n })) ?? [];
  const sentiment = data
    ? Object.entries(data.sentiment).filter(([, n]) => n > 0).map(([k, n]) => ({ name: k, value: n }))
    : [];
  const signals = data?.signalTypes.map((s) => ({ name: SIGNAL_LABELS[s.signal_type] ?? s.signal_type, value: s.n })) ?? [];
  const maxSource = Math.max(1, ...(data?.topSources.map((s) => s.n) ?? [1]));

  return (
    <Layout title="Intelligence" subtitle="Tiefenanalyse je Beobachtung">
      {watchlist && watchlist.length > 1 && (
        <div className="mb-4">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="select w-full max-w-xs">
            {watchlist.map((w) => <option key={w.id} value={w.id}>{w.display_name}</option>)}
          </select>
        </div>
      )}
      {!selectedId && <div className="text-slate-400">Lege zuerst eine Beobachtung an.</div>}
      {selectedId && isLoading && <div className="text-slate-400">Lade …</div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Volumen (30 Tage)" className="lg:col-span-2">
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volume}>
                    <CartesianGrid stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="n" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Sentiment">
              <div style={{ height: 220 }}>
                {sentiment.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Keine Daten</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sentiment} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                        {sentiment.map((d) => <Cell key={d.name} fill={SENTIMENT_COLORS[d.name] ?? '#64748b'} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Top-Quellen">
              {data.topSources.length === 0 ? (
                <div className="text-sm text-slate-500">Keine Daten</div>
              ) : (
                <div className="space-y-2">
                  {data.topSources.map((s) => (
                    <div key={s.source} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 truncate text-slate-400">{s.source}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                        <div className="h-full rounded-full bg-accent-500" style={{ width: `${(s.n / maxSource) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right text-slate-300">{s.n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {isCompany ? (
              <Panel title="Signal-Typen">
                <div style={{ height: 220 }}>
                  {signals.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Keine Daten</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={signals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                          {signals.map((_, i) => <Cell key={i} fill={SIGNAL_PALETTE[i % SIGNAL_PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>
            ) : (
              <Panel title="Häufige Schlagworte">
                {data.coTags.length === 0 ? (
                  <div className="text-sm text-slate-500">Keine Daten</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.coTags.map((t) => (
                      <span key={t.tag} className="rounded-full bg-ink-800 px-2.5 py-1 text-xs text-slate-300">
                        #{t.tag} <span className="text-slate-500">{t.n}</span>
                      </span>
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>

          <Panel title={isCompany ? 'Ereignis-Timeline' : 'Neueste Signale'}>
            {timeline.length === 0 ? (
              <div className="text-sm text-slate-500">Noch keine Artikel.</div>
            ) : (
              <ol className="relative space-y-4 border-l border-ink-800 pl-5">
                {timeline.map((it) => (
                  <li key={it.classification_id} className="relative">
                    <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-accent-500" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">{formatDate(it.published_at)}</span>
                      <RankBadge rank={it.rank} />
                      {it.signal_type && <SignalTypeBadge signal={it.signal_type as SignalType} />}
                    </div>
                    <a href={it.source_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-slate-200 hover:text-accent-300">
                      {it.title}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </Layout>
  );
}
