import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Icon, IconName } from './Icon';
import { Panel, SectionLabel, Spinner } from './ui';
import { apiError } from '../lib/api';
import { formatDateTime } from '../lib/labels';
import { useMe } from '../hooks/useAuth';
import {
  openDigestPreview, useSendDigest, useSettings, useTestAi,
  useTestEmail, useTestTelegram, useUpdateSettings,
} from '../hooks/useSettings';
import {
  CreateUserInput, RerankBatchResult, useAddUserWatch, useAdminConfig, useAdminUsers,
  useCreateInvite, useCreateUser, useDeleteInvite, useDeleteUser, useDeleteUserWatch,
  useInvites, useRerankBatch, useRerankStatus, useResetUserPassword, useUpdateAdminConfig,
  useUpdateUser, useUserWatchlist,
} from '../hooks/useAdmin';
import { AdminUser, AiModel, DEFAULT_RANK_CRITERIA, PlanTier, RankCriteria, WatchType } from '../types';

const PLAN_LABEL: Record<PlanTier, string> = { free: 'Gratis', plus: 'Plus (€4,99)', pro: 'Pro (€9,99)' };
const PLANS: PlanTier[] = ['free', 'plus', 'pro'];

/* ============================================================
   Shared X-style admin content. Rendered inside both the mobile
   stack (AdminScreen) and the desktop center column (DeskAdmin).
   ============================================================ */

const field: CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border-strong)',
  borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 14,
  fontFamily: 'var(--font)', outline: 'none',
};

const DAYS: { v: string; l: string }[] = [
  { v: 'monday', l: 'Montag' }, { v: 'tuesday', l: 'Dienstag' }, { v: 'wednesday', l: 'Mittwoch' },
  { v: 'thursday', l: 'Donnerstag' }, { v: 'friday', l: 'Freitag' }, { v: 'saturday', l: 'Samstag' }, { v: 'sunday', l: 'Sonntag' },
];
const DEFAULT_VARIANTS: Record<AiModel, string> = {
  claude: 'claude-sonnet-5',
  gemini: 'gemini-3.7-flash',
  deepseek: 'deepseek-v4-flash',
};

function ResultBadge({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: ok ? 'var(--pos)' : 'var(--neg)' }}>
      <Icon name={ok ? 'check' : 'close'} size={13} /> {msg}
    </span>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="press" onClick={(e) => { e.stopPropagation(); onChange(!on); }} style={{
      width: 46, height: 28, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--border-strong)',
      border: 'none', position: 'relative', cursor: 'pointer', transition: 'background .15s', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

function GhostBtn({ children, onClick, disabled, icon }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; icon?: IconName;
}) {
  return (
    <button className="pill pill-ghost press" onClick={onClick} disabled={disabled}
      style={{ padding: '8px 14px', fontSize: 13, opacity: disabled ? 0.5 : 1 }}>
      {icon && <Icon name={icon} size={14} />} {children}
    </button>
  );
}

