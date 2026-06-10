import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import nodemailer, { Transporter } from 'nodemailer';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, newsletter_clusters, settings, users, watch_items } from '../db/schema';
import { config } from '../config';
import { AiModel, generateText } from './ai/classifier';

// ---------- Template ----------
let templateFn: HandlebarsTemplateDelegate | null = null;
function getTemplate(): HandlebarsTemplateDelegate {
  if (!templateFn) {
    const file = path.join(__dirname, '../templates/weekly-digest.html');
    templateFn = Handlebars.compile(fs.readFileSync(file, 'utf-8'));
  }
  return templateFn;
}

// ---------- Mail transport ----------
let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    throw new Error('SMTP ist nicht vollständig konfiguriert');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

// ---------- Helpers ----------
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function summaryToHtml(summary: string): string {
  return esc(summary || '').split('\n').map((l) => l.trim()).filter(Boolean).join('<br>');
}
function fmtDate(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
}
function weekLabel(): string {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return `${from.toLocaleDateString('de-AT', opt)} – ${now.toLocaleDateString('de-AT', opt)}`;
}

const UNASSIGNED_COLOR = '#64748B';
const UNASSIGNED_NAME = 'Übrige Beobachtungen';

interface DigestArticle {
  title: string;
  summary: string;
  summaryHtml: string;
  source_name: string;
  source_url: string;
  watch_display_name: string;
  published_at: string;
  rank: number;
}

interface Section {
  name: string;
  color: string;
  insight: string;
  rank1Articles: DigestArticle[];
  rank2Articles: DigestArticle[];
}

export interface MailData {
  hasContent: boolean;
  weekLabel: string;
  headline: string;
  executiveSummary: string;
  sections: Section[];
  stats: { total: number; rank1: number; sources: number };
  webViewUrl: string;
}

interface Row {
  rank: number;
  title: string;
  summary: string;
  source_name: string | null;
  source_type: string;
  source_url: string;
  published_at: Date | null;
  created_at: Date | null;
  watch_display_name: string;
  cluster_id: string | null;
}

/** All rank 1/2 signals from the user's active watches in the last 7 days. */
async function loadRows(userId: string): Promise<Row[]> {
  const since = sql`now() - interval '7 days'`;
  return db.select({
    rank: classifications.rank,
    title: classifications.title,
    summary: classifications.summary,
    source_name: articles.source_name,
    source_type: articles.source_type,
    source_url: articles.source_url,
    published_at: articles.published_at,
    created_at: articles.created_at,
    watch_display_name: watch_items.display_name,
    cluster_id: watch_items.cluster_id,
  })
    .from(watch_items)
    .innerJoin(classifications, eq(classifications.search_term_id, watch_items.search_term_id))
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .where(and(
      eq(watch_items.user_id, userId),
      eq(watch_items.is_active, true),
      inArray(classifications.rank, [1, 2]),
      gte(classifications.created_at, since),
    ))
    .orderBy(asc(classifications.rank), desc(articles.published_at))
    .limit(120) as Promise<Row[]>;
}

function toArticle(r: Row): DigestArticle {
  return {
    title: r.title,
    summary: r.summary,
    summaryHtml: summaryToHtml(r.summary),
    source_name: r.source_name || r.source_type,
    source_url: r.source_url,
    watch_display_name: r.watch_display_name,
    published_at: fmtDate(r.published_at ?? r.created_at),
    rank: r.rank,
  };
}

/** Build one section from its rows — capped to stay compact (5 top cards, 8 one-liners). */
function buildSection(name: string, color: string, rows: Row[]): Section {
  return {
    name,
    color,
    insight: '',
    rank1Articles: rows.filter((r) => r.rank === 1).slice(0, 5).map(toArticle),
    rank2Articles: rows.filter((r) => r.rank === 2).slice(0, 8).map(toArticle),
  };
}

function statsFor(rows: Row[]): { total: number; rank1: number; sources: number } {
  return {
    total: rows.length,
    rank1: rows.filter((r) => r.rank === 1).length,
    sources: new Set(rows.map((r) => r.source_name || r.source_type)).size,
  };
}

/**
 * One AI call per mail: fills the executive summary + a 1-2 sentence insight per
 * section. Degrades gracefully (empty insights + generic summary) on failure.
 */
