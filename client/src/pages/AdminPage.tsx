import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Plus, ShieldAlert, ToggleLeft, ToggleRight, UserCog, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import {
  useAdminConfig, useUpdateAdminConfig,
  useAdminUsers, useCreateUser, useUpdateUser, CreateUserInput,
} from '../hooks/useAdmin';
import { apiError } from '../lib/api';
import { formatDateTime } from '../lib/labels';
import { DEFAULT_RANK_CRITERIA, RankCriteria } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
      <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-slate-100">
        <Icon size={17} className="text-accent-400 shrink-0" /> {title}
      </h2>
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[220px_1fr] sm:items-center py-3 border-b border-ink-800 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SaveBadge({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {msg}
    </span>
  );
}

// ─── Scraper Config Section ───────────────────────────────────────────────────

function ScraperConfigSection() {
  const { data: cfg, isLoading } = useAdminConfig();
  const update = useUpdateAdminConfig();

  const [liPosts, setLiPosts] = useState(25);
  const [liLimit, setLiLimit] = useState('week');
  const [gnResults, setGnResults] = useState(20);
  const [maxClass, setMaxClass] = useState(30);

  useEffect(() => {
    if (!cfg) return;
    setLiPosts(cfg.linkedin_max_posts);
    setLiLimit(cfg.linkedin_posted_limit);
    setGnResults(cfg.google_news_max_results);
    setMaxClass(cfg.collector_max_classifications);
  }, [cfg]);

  const save = () => update.mutate({
    linkedin_max_posts: liPosts,
    linkedin_posted_limit: liLimit,
    google_news_max_results: gnResults,
    collector_max_classifications: maxClass,
  });

  if (isLoading) return <div className="text-slate-400 text-sm">Lade …</div>;

  return (
    <Section title="Scraper-Einstellungen" icon={UserCog}>
      <FieldRow label="LinkedIn: Max. Posts" hint="Gilt für Themen- und Unternehmenssuche">
        <input
          type="number" min={1} max={500} value={liPosts}
          onChange={(e) => setLiPosts(Number(e.target.value))}
          className="select w-32"
        />
      </FieldRow>

      <FieldRow label="LinkedIn: Zeitraum (Standard)" hint="Wie weit zurück ohne manuellen Lookback">
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setLiLimit(v)}
              className={`rounded-lg border px-4 py-1.5 text-sm capitalize transition ${
                liLimit === v
                  ? 'border-accent-500 bg-accent-600/20 text-accent-200'
                  : 'border-ink-700 text-slate-300 hover:bg-ink-800'
              }`}
            >
              {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Google News: Max. Ergebnisse" hint="Pro Suchbegriff, pro Lauf">
        <input
          type="number" min={1} max={100} value={gnResults}
          onChange={(e) => setGnResults(Number(e.target.value))}
          className="select w-32"
        />
      </FieldRow>

      <FieldRow label="Collector: Max. KI-Klassifizierungen" hint="Pro Suchbegriff und Lauf (Kostenschutz)">
        <input
          type="number" min={1} max={100} value={maxClass}
          onChange={(e) => setMaxClass(Number(e.target.value))}
          className="select w-32"
        />
      </FieldRow>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
        >
          {update.isPending ? <><Loader2 size={14} className="animate-spin" /> Speichern …</> : 'Speichern'}
        </button>
        {update.isSuccess && <SaveBadge ok msg="Gespeichert" />}
        {update.isError && <SaveBadge ok={false} msg={apiError(update.error)} />}
        {cfg?.updated_at && (
          <span className="text-xs text-slate-600 ml-auto">Zuletzt geändert: {formatDateTime(cfg.updated_at)}</span>
        )}
      </div>
    </Section>
  );
}

// ─── Users Section ────────────────────────────────────────────────────────────