function AccentBtn({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="pill pill-accent press" onClick={onClick} disabled={disabled}
      style={{ padding: '9px 18px', fontSize: 14, opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, marginBottom: 7 }}>{children}</div>;
}

// ─────────────────────────────── KI-Modell ───────────────────────────────
function AiSection() {
  const { data: s } = useSettings();
  const update = useUpdateSettings();
  const test = useTestAi();
  const [model, setModel] = useState<AiModel>('claude');
  const [variant, setVariant] = useState('');

  useEffect(() => {
    if (!s) return;
    setModel(s.ai_model);
    setVariant(s.ai_model_variant ?? DEFAULT_VARIANTS[s.ai_model]);
  }, [s]);

  const pick = (m: AiModel) => { setModel(m); setVariant(DEFAULT_VARIANTS[m]); };
  const keyOk = s?.keys?.[model];

  return (
    <Panel title="KI-Modell">
      <div style={{ display: 'flex', gap: 8 }}>
        {(['claude', 'gemini', 'deepseek'] as AiModel[]).map((m) => {
          const on = model === m;
          return (
            <button key={m} className="press" onClick={() => pick(m)} style={{
              flex: 1, padding: '11px 0', borderRadius: 12, textTransform: 'capitalize',
              border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
              background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>{m}</button>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <FieldLabel>Variante</FieldLabel>
        <input value={variant} onChange={(e) => setVariant(e.target.value)} style={field} />
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-2)' }}>
        Key-Status:{' '}
        <span style={{ color: keyOk ? 'var(--pos)' : 'var(--neg)', fontWeight: 700 }}>
          {keyOk ? '● konfiguriert (via Env)' : '● fehlt'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <AccentBtn onClick={() => update.mutate({ ai_model: model, ai_model_variant: variant })} disabled={update.isPending}>
          {update.isPending ? 'Speichern …' : 'Speichern'}
        </AccentBtn>
        <GhostBtn icon="sparkle" onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? 'Teste …' : 'Verbindung testen'}
        </GhostBtn>
        {update.isSuccess && <ResultBadge ok msg="Gespeichert" />}
        {test.data && <ResultBadge ok={test.data.ok} msg={test.data.message} />}
        {test.isError && <ResultBadge ok={false} msg={apiError(test.error)} />}
      </div>
    </Panel>
  );
}

// ─────────────────────────────── Telegram ───────────────────────────────
function TelegramSection() {
  const { data: me } = useMe();
  const { data: s } = useSettings();
  const update = useUpdateSettings();
  const test = useTestTelegram();
  const tgLink = s?.telegram_bot_username && me ? `https://t.me/${s.telegram_bot_username}?start=${me.id}` : null;

  return (
    <Panel title="Telegram-Benachrichtigungen">
      <div style={{ fontSize: 13.5, marginBottom: 12 }}>
        Status:{' '}
        {s?.telegram_connected
          ? <span style={{ color: 'var(--pos)', fontWeight: 700 }}>● verbunden</span>
          : <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>● nicht verbunden</span>}
      </div>
      {!s?.telegram_connected && (
        tgLink
          ? <a href={tgLink} target="_blank" rel="noreferrer" className="pill press"
              style={{ display: 'inline-flex', background: '#229ED9', color: '#fff', padding: '9px 14px', fontSize: 13.5, marginBottom: 12 }}>
              <Icon name="share" size={15} /> Mit Telegram verbinden
            </a>
          : <div style={{ color: 'var(--rank2)', fontSize: 12.5, marginBottom: 12 }}>Bot-Username nicht konfiguriert (TELEGRAM_BOT_USERNAME).</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Tagesbriefing (1× täglich, Top 3–5)</span>
        <Toggle on={!!s?.daily_push_enabled} onChange={(v) => update.mutate({ daily_push_enabled: v })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Breaking-Alerts (sofort, sehr selten)</span>
        <Toggle on={!!s?.breaking_alerts_enabled} onChange={(v) => update.mutate({ breaking_alerts_enabled: v })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <GhostBtn icon="bolt" onClick={() => test.mutate()} disabled={test.isPending || !s?.telegram_connected}>
          {test.isPending ? 'Sende …' : 'Test-Nachricht senden'}
        </GhostBtn>
        {test.data && <ResultBadge ok={test.data.ok} msg={test.data.message} />}
        {test.isError && <ResultBadge ok={false} msg={apiError(test.error)} />}
      </div>
    </Panel>
  );
}

// ─────────────────────────────── Newsletter / Briefing ───────────────────────────────
function NewsletterSection() {
  const { data: s } = useSettings();
  const update = useUpdateSettings();
  const send = useSendDigest();
  const testMail = useTestEmail();

  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [day, setDay] = useState('monday');
  const [time, setTime] = useState('07:00');

  useEffect(() => {
    if (!s) return;
    setEnabled(!!s.newsletter_enabled);
    setEmail(s.newsletter_email ?? '');
    setDay(s.newsletter_day ?? 'monday');
    setTime(s.newsletter_time ?? '07:00');
  }, [s]);

  const save = () => update.mutate({
    newsletter_enabled: enabled, newsletter_email: email, newsletter_day: day, newsletter_time: time,
  });

  return (
    <Panel title="Wochen-Briefing (E-Mail)">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Newsletter aktivieren</span>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>
      <FieldLabel>Empfänger-E-Mail</FieldLabel>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.com" style={field} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div>
          <FieldLabel>Tag</FieldLabel>
          <select value={day} onChange={(e) => setDay(e.target.value)} style={field}>
            {DAYS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Uhrzeit</FieldLabel>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={field} />
        </div>
      </div>
      {s && !s.smtp_configured && (
        <div style={{ marginTop: 12, color: 'var(--rank2)', fontSize: 12.5 }}>
          SMTP nicht konfiguriert – Versand erst nach Setup möglich.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <AccentBtn onClick={save} disabled={update.isPending}>{update.isPending ? 'Speichern …' : 'Speichern'}</AccentBtn>
        <GhostBtn icon="eye" onClick={() => void openDigestPreview()}>Vorschau</GhostBtn>
        <GhostBtn icon="mail" onClick={() => send.mutate()} disabled={send.isPending}>
          {send.isPending ? 'Sende …' : 'Jetzt senden'}
        </GhostBtn>
        <GhostBtn icon="mail" onClick={() => testMail.mutate()} disabled={testMail.isPending}>
          {testMail.isPending ? 'Sende …' : 'Test-E-Mail'}
        </GhostBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {send.data && <ResultBadge ok={send.data.sent} msg={send.data.message} />}
        {testMail.data && <ResultBadge ok={testMail.data.ok} msg={testMail.data.message} />}
        {testMail.isError && <ResultBadge ok={false} msg={apiError(testMail.error)} />}
        {s?.newsletter_last_sent && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Zuletzt gesendet: {formatDateTime(s.newsletter_last_sent)}</span>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────── Scraper config (admin) ───────────────────────────────
function ScraperSection() {
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

  if (isLoading) return <Panel title="Scraper-Einstellungen"><div style={{ color: 'var(--text-3)', fontSize: 13 }}>Lädt …</div></Panel>;

  const num = (v: number, set: (n: number) => void) => (
    <input type="number" value={v} onChange={(e) => set(Number(e.target.value))} style={{ ...field, width: 120 }} />
  );

  return (
    <Panel title="Scraper-Einstellungen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>LinkedIn: Max. Posts pro Suche</FieldLabel>
          {num(liPosts, setLiPosts)}
        </div>
        <div>
          <FieldLabel>LinkedIn: Standard-Zeitraum</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['day', 'week', 'month'] as const).map((v) => {
              const on = liLimit === v;
              return (
                <button key={v} className="press" onClick={() => setLiLimit(v)} style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
                  background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)',
                }}>{v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}</button>
              );
            })}
          </div>
        </div>
        <div>
          <FieldLabel>Google News: Max. Ergebnisse pro Begriff</FieldLabel>
          {num(gnResults, setGnResults)}
        </div>
        <div>
          <FieldLabel>Collector: Max. KI-Klassifizierungen (Kostenschutz)</FieldLabel>
          {num(maxClass, setMaxClass)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <AccentBtn onClick={() => update.mutate({
          linkedin_max_posts: liPosts, linkedin_posted_limit: liLimit,
          google_news_max_results: gnResults, collector_max_classifications: maxClass,
        })} disabled={update.isPending}>{update.isPending ? 'Speichern …' : 'Speichern'}</AccentBtn>
        {update.isSuccess && <ResultBadge ok msg="Gespeichert" />}
        {update.isError && <ResultBadge ok={false} msg={apiError(update.error)} />}
        {cfg?.updated_at && <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>Zuletzt: {formatDateTime(cfg.updated_at)}</span>}
      </div>
    </Panel>
  );
}

// ─────────────────────────────── Rank criteria (admin) ───────────────────────────────
const RANK_ROWS = [
  { key: 'rank1' as const, label: 'P1 · Kritisch', color: 'var(--rank1)' },
  { key: 'rank2' as const, label: 'P2 · Relevant', color: 'var(--rank2)' },
  { key: 'rank3' as const, label: 'P3 · Kontext', color: 'var(--rank3)' },
];

function RankCriteriaSection() {
  const { data: cfg, isLoading } = useAdminConfig();
  const update = useUpdateAdminConfig();
  const [criteria, setCriteria] = useState<RankCriteria>(DEFAULT_RANK_CRITERIA);
  const [lang, setLang] = useState<'de' | 'en'>('de');

  useEffect(() => { if (cfg?.rank_criteria) setCriteria(cfg.rank_criteria); }, [cfg]);

  const setField = (rank: 'rank1' | 'rank2' | 'rank3', value: string) =>
    setCriteria((p) => ({ ...p, [lang]: { ...p[lang], [rank]: value } }));

  if (isLoading) return <Panel title="KI-Rang-Kriterien"><div style={{ color: 'var(--text-3)', fontSize: 13 }}>Lädt …</div></Panel>;

  return (
    <Panel title="KI-Rang-Kriterien">
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 12px' }}>
        Definiert, was die KI als P1/P2/P3 einordnet. Wird direkt in den Klassifizierungs-Prompt injiziert.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['de', 'en'] as const).map((l) => {
          const on = lang === l;
          return (
            <button key={l} className="press" onClick={() => setLang(l)} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
              background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)',
            }}>{l === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}</button>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RANK_ROWS.map(({ key, label, color }) => (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span>
            </div>
            <textarea value={criteria[lang][key]} onChange={(e) => setField(key, e.target.value)} rows={2}
              placeholder={DEFAULT_RANK_CRITERIA[lang][key]}
              style={{ ...field, resize: 'vertical', lineHeight: 1.45 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <AccentBtn onClick={() => update.mutate({ rank_criteria: criteria })} disabled={update.isPending}>
          {update.isPending ? 'Speichern …' : 'Speichern'}
        </AccentBtn>
        <GhostBtn icon="refresh" onClick={() => setCriteria(DEFAULT_RANK_CRITERIA)}>Zurücksetzen</GhostBtn>
        {update.isSuccess && <ResultBadge ok msg="Gespeichert" />}
        {update.isError && <ResultBadge ok={false} msg={apiError(update.error)} />}
      </div>
    </Panel>
  );
}

// ─────────────────────────────── Users (admin) ───────────────────────────────
function UserKeywordManager({ userId }: { userId: string }) {
  const { data: items, isLoading } = useUserWatchlist(userId);
  const add = useAddUserWatch();
  const del = useDeleteUserWatch();
  const [q, setQ] = useState('');
  const [type, setType] = useState<WatchType>('topic');

  const submit = async () => {
    if (!q.trim()) return;
    try { await add.mutateAsync({ userId, type, query: q.trim() }); setQ(''); } catch { /* shown below */ }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <FieldLabel>Keywords / Beobachtungen</FieldLabel>
      {isLoading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Lädt …</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(items ?? []).length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Noch keine Keywords.</div>}
          {(items ?? []).map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'var(--raise)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', width: 16, textAlign: 'center' }}>{it.type === 'company' ? '🏢' : '#'}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.display_name}</span>
              {!it.is_active && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>inaktiv</span>}
              <button className="press" onClick={() => del.mutate({ userId, itemId: it.id })} title="Entfernen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neg)', display: 'flex' }}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <select value={type} onChange={(e) => setType(e.target.value as WatchType)} style={{ ...field, width: 'auto' }}>
          <option value="topic">Thema</option>
          <option value="company">Unternehmen</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
          placeholder="Keyword hinzufügen …" style={{ ...field, flex: 1 }} />
        <GhostBtn icon="plus" onClick={() => void submit()} disabled={add.isPending || !q.trim()}>Add</GhostBtn>
      </div>
      {add.isError && <div style={{ marginTop: 6 }}><ResultBadge ok={false} msg={apiError(add.error)} /></div>}
    </div>
  );
}

function UserManageRow({ u }: { u: AdminUser }) {
  const updateUser = useUpdateUser();
  const resetPw = useResetUserPassword();
  const delUser = useDeleteUser();
  const [open, setOpen] = useState(false);
  const [bonus, setBonus] = useState(u.keyword_bonus ?? 0);
  const [pw, setPw] = useState('');

  useEffect(() => { setBonus(u.keyword_bonus ?? 0); }, [u.keyword_bonus]);

  const quotaLabel = u.entitlements?.unlimited ? '∞' : (u.entitlements?.quota ?? '–');
  const used = u.used ?? 0;

  const doReset = async () => {
    if (pw.length < 4) return;
    try { await resetPw.mutateAsync({ id: u.id, password: pw }); setPw(''); } catch { /* shown */ }
  };
  const doDelete = () => {
    if (window.confirm(`Benutzer „${u.username}" wirklich löschen? Alle Daten/Abos werden entfernt.`)) {
      delUser.mutate(u.id);
    }
  };

  return (
    <div style={{ borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{u.username}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: 'var(--accent)', background: 'var(--accent-soft)' }}>
              {u.is_comp ? 'Gratis-Comp' : PLAN_LABEL[(u.plan ?? 'free') as PlanTier]}
            </span>
            {u.role === 'admin' && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: 'var(--rank2)', background: 'color-mix(in srgb, var(--rank2) 16%, transparent)' }}>admin</span>}
            {!u.is_active && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neg)' }}>inaktiv</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {used}/{quotaLabel} Keywords{u.email ? ` · ${u.email}` : ''}
          </div>
        </div>
        <button className="press" title={u.is_active ? 'Deaktivieren' : 'Aktivieren'}
          onClick={() => updateUser.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: u.is_active ? 'var(--pos)' : 'var(--text-3)', display: 'flex' }}>
          <Icon name={u.is_active ? 'eye' : 'eyeOff'} size={20} />
        </button>
        <button className="press" title="Verwalten" onClick={() => setOpen((o) => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
          <Icon name="settings" size={19} />
        </button>
      </div>

      {open && (
        <div style={{ padding: '4px 12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <FieldLabel>Tarif</FieldLabel>
              <select value={u.plan ?? 'free'} onChange={(e) => updateUser.mutate({ id: u.id, patch: { plan: e.target.value as PlanTier } })} style={field}>
                {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Rolle</FieldLabel>
              <select value={u.role} onChange={(e) => updateUser.mutate({ id: u.id, patch: { role: e.target.value as 'admin' | 'user' } })} style={field}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Gratis freischalten (Comp)</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Voller Pro-Zugang ohne Bezahlung</div>
            </div>
            <Toggle on={!!u.is_comp} onChange={(v) => updateUser.mutate({ id: u.id, patch: { is_comp: v } })} />
          </div>

          <div style={{ marginTop: 12 }}>
            <FieldLabel>Extra Gratis-Keywords (Bonus auf Tarif-Quota)</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={0} value={bonus} onChange={(e) => setBonus(Math.max(0, Number(e.target.value)))} style={{ ...field, width: 110 }} />
              <GhostBtn onClick={() => updateUser.mutate({ id: u.id, patch: { keyword_bonus: bonus } })} disabled={updateUser.isPending}>Speichern</GhostBtn>
            </div>
          </div>

          <UserKeywordManager userId={u.id} />

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
            <FieldLabel>Passwort zurücksetzen</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="neues Passwort (min. 4)" style={{ ...field, flex: 1 }} />
              <GhostBtn icon="key" onClick={() => void doReset()} disabled={resetPw.isPending || pw.length < 4}>Setzen</GhostBtn>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              {resetPw.isSuccess && <ResultBadge ok msg="Passwort gesetzt" />}
              {resetPw.isError && <ResultBadge ok={false} msg={apiError(resetPw.error)} />}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'space-between' }}>
            <button className="press" onClick={doDelete} disabled={delUser.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--neg) 45%, transparent)', background: 'color-mix(in srgb, var(--neg) 10%, transparent)', color: 'var(--neg)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: delUser.isPending ? 0.5 : 1 }}>
              <Icon name="trash" size={15} /> Benutzer löschen
            </button>
            {delUser.isError && <ResultBadge ok={false} msg={apiError(delUser.error)} />}
          </div>
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const { data: users, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || password.length < 4) return;
    const input: CreateUserInput = { username: username.trim(), password, role, email: email.trim() || undefined };
    try {
      await createUser.mutateAsync(input);
      setUsername(''); setPassword(''); setEmail(''); setRole('user'); setShow(false);
    } catch { /* error shown below */ }
  };

  return (
    <Panel title="Benutzerverwaltung">
      {isLoading && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Lädt …</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users?.map((u) => <UserManageRow key={u.id} u={u} />)}
      </div>

      {show ? (
        <form onSubmit={create} style={{ marginTop: 12, padding: 14, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Neuer Benutzer</div>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Benutzername *" style={field} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort (min. 4 Zeichen) *" style={field} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail (optional)" style={{ ...field, flex: 1 }} />
            <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')} style={{ ...field, width: 'auto' }}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AccentBtn onClick={() => undefined} disabled={createUser.isPending || !username.trim() || password.length < 4}>
              {createUser.isPending ? 'Erstellt …' : 'Erstellen'}
            </AccentBtn>
            <button type="button" className="press" onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13.5, cursor: 'pointer' }}>Abbrechen</button>
            {createUser.isError && <ResultBadge ok={false} msg={apiError(createUser.error)} />}
          </div>
        </form>
      ) : (
        <button className="press" onClick={() => setShow(true)} style={{
          marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999,
          border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
        }}><Icon name="plus" size={15} /> Neuen Benutzer anlegen</button>
      )}
    </Panel>
  );
}

// ─────────────────────────────── Invites (admin) ───────────────────────────────
function InvitesSection() {
  const { data: invites, isLoading } = useInvites();
  const createInvite = useCreateInvite();
  const delInvite = useDeleteInvite();
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<PlanTier>('free');
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pending = (invites ?? []).filter((i) => !i.accepted_at);

  const submit = async () => {
    if (!email.trim()) return;
    try {
      const r = await createInvite.mutateAsync({ email: email.trim(), plan });
      setEmail(''); setLastUrl(r.accept_url);
    } catch { /* shown below */ }
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <Panel title="Einladungen">
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 12px' }}>
        Lade Kund:innen per E-Mail ein. Ist SMTP nicht konfiguriert, kopiere den Einladungslink einfach und teile ihn manuell.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.com" style={{ ...field, flex: 1, minWidth: 180 }} />
        <select value={plan} onChange={(e) => setPlan(e.target.value as PlanTier)} style={{ ...field, width: 'auto' }}>
          {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
        </select>
        <AccentBtn onClick={() => void submit()} disabled={createInvite.isPending || !email.trim()}>
          {createInvite.isPending ? 'Lädt ein …' : 'Einladen'}
        </AccentBtn>
      </div>
      {createInvite.isError && <div style={{ marginTop: 8 }}><ResultBadge ok={false} msg={apiError(createInvite.error)} /></div>}
      {createInvite.data && (
        <div style={{ marginTop: 10, fontSize: 12.5 }}>
          {createInvite.data.emailed
            ? <ResultBadge ok msg="Einladungs-E-Mail gesendet" />
            : <span style={{ color: 'var(--rank2)' }}>E-Mail nicht gesendet{createInvite.data.email_error ? ` (${createInvite.data.email_error})` : ''} — Link unten teilen.</span>}
        </div>
      )}
      {lastUrl && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input readOnly value={lastUrl} style={{ ...field, flex: 1, fontSize: 12 }} onFocus={(e) => e.currentTarget.select()} />
          <GhostBtn icon="share" onClick={() => void copy(lastUrl)}>{copied ? 'Kopiert' : 'Kopieren'}</GhostBtn>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <FieldLabel>Offene Einladungen</FieldLabel>
        {isLoading ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Lädt …</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Keine offenen Einladungen.</div>}
            {pending.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <Icon name="mail" size={15} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.email}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{PLAN_LABEL[i.plan]}</span>
                <button className="press" title="Link kopieren" onClick={() => void copy(i.accept_url)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}>
                  <Icon name="share" size={16} />
                </button>
                <button className="press" title="Zurückziehen" onClick={() => delInvite.mutate(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neg)', display: 'flex' }}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────── Reranking ───────────────────────────────
function RerankSection() {
  const { data: status, refetch } = useRerankStatus();
  const batch = useRerankBatch();
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<RerankBatchResult | null>(null);
  const [doneRuns, setDoneRuns] = useState(0); // classifications processed in this run
  const stop = useRef(false);

  const total = status?.total ?? 0;
  const remaining = status?.remaining ?? 0;
  const done = total - remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const run = async () => {
    setRunning(true); stop.current = false; setDoneRuns(0);
    try {
      // Loop batches until the backend reports nothing stale left.
      // Each call re-ranks up to 20 articles + recomputes per-user ranks.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (stop.current) break;
        const r = await batch.mutateAsync(20);
        setLast(r);
        setDoneRuns((n) => n + r.processed);
        if (r.done || r.processed === 0) break;
      }
    } catch { /* error surfaced via batch.isError */ }
    finally { setRunning(false); await refetch(); }
  };

  return (
    <Panel title="Reranking (Bestand neu bewerten)">
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 12px' }}>
        <b>Optional.</b> Dein 👍/👎-Feedback wird bereits <b>automatisch und sofort</b> verarbeitet
        (die Artikel zum jeweiligen Keyword werden direkt neu personalisiert). Dieser Knopf bewertet
        zusätzlich den <b>gesamten Altbestand</b> neu — z.B. nach einer Änderung des Ranking-Prompts.
        Läuft in Schüben — lass den Tab offen.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-2)' }}>Fortschritt</span>
        <span className="tabular" style={{ fontWeight: 700 }}>{done} / {total} · {remaining} offen</span>
      </div>
      <div style={{ height: 8, background: 'var(--chip)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 999, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {!running
          ? <AccentBtn onClick={run} disabled={total === 0}>{remaining > 0 ? 'Reranking starten' : 'Erneut durchlaufen'}</AccentBtn>
          : <GhostBtn icon="close" onClick={() => { stop.current = true; }}>Stoppen</GhostBtn>}
        {running && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}><Spinner size={16} /> läuft … {doneRuns} bewertet</span>}
        {!running && last && <ResultBadge ok msg={`Fertig: ${last.remaining === 0 ? 'alle aktuell' : last.remaining + ' offen'}`} />}
        {batch.isError && <ResultBadge ok={false} msg={apiError(batch.error)} />}
      </div>
    </Panel>
  );
}

export default function AdminSections() {
  const { data: s } = useSettings();
  if (!s) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}><Spinner /></div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionLabel>Diagnose &amp; KI</SectionLabel>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AiSection />
        <TelegramSection />
      </div>
      <SectionLabel>Versand</SectionLabel>
      <div style={{ padding: '0 16px 8px' }}><NewsletterSection /></div>
      <SectionLabel>Kunden &amp; Zugang</SectionLabel>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <UsersSection />
        <InvitesSection />
      </div>
      <SectionLabel>Ranking</SectionLabel>
      <div style={{ padding: '0 16px 8px' }}><RerankSection /></div>
      <SectionLabel>App-Konfiguration</SectionLabel>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ScraperSection />
        <RankCriteriaSection />
      </div>
      <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: 20 }}>Nicheletter.ai · Administration</div>
    </div>
  );
}