async function fillInsights(headline: string, sections: Section[], ai: { model: AiModel; variant?: string }): Promise<string> {
  if (sections.length === 0) return '';
  const list = sections.map((s, i) => {
    const items = [...s.rank1Articles, ...s.rank2Articles].slice(0, 6)
      .map((a) => `   - [R${a.rank}] ${a.title} — ${(a.summary || '').split('\n')[0].replace(/^[•\-*]\s*/, '')}`)
      .join('\n');
    return `Cluster ${i} ("${s.name}"):\n${items}`;
  }).join('\n\n');

  const prompt = `Du bist B2B-Marktanalyst und schreibst die Einordnung für einen kompakten Newsletter ("${headline}").

${list}

Schreibe auf Deutsch, sachlich und knapp. Antworte NUR mit JSON ohne Markdown:
{"executiveSummary":"2-3 Sätze Gesamtüberblick über alle Cluster","insights":{${sections.map((_, i) => `"${i}":"1-2 Sätze Einordnung zu Cluster ${i}"`).join(',')}}}`;

  try {
    const raw = await generateText(prompt, ai.model, ai.variant);
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first === -1 || last <= first) return '';
    const obj = JSON.parse(raw.slice(first, last + 1)) as { executiveSummary?: string; insights?: Record<string, string> };
    if (obj.insights) sections.forEach((s, i) => { s.insight = obj.insights?.[String(i)] ?? ''; });
    return obj.executiveSummary ?? '';
  } catch (err) {
    console.error('[newsletter] AI insights failed:', err instanceof Error ? err.message : err);
    return '';
  }
}

async function getUserAi(userId: string): Promise<{ model: AiModel; variant?: string; email?: string | null }> {
  const [st] = await db.select().from(settings).where(eq(settings.user_id, userId));
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return {
    model: (st?.ai_model as AiModel) ?? 'claude',
    variant: st?.ai_model_variant ?? undefined,
    email: st?.newsletter_email ?? user?.email,
  };
}

/**
 * The combined ("Hybrid") mail: one email with a section per cluster whose
 * delivery='combined', plus an "Übrige Beobachtungen" section for unassigned
 * watches. Clusters set to delivery='separate' are excluded (they ship on their
 * own cadence). Returns null when there is nothing to send.
 */
async function buildCombinedMail(userId: string, ai: { model: AiModel; variant?: string }): Promise<MailData | null> {
  const rows = await loadRows(userId);
  if (rows.length === 0) return null;

  const clusters = await db.select().from(newsletter_clusters)
    .where(eq(newsletter_clusters.user_id, userId))
    .orderBy(asc(newsletter_clusters.sort_order), asc(newsletter_clusters.created_at));

  const separateIds = new Set(clusters.filter((c) => c.delivery === 'separate').map((c) => c.id));
  const combinedRows = rows.filter((r) => !(r.cluster_id && separateIds.has(r.cluster_id)));
  if (combinedRows.length === 0) return null;

  const sections: Section[] = [];
  for (const c of clusters) {
    if (c.delivery === 'separate') continue;
    const cRows = combinedRows.filter((r) => r.cluster_id === c.id);
    if (cRows.length) sections.push(buildSection(c.name, c.color ?? '#3B82F6', cRows));
  }
  const unassigned = combinedRows.filter((r) => !r.cluster_id);
  if (unassigned.length) sections.push(buildSection(UNASSIGNED_NAME, UNASSIGNED_COLOR, unassigned));

  if (sections.length === 0) return null;

  const executiveSummary = await fillInsights('Wochenrückblick', sections, ai)
    || 'Überblick über deine wichtigsten Marktsignale der Woche.';

  return {
    hasContent: true,
    weekLabel: weekLabel(),
    headline: 'Wochenrückblick',
    executiveSummary,
    sections,
    stats: statsFor(combinedRows),
    webViewUrl: config.clientUrl ? `${config.clientUrl}/feed` : '',
  };
}

/** A single separate cluster's focused mail. Returns null when it has no content. */
async function buildClusterMail(userId: string, clusterId: string, ai: { model: AiModel; variant?: string }): Promise<{ mail: MailData; name: string } | null> {
  const [cluster] = await db.select().from(newsletter_clusters)
    .where(and(eq(newsletter_clusters.id, clusterId), eq(newsletter_clusters.user_id, userId)));
  if (!cluster) return null;

  const rows = (await loadRows(userId)).filter((r) => r.cluster_id === clusterId);
  if (rows.length === 0) return null;

  const sections = [buildSection(cluster.name, cluster.color ?? '#3B82F6', rows)];
  const executiveSummary = await fillInsights(cluster.name, sections, ai)
    || `Aktuelle Signale zu „${cluster.name}".`;

  return {
    name: cluster.name,
    mail: {
      hasContent: true,
      weekLabel: weekLabel(),
      headline: cluster.name,
      executiveSummary,
      sections,
      stats: statsFor(rows),
      webViewUrl: config.clientUrl ? `${config.clientUrl}/feed` : '',
    },
  };
}

