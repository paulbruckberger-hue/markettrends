import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BookmarkCheck, CheckCircle2, Eye, Newspaper } from 'lucide-react';
import Layout from '../components/Layout';
import { useOverview } from '../hooks/useAnalytics';
import { SOURCE_LABELS } from '../lib/labels';
import { SourceTypeName } from '../types';

const RANK_COLORS = ['#f43f5e', '#f59e0b', '#64748b'];
const tooltipStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' };

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-sm">{label}</span></div>
      <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useOverview();

  const volume = data?.volume.map((v) => ({ date: v.date.slice(5), n: v.n })) ?? [];
  const rankData = data
    ? [
        { name: 'Rang 1', value: data.byRank['1'] ?? 0 },
        { name: 'Rang 2', value: data.byRank['2'] ?? 0 },
        { name: 'Rang 3', value: data.byRank['3'] ?? 0 },
      ].filter((d) => d.value > 0)
    : [];
  const sources = data?.bySource ?? [];
  const maxSource = Math.max(1, ...sources.map((s) => s.n));

  return (
    <Layout title="Dashboard" subtitle="Überblick über alle Beobachtungen">
      {isLoading && <div className="text-slate-400">Lade …</div>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Newspaper size={16} />} label="Signale gesamt" value={data.total} />
            <Stat icon={<Eye size={16} />} label="Aktive Beobachtungen" value={data.watchCount} />
            <Stat icon={<CheckCircle2 size={16} />} label="Gelesen" value={data.read} />
            <Stat icon={<BookmarkCheck size={16} />} label="Lesezeichen" value={data.bookmarked} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="Volumen (letzte 14 Tage)">
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volume}>
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#1e293b55' }} />
                      <Bar dataKey="n" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <Panel title="Verteilung nach Rang">
              <div style={{ height: 240 }}>
                {rankData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Keine Daten</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={rankData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {rankData.map((_, i) => <Cell key={i} fill={RANK_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Quellen">
            {sources.length === 0 ? (
              <div className="text-sm text-slate-500">Keine Daten</div>
            ) : (
              <div className="space-y-2">
                {sources.map((s) => (
                  <div key={s.source_type} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-slate-400">{SOURCE_LABELS[s.source_type as SourceTypeName] ?? s.source_type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${(s.n / maxSource) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-slate-300">{s.n}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </Layout>
  );
}
