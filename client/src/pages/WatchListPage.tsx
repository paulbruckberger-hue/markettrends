import { FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Plus, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import {
  useCreateWatch, useDeleteWatch, useRunStatus, useRunWatch, useWatchlist,
} from '../hooks/useWatchlist';
import { GeoFilter, WatchItem, WatchType } from '../types';
import { GEO_LABELS, formatDateTime } from '../lib/labels';
import { apiError } from '../lib/api';

function RunStatusRow({ item, polling, onDone }: { item: WatchItem; polling: boolean; onDone: (id: string) => void }) {
  const qc = useQueryClient();
  const { data } = useRunStatus(item.id, true);

  useEffect(() => {
    if (polling && data && (data.status === 'success' || data.status === 'error')) {
      onDone(item.id);
      qc.invalidateQueries({ queryKey: ['feed'] });
    }
  }, [data?.status, data?.completed_at, polling]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.status === 'idle') {
    return <span className="text-xs text-slate-500">Noch nicht abgerufen</span>;
  }
  if (data.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-accent-300">
        <Loader2 size={13} className="animate-spin" /> Suche läuft …
      </span>
    );
  }
  if (data.status === 'error') {
    return <span className="text-xs text-rose-300" title={data.error_message ?? ''}>Fehler beim letzten Lauf</span>;
  }
  return (
    <span className="text-xs text-emerald-300">
      {data.classifications_new ?? 0} neu · {data.articles_found ?? 0} gefunden · {formatDateTime(data.completed_at)}
    </span>
  );
}

export default function WatchListPage() {
  const { data: items, isLoading } = useWatchlist();
  const create = useCreateWatch();
  const remove = useDeleteWatch();
  const run = useRunWatch();

  const [type, setType] = useState<WatchType>('topic');
  const [query, setQuery] = useState('');
  const [geo, setGeo] = useState<GeoFilter>('global');
  const [label, setLabel] = useState('');
  const [polling, setPolling] = useState<Record<string, boolean>>({});

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      await create.mutateAsync({ type, query, geo_filter: geo, label: label || undefined });
      setQuery('');
      setLabel('');
    } catch {
      /* shown below */
    }
  };

  const onRun = (id: string) => {
    run.mutate(id, { onSuccess: () => setTimeout(() => setPolling((p) => ({ ...p, [id]: true })), 700) });
  };

  return (
    <Layout title="Beobachtungen" subtitle="Themen & Unternehmen, die laufend überwacht werden">
      <form onSubmit={onCreate} className="mb-6 rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[140px_1fr_160px_160px]">
          <select value={type} onChange={(e) => setType(e.target.value as WatchType)} className="select">
            <option value="topic">Thema</option>
            <option value="company">Unternehmen</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={type === 'topic' ? 'z.B. embedded finance' : 'z.B. Stripe'}
            className="select col-span-2 sm:col-span-1"
          />
          <select value={geo} onChange={(e) => setGeo(e.target.value as GeoFilter)} className="select">
            <option value="global">{GEO_LABELS.global}</option>
            <option value="dach">{GEO_LABELS.dach}</option>
            <option value="austria">{GEO_LABELS.austria}</option>
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="select" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={create.isPending || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
          >
            <Plus size={16} /> {create.isPending ? 'Speichern …' : 'Hinzufügen'}
          </button>
          {create.isError && <span className="text-sm text-rose-300">{apiError(create.error)}</span>}
        </div>
      </form>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={18} /> Lade Beobachtungen …
        </div>
      )}

      {!isLoading && (items?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900 p-10 text-center text-slate-400">
          Noch keine Beobachtungen. Lege oben dein erstes Thema oder Unternehmen an.
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <div key={item.id} className="rounded-xl border border-ink-800 bg-ink-850 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color || '#3B82F6' }} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-100">{item.display_name}</span>
                    <span className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-slate-400">
                      {item.type === 'company' ? 'Unternehmen' : 'Thema'}
                    </span>
                    <span className="text-xs text-slate-500">{GEO_LABELS[item.geo_filter]}</span>
                    {item.label && <span className="rounded bg-accent-600/20 px-1.5 py-0.5 text-xs text-accent-300">{item.label}</span>}
                  </div>
                  <div className="mt-1">
                    <RunStatusRow item={item} polling={!!polling[item.id]} onDone={(id) => setPolling((p) => ({ ...p, [id]: false }))} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => { if (confirm(`"${item.display_name}" entfernen?`)) remove.mutate(item.id); }}
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <button
              onClick={() => onRun(item.id)}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-slate-200 hover:bg-ink-700 active:scale-[0.98]"
            >
              <Play size={14} /> Jetzt abrufen
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