// ---------- Public API ----------

/** Preview HTML for GET /api/digest/preview — renders the combined mail. */
export async function renderDigestHtml(userId: string): Promise<string> {
  const ai = await getUserAi(userId);
  const mail = await buildCombinedMail(userId, ai);
  return getTemplate()(mail ?? emptyMail());
}

/** Manual "send now" (Settings/Admin) — sends the combined mail immediately. */
export async function sendNewsletter(userId: string): Promise<boolean> {
  const ai = await getUserAi(userId);
  if (!ai.email) { console.warn(`[newsletter] user ${userId}: keine Empfänger-E-Mail`); return false; }
  const mail = await buildCombinedMail(userId, ai);
  if (!mail) { console.log(`[newsletter] user ${userId}: keine Inhalte`); return false; }
  await deliver(ai.email, `Markttrends Scouting – Wochenrückblick (${mail.weekLabel})`, mail);
  await db.update(settings).set({ newsletter_last_sent: new Date(), updated_at: new Date() }).where(eq(settings.user_id, userId));
  return true;
}

/**
 * Scheduler entry: sends everything DUE for this user today.
 * - combined mail: only when today === settings.newsletter_day
 * - separate clusters: cadence='daily' every day, cadence='weekly' on cluster.day
 * Returns the number of mails actually sent.
 */
export async function sendDueNewsletters(userId: string, today: string): Promise<number> {
  const ai = await getUserAi(userId);
  if (!ai.email) return 0;

  const [st] = await db.select().from(settings).where(eq(settings.user_id, userId));
  let sent = 0;

  // Separate cluster mails on their own cadence.
  const clusters = await db.select().from(newsletter_clusters)
    .where(and(eq(newsletter_clusters.user_id, userId), eq(newsletter_clusters.delivery, 'separate')));
  for (const c of clusters) {
    const due = c.cadence === 'daily' || (c.cadence === 'weekly' && c.day === today);
    if (!due) continue;
    const built = await buildClusterMail(userId, c.id, ai);
    if (!built) continue;
    try {
      await deliver(ai.email, `Markttrends Scouting – ${built.name} (${built.mail.weekLabel})`, built.mail);
      sent++;
    } catch (err) {
      console.error(`[newsletter] cluster mail ${c.id} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Combined weekly mail on the user's chosen day.
  if ((st?.newsletter_day ?? 'monday') === today) {
    const mail = await buildCombinedMail(userId, ai);
    if (mail) {
      try {
        await deliver(ai.email, `Markttrends Scouting – Wochenrückblick (${mail.weekLabel})`, mail);
        sent++;
      } catch (err) {
        console.error('[newsletter] combined mail failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  if (sent > 0) await db.update(settings).set({ newsletter_last_sent: new Date(), updated_at: new Date() }).where(eq(settings.user_id, userId));
  return sent;
}

async function deliver(to: string, subject: string, mail: MailData): Promise<void> {
  await getTransporter().sendMail({ from: config.smtpFrom, to, subject, html: getTemplate()(mail) });
}

function emptyMail(): MailData {
  return {
    hasContent: false,
    weekLabel: weekLabel(),
    headline: 'Wochenrückblick',
    executiveSummary: 'Diese Woche keine besonderen Top-Meldungen in deinen Beobachtungen.',
    sections: [],
    stats: { total: 0, rank1: 0, sources: 0 },
    webViewUrl: config.clientUrl ? `${config.clientUrl}/feed` : '',
  };
}

/** Test email (Settings → Verbindung testen). */
export async function sendTestEmail(toEmail: string): Promise<void> {
  await getTransporter().sendMail({
    from: config.smtpFrom,
    to: toEmail,
    subject: 'Markttrends Scouting – Test-E-Mail',
    html: '<p style="font-family:sans-serif">✅ SMTP funktioniert. Dies ist eine Test-E-Mail von Markttrends Scouting.</p>',
  });
}
