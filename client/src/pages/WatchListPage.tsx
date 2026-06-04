import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import {
  useCreateWatch, useDeleteWatch, useRunStatus, useRunWatch, useSetSchedule, useWatchlist,
} from '../hooks/useWatchlist';
import { GeoFilter, ScheduleInterval, WatchItem, WatchType } from '../types';
import { GEO_LABELS, formatDateTime } from '../lib/labels';
import { apiError } from '../lib/api';

// ---------- Run state machine ----------
type RunPhase = 'idle' | 'triggering' | 'triggered' | 'running' | 'success' | 'error';
interface RunState {
  phase: RunPhase;
  triggeredAt?: number;
  articlesNew?: number;
  classificationsNew?: number;
  completedAt?: string;
  errorMessage?: string;
}

const SCHEDULE_OPTIONS: { v: ScheduleInterval; label: string; sublabel: string }[] = [
  { v: null, label: 'Standard (6h)', sublabel: 'Alle 6 Stunden mit globalem Scheduler' },
  { v: '12h', label: 'Alle 12h', sublabel: 'Zweimal täglich' },
  { v: '24h', label: 'Täglich', sublabel: 'Einmal pro Tag' },
  { v: '48h', label: 'Alle 2 Tage', sublabel: 'Alle zwei Tage' },
  { v: '168h', label: 'Wöchentlich', sublabel: 'Einmal pro Woche' },
  { v: 'manual', label: 'Nur manuell', sublabel: 'Kein automatischer Abruf' },
];

// ---------- Per-item run status display ----------
function RunStatusBar({
  item,
  runState,
  onRetry,
}: {
  item: WatchItem;
  runState: RunState;
  onRetry: (id: string) => void;
}) {
  const fastPoll = runState.phase === 'triggered' || runState.phase === 'triggering';
  const { data: status } = useRunStatus(item.id, { enabled: true, fastPoll });

  // status is consumed by the parent via the shared queryKey
  void status;

  const { phase, classificationsNew, completedAt, errorMessage } = runState;

  if (phase === 'idle' && status) {
    // Show last run info if available
    if (status.status === 'success' && status.completed_at) {
      return (
        <span className="text-xs text-slate-500">
          Letzter Abruf: {formatDateTime(status.completed_at)}
          {status.classifications_new ? ` · ${status.classifications_new} neue Signale` : ''}
        </span>
      );
    }
    if (status.status === 'error') {
      return <span className="text-xs text-rose-400" title={status.error_message ?? ''}>Letzter Lauf fehlgeschlagen</span>;
    }
    return <span className="text-xs text-slate-600">Noch nicht abgerufen</span>;
  }

  if (phase === 'triggering' || phase === 'triggered') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-accent-300">
          <Loader2 size={12} className="animate-spin" /> Research startet...
        </span>
        <span className="text-xs text-slate-500">Du kannst die Seite verlassen – der Abruf läuft im Hintergrund weiter.</span>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-accent-300">
          <Loader2 size={12} className="animate-spin" /> Research läuft...
        </span>
        <span className="text-xs text-slate-500">Du kannst die Seite verlassen – der Abruf läuft im Hintergrund weiter.</span>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="flex items-center gap-2 mt-1">
        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-300 font-medium">
          Abgeschlossen
          {classificationsNew ? ` · ${classificationsNew} neue Signale gefunden` : ' · Keine neuen Signale'}
          {completedAt ? ` · ${formatDateTime(completedAt)}` : ''}
        </span>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <AlertCircle size={13} className="text-rose-400 shrink-0" />
        <span className="text-xs text-rose-300">Fehler: {errorMessage || 'Unbekannter Fehler'}</span>
        <button
          onClick={() => onRetry(item.id)}
          className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 underline"
        >
          <RefreshCw size={11} /> Erneut versuchen
        </button>
      </div>
    );
  }

  return null;
}

