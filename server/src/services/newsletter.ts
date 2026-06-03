import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import nodemailer, { Transporter } from 'nodemailer';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, settings, users, watch_items } from '../db/schema';
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

export interface DigestData {
  hasContent: boolean;
  weekLabel: string;
  executiveSummary: string;
  weeklySignal: string;
  rank1Articles: DigestArticle[];
  rank2Articles: DigestArticle[];
  stats: { total: number; rank1: number; sources: number };
  webViewUrl: string;
}

async function collectDigestData(userId: string, aiModel: AiModel, aiVariant?: string): Promise<DigestData> {
  const since = sql`now() - interval '7 days'`;

  const rows = await db.select({
    rank: classifications.rank,
    title: classifications.title,
    summary: classifications.summary,
    source_name: articles.source_name,
    source_type: articles.source_type,
    source_url: articles.source_url,
    published_at: articles.published_at,
    created_at: articles.created_at,
    watch_display_name: watch_items.display_name,
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
    .limit(40);

  const toArticle = (r: typeof rows[number]): DigestArticle => ({
    title: r.title,
    summary: r.summary,
    summaryHtml: summaryToHtml(r.summary),
    source_name: r.source_name || r.source_type,
    source_url: r.source_url,
    watch_display_name: r.watch_display_name,
    published_at: fmtDate(r.published_at ?? r.created_at),
    rank: r.rank,
  });

  const rank1Articles = rows.filter((r) => r.rank === 1).slice(0, 8).map(toArticle);
  const rank2Articles = rows.filter((r) => r.rank === 2).slice(0, 12).map(toArticle);
  const sources = new Set(rows.map((r) => r.source_name || r.source_type)).size;

  let executiveSummary = 'Diese Woche keine besonderen Top-Meldungen in deinen Beobachtungen.';
  let weeklySignal = '';

  if (rows.length > 0) {
    const list = rows.slice(0, 15)
      .map((r, i) => `${i + 1}. [R${r.rank}] ${r.title} — ${(r.summary || '').split('\n')[0].replace(/^[•\-*]\s*/, '')}`)
      .join('\n');
    const prompt = `Du bist B2B-Marktanalyst. Hier die wichtigsten Markttrend-Meldungen der Woche eines Nutzers:\n\n${list}\n\nSchreibe auf Deutsch und antworte NUR mit JSON ohne Markdown:\n{"executiveSummary":"3-4 Sätze Executive Summary der Woche","weeklySignal":"2-3 Sätze zum übergreifenden Markttrend der Woche"}`;
    try {
      const raw = await generateText(prompt, aiModel, aiVariant);
      const first = raw.indexOf('{');
      const last = raw.lastIndexOf('}');
      if (first !== -1 && last > first) {
        const obj = JSON.parse(raw.slice(first, last + 1)) as { executiveSummary?: string; weeklySignal?: string };
        if (obj.executiveSummary) executiveSummary = obj.executiveSummary;
        if (obj.weeklySignal) weeklySignal = obj.weeklySignal;
      }
    } catch (err) {
      console.error('[newsletter] AI summary failed:', err instanceof Error ? err.message : err);
    }
  }

  return {
    hasContent: rows.length > 0,
    weekLabel: weekLabel(),
    executiveSummary,
    weeklySignal,
    rank1Articles,
    rank2Articles,
    stats: { total: rows.length, rank1: rank1Articles.length, sources },
    webViewUrl: config.clientUrl ? `${config.clientUrl}/feed` : '',
  };
}

async function getUserAi(userId: string): Promise<{ model: AiModel; variant?: string; email?: string | null; st: typeof settings.$inferSelect | undefined }> {
  const [st] = await db.select().from(settings).where(eq(settings.user_id, userId));
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return {
    model: (st?.ai_model as AiModel) ?? 'claude',
    variant: st?.ai_model_variant ?? undefined,
    email: st?.newsletter_email ?? user?.email,
    st,
  };
}

/** Render the digest HTML for a user (used by GET /api/digest/preview). */
export async function renderDigestHtml(userId: string): Promise<string> {
  const ai = await getUserAi(userId);
  const data = await collectDigestData(userId, ai.model, ai.variant);
  return getTemplate()(data);
}

/** Build + send the digest to a user. Returns true if an email was sent. */
export async function sendNewsletter(userId: string): Promise<boolean> {
  const ai = await getUserAi(userId);
  if (!ai.email) {
    console.warn(`[newsletter] user ${userId}: keine Empfänger-E-Mail`);
    return false;
  }
  const data = await collectDigestData(userId, ai.model, ai.variant);
  if (!data.hasContent) {
    console.log(`[newsletter] user ${userId}: keine Inhalte, überspringe Versand`);
    return false;
  }
  const html = getTemplate()(data);
  await getTransporter().sendMail({
    from: config.smtpFrom,
    to: ai.email,
    subject: `Markttrends Scouting – Wochenrückblick (${data.weekLabel})`,
    html,
  });
  await db.update(settings).set({ newsletter_last_sent: new Date(), updated_at: new Date() }).where(eq(settings.user_id, userId));
  return true;
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
