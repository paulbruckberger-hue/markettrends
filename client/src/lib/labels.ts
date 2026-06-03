import { GeoFilter, SignalType, SourceTypeName } from '../types';

export const GEO_LABELS: Record<GeoFilter, string> = {
  global: '🌍 Global',
  dach: '🇩🇪 DACH',
  austria: '🇦🇹 Österreich',
};

export const SOURCE_LABELS: Record<SourceTypeName, string> = {
  linkedin_post: 'LinkedIn',
  linkedin_company: 'LinkedIn Seite',
  google_news: 'Google News',
  rss: 'RSS',
  newsroom: 'Newsroom',
};

export const SIGNAL_LABELS: Record<SignalType, string> = {
  product_launch: 'Produktstart',
  expansion: 'Expansion',
  partnership: 'Partnerschaft',
  personnel: 'Personal',
  funding: 'Finanzierung',
  regulatory: 'Regulatorik',
  earnings: 'Zahlen',
  general: 'Allgemein',
};

export const SIGNAL_COLORS: Record<SignalType, string> = {
  product_launch: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  expansion: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  partnership: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  personnel: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  funding: 'bg-green-500/15 text-green-300 border-green-500/30',
  regulatory: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  earnings: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  general: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
