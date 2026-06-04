import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, ShieldAlert, ToggleLeft, ToggleRight, UserCog, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import {
  useAdminConfig, useUpdateAdminConfig,
  useAdminUsers, useCreateUser, useUpdateUser, CreateUserInput,
} from '../hooks/useAdmin';
import { apiError } from '../lib/api';
import { formatDateTime } from '../lib/labels';

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <Layout title="Admin" subtitle="Globale Einstellungen für alle Accounts">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScraperConfigSection />
        <UsersSection />
      </div>
    </Layout>
  );
}