// ---------- Schedule picker ----------
function SchedulePicker({ item }: { item: WatchItem }) {
  const [open, setOpen] = useState(false);
  const setSchedule = useSetSchedule();
  const current = SCHEDULE_OPTIONS.find((o) => o.v === item.schedule_interval) ?? SCHEDULE_OPTIONS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg border border-ink-700 px-2 py-1"
        title="Automatischen Abruf einstellen"
      >
        <CalendarClock size={13} /> {current.label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-ink-700 bg-ink-900 shadow-xl">
          <div className="p-2 text-xs text-slate-400 font-semibold px-3 pt-3">Automatischer Abruf</div>
          {SCHEDULE_OPTIONS.map((opt) => (
            <button
              key={String(opt.v)}
              onClick={() => {
                setSchedule.mutate({ id: item.id, interval: opt.v });
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg ${
                item.schedule_interval === opt.v ? 'bg-accent-600/20 text-accent-200' : 'hover:bg-ink-800 text-slate-200'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-slate-500">{opt.sublabel}</div>
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full text-xs text-slate-600 py-2 border-t border-ink-800 mt-1">Schließen</button>
        </div>
      )}
    </div>
  );
}

// ---------- Main page ----------
export default function WatchListPage() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useWatchlist();
  const create = useCreateWatch();
  const remove = useDeleteWatch();
  const runMutation = useRunWatch();

  const [type, setType] = useState<WatchType>('topic');
  const [query, setQuery] = useState('');
  const [geo, setGeo] = useState<GeoFilter>('global');
  const [label, setLabel] = useState('');

  // Per-item run states
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const pollingIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const setPhase = (id: string, update: Partial<RunState>) =>
    setRunStates((prev) => ({ ...prev, [id]: { ...prev[id] ?? { phase: 'idle' }, ...update } }));

  const startPolling = (id: string) => {
    if (pollingIntervals.current[id]) clearInterval(pollingIntervals.current[id]);
    pollingIntervals.current[id] = setInterval(async () => {
      try {
        const { data } = await qc.fetchQuery({
          queryKey: ['run-status', id],
          queryFn: async () => {
            const { default: axios } = await import('axios');
            const token = localStorage.getItem('mt_token');
            const resp = await axios.get(`/api/watchlist/${id}/run-status`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            return resp.data;
          },
          staleTime: 0,
        });
        const s = data as { status: string; articles_new?: number; classifications_new?: number; completed_at?: string; error_message?: string };
        if (s.status === 'running') {
          setPhase(id, { phase: 'running' });
        } else if (s.status === 'success') {
          clearInterval(pollingIntervals.current[id]);
          setPhase(id, {
            phase: 'success',
            articlesNew: s.articles_new,
            classificationsNew: s.classifications_new,
            completedAt: s.completed_at,
          });
          qc.invalidateQueries({ queryKey: ['feed'] });
          qc.invalidateQueries({ queryKey: ['run-status', id] });
        } else if (s.status === 'error') {
          clearInterval(pollingIntervals.current[id]);
          setPhase(id, { phase: 'error', errorMessage: s.error_message ?? 'Unbekannter Fehler' });
          qc.invalidateQueries({ queryKey: ['run-status', id] });
        }
      } catch {
        // network error during poll – keep trying
      }
    }, 3000);
  };

  // Use the run-status API via the hook for background items (already-running)
  // Check any 'running' items in DB on mount
  useEffect(() => {
    return () => { Object.values(pollingIntervals.current).forEach(clearInterval); };
  }, []);

  const handleRun = (id: string) => {
    setPhase(id, { phase: 'triggering', triggeredAt: Date.now() });
    runMutation.mutate(id, {
      onSuccess: () => {
        setPhase(id, { phase: 'triggered', triggeredAt: Date.now() });
        startPolling(id);
      },
      onError: (err) => {
        setPhase(id, { phase: 'error', errorMessage: apiError(err) });
      },
    });
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      await create.mutateAsync({ type, query, geo_filter: geo, label: label || undefined });
      setQuery(''); setLabel('');
    } catch { /* shown below */ }
  };

  return (
    <Layout title="Beobachtungen" subtitle="Themen & Unternehmen überwachen">
      {/* Create form */}
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
          <button type="submit" disabled={create.isPending || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50 active:scale-[0.98]">
            <Plus size={16} /> {create.isPending ? 'Speichern …' : 'Hinzufügen'}
          </button>
          {create.isError && <span className="text-sm text-rose-300">{apiError(create.error)}</span>}
        </div>
      </form>

      {isLoading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Lade...</div>}

      {!isLoading && (items?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900 p-10 text-center text-slate-400">
          Noch keine Beobachtungen. Lege oben dein erstes Thema oder Unternehmen an.
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const rs = runStates[item.id] ?? { phase: 'idle' };
          const isRunning = rs.phase === 'triggering' || rs.phase === 'triggered' || rs.phase === 'running';
          return (
            <div key={item.id} className="rounded-xl border border-ink-800 bg-ink-850 p-4">
              {/* Header row */}
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
                    {/* Run status */}
                    <RunStatusBar item={item} runState={rs} onRetry={(id) => handleRun(id)} />
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm(`"${item.display_name}" entfernen?`)) remove.mutate(item.id); }}
                  className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Action row */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleRun(item.id)}
                  disabled={isRunning}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-ink-700 disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {isRunning
                    ? <><Loader2 size={14} className="animate-spin" /> Läuft...</>
                    : <><Play size={14} /> Jetzt abrufen</>}
                </button>
                <SchedulePicker item={item} />
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