function UsersSection() {
  const { data: users, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [showForm, setShowForm] = useState(false);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || newPassword.length < 4) return;
    const input: CreateUserInput = {
      username: newUsername.trim(),
      password: newPassword,
      role: newRole,
      email: newEmail.trim() || undefined,
    };
    try {
      await createUser.mutateAsync(input);
      setNewUsername(''); setNewPassword(''); setNewEmail(''); setNewRole('user');
      setShowForm(false);
    } catch { /* error shown below */ }
  };

  return (
    <Section title="Benutzerverwaltung" icon={ShieldAlert}>
      {isLoading && <div className="text-slate-400 text-sm">Lade …</div>}

      <div className="space-y-2 mb-5">
        {users?.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-850 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-100">{u.username}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  u.role === 'admin' ? 'bg-amber-500/15 text-amber-300' : 'bg-ink-800 text-slate-400'
                }`}>
                  {u.role}
                </span>
                {!u.is_active && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-300">inaktiv</span>}
                {u.email && <span className="text-xs text-slate-500">{u.email}</span>}
              </div>
              {u.created_at && <div className="text-xs text-slate-600 mt-0.5">Erstellt: {formatDateTime(u.created_at)}</div>}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Role toggle */}
              <select
                value={u.role}
                onChange={(e) => updateUser.mutate({ id: u.id, patch: { role: e.target.value as 'admin' | 'user' } })}
                className="select text-xs py-1"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              {/* Active toggle */}
              <button
                onClick={() => updateUser.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
                title={u.is_active ? 'Deaktivieren' : 'Aktivieren'}
                className="text-slate-400 hover:text-slate-200"
              >
                {u.is_active
                  ? <ToggleRight size={22} className="text-emerald-400" />
                  : <ToggleLeft size={22} className="text-slate-600" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm ? (
        <form onSubmit={onCreate} className="rounded-xl border border-ink-700 bg-ink-850 p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-200">Neuer Benutzer</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Benutzername *" className="select col-span-2"
            />
            <input
              type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Passwort (min. 4 Zeichen) *" className="select col-span-2"
            />
            <input
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="E-Mail (optional)" className="select"
            />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')} className="select">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit" disabled={createUser.isPending || !newUsername.trim() || newPassword.length < 4}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
            >
              {createUser.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Erstellen
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-slate-200">
              Abbrechen
            </button>
            {createUser.isError && <span className="text-xs text-rose-400">{apiError(createUser.error)}</span>}
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-300 hover:bg-ink-800"
        >
          <Plus size={15} /> Neuen Benutzer anlegen
        </button>
      )}
    </Section>
  );
}

// ─── Rank Criteria Section ────────────────────────────────────────────────────

const RANK_META = [
  { key: 'rank1' as const, label: 'Rang 1 🔴', hint: 'Hochrelevant — sofort handlungsrelevant', color: 'border-rose-500/40 bg-rose-500/5' },
  { key: 'rank2' as const, label: 'Rang 2 🟠', hint: 'Relevant — beobachtenswert', color: 'border-amber-500/40 bg-amber-500/5' },
  { key: 'rank3' as const, label: 'Rang 3 ⚪', hint: 'Marginale Relevanz', color: 'border-slate-500/40 bg-slate-500/5' },
];

function RankCriteriaSection() {
  const { data: cfg, isLoading } = useAdminConfig();
  const update = useUpdateAdminConfig();

  const [criteria, setCriteria] = useState<RankCriteria>(DEFAULT_RANK_CRITERIA);
  const [tab, setTab] = useState<'de' | 'en'>('de');

  useEffect(() => {
    if (cfg?.rank_criteria) setCriteria(cfg.rank_criteria);
  }, [cfg]);

  const setField = (lang: 'de' | 'en', rank: 'rank1' | 'rank2' | 'rank3', value: string) => {
    setCriteria((prev) => ({ ...prev, [lang]: { ...prev[lang], [rank]: value } }));
  };

  const save = () => update.mutate({ rank_criteria: criteria });

  const resetToDefaults = () => setCriteria(DEFAULT_RANK_CRITERIA);

  if (isLoading) return (
    <Section title="KI-Rang-Kriterien" icon={BookOpen}>
      <div className="text-slate-400 text-sm">Lade …</div>
    </Section>
  );

  return (
    <Section title="KI-Rang-Kriterien" icon={BookOpen}>
      <p className="mb-4 text-xs text-slate-400 leading-relaxed">
        Diese Texte definieren, was die KI als Rang 1, 2 und 3 einordnen soll. Sie werden direkt in den
        Klassifizierungs-Prompt injiziert. Außerdem lernt die KI automatisch aus deinen Rang-Korrekturen im Feed
        (letzte 10 Korrekturen werden als Beispiele mitgeliefert).
      </p>

      {/* Language tabs */}
      <div className="mb-4 flex gap-1 border-b border-ink-700 pb-0">
        {(['de', 'en'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setTab(lang)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === lang ? 'border-accent-400 text-accent-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {RANK_META.map(({ key, label, hint, color }) => (
          <div key={key} className={`rounded-lg border p-3 ${color}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">{label}</span>
              <span className="text-xs text-slate-500">{hint}</span>
            </div>
            <textarea
              value={criteria[tab][key]}
              onChange={(e) => setField(tab, key, e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent-500 resize-none"
              placeholder={DEFAULT_RANK_CRITERIA[tab][key]}
            />
            <div className="mt-1 text-xs text-slate-600">
              Standard: <span className="italic">{DEFAULT_RANK_CRITERIA[tab][key]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-2 text-sm font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
        >
          {update.isPending ? <><Loader2 size={14} className="animate-spin" /> Speichern …</> : 'Speichern'}
        </button>
        <button
          onClick={resetToDefaults}
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-300 hover:bg-ink-800"
        >
          Zurücksetzen
        </button>
        {update.isSuccess && <SaveBadge ok msg="Gespeichert" />}
        {update.isError && <SaveBadge ok={false} msg={apiError(update.error)} />}
      </div>
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <Layout title="Admin" subtitle="Globale Einstellungen für alle Accounts">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScraperConfigSection />
        <UsersSection />
      </div>
      <div className="mt-6">
        <RankCriteriaSection />
      </div>
    </Layout>
  );
}
