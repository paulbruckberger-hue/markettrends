import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, settings, user_article_state, watch_items } from '../db/schema';
import { config } from '../config';
import { generateText } from './ai/classifier';
import { getActiveAiConfig } from './personalize';
import { pushConnected, sendPush } from './push';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Candidate {
  article_id: string;
  cls_ids: string[];        // every classification of this article (mark all sent)
  rank: number;             // best effective rank across keywords
  title: string;
  firstLine: string;
  source_url: string;
  source_name: string;
  keywords: string[];       // de-duplicated keyword names this article matched
}

/** Last-24h rank 1/2 candidates for a user, de-duplicated to one entry per article. */
async function loadCandidates(userId: string): Promise<Candidate[]> {
  const rows = await db.select({
    cls_id: classifications.id,
    article_id: classifications.article_id,
    base_rank: classifications.rank,
    personal_rank: user_article_state.personal_rank,
    override: user_article_state.user_rank_override,
    sent: user_article_state.telegram_sent,
    title: classifications.title,
    summary: classifications.summary,
    created_at: classifications.created_at,
    source_url: articles.source_url,
    source_name: articles.source_name,
    source_type: articles.source_type,
    watch_display_name: watch_items.display_name,
  })
    .from(watch_items)
    .innerJoin(classifications, eq(classifications.search_term_id, watch_items.search_term_id))
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .leftJoin(user_article_state, and(
      eq(user_article_state.classification_id, classifications.id),
      eq(user_article_state.user_id, userId),
    ))
    .where(and(
      eq(watch_items.user_id, userId),
      eq(watch_items.is_active, true),
      gte(classifications.created_at, sql`now() - interval '24 hours'`),
    ))
    .orderBy(desc(classifications.created_at));

  const byArticle = new Map<string, Candidate & { _ts: number }>();
  for (const r of rows) {
    const eff = r.override ?? r.personal_rank ?? r.base_rank;
    if (eff !== 1 && eff !== 2) continue;     // only rank 1/2 reach the briefing
    if (r.sent) continue;                      // already pushed (breaking) or briefed
    const existing = byArticle.get(r.article_id);
    if (existing) {
      existing.cls_ids.push(r.cls_id);
      if (eff < existing.rank) existing.rank = eff;
      if (!existing.keywords.includes(r.watch_display_name)) existing.keywords.push(r.watch_display_name);
      continue;
    }
    byArticle.set(r.article_id, {
      article_id: r.article_id,
      cls_ids: [r.cls_id],
      rank: eff,
      title: r.title,
      firstLine: (r.summary || '').split('\n')[0].replace(/^[•\-*]\s*/, '').trim(),
      source_url: r.source_url,
      source_name: r.source_name || r.source_type,
      keywords: [r.watch_display_name],
      _ts: r.created_at ? new Date(r.created_at).getTime() : 0,
    });
  }
  return [...byArticle.values()]
    .sort((a, b) => (a.rank - b.rank) || (b._ts - a._ts))
    .slice(0, 25)
    .map(({ _ts, ...c }) => c);
}

/**
 * Editorial second pass: pick the few items that truly stand out across ALL the
 * user's keywords. Adaptive 0–5 — fewer (or none) on a quiet day. Returns the
 * chosen candidate indices + a one-line "Lage heute". Falls back to the top
 * rank-1 items if the model is unavailable, so a busy day never goes silent.
 */
async function editorialSelect(cands: Candidate[]): Promise<{ lage: string; picks: number[] }> {
  const fallback = (): { lage: string; picks: number[] } => ({
    lage: '',
    picks: cands.map((c, i) => ({ i, r: c.rank })).filter((x) => x.r === 1).slice(0, 5).map((x) => x.i),
  });
  if (cands.length === 0) return { lage: '', picks: [] };

  const list = cands.map((c, i) => `${i}. [R${c.rank}] ${c.title} — ${c.firstLine} (${c.keywords.join(', ')})`).join('\n');
  const ai = await getActiveAiConfig();
  const prompt = `Du bist Chefredakteur und stellst das knappe Tages-Briefing eines vielbeschäftigten Entscheiders zusammen.
Wähle aus den folgenden Kandidaten NUR die wirklich wichtigsten heute — über alle Themen hinweg.

Regeln:
- HÖCHSTENS 5, eher weniger. Qualität vor Vollständigkeit.
- Nur was heute wirklich heraussticht. Ist nichts wirklich bedeutend, gib eine leere Liste zurück.
- Reihenfolge nach Wichtigkeit (wichtigstes zuerst).
- Schreibe einen einzigen kurzen Satz "Lage heute" (Gesamtbild). Wenn leer, dann "".

Kandidaten:
${list}

Antworte NUR mit JSON: {"lage":"...","picks":[<index>, ...]}`;

  try {
    const raw = await generateText(prompt, ai.model, ai.variant);
    const first = raw.indexOf('{'); const last = raw.lastIndexOf('}');
    if (first === -1 || last <= first) return fallback();
    const obj = JSON.parse(raw.slice(first, last + 1)) as { lage?: string; picks?: number[] };
    const picks = Array.isArray(obj.picks)
      ? obj.picks.filter((n) => Number.isInteger(n) && n >= 0 && n < cands.length).slice(0, 5)
      : [];
    return { lage: typeof obj.lage === 'string' ? obj.lage.trim() : '', picks };
  } catch (err) {
    console.error('[daily] editorial select failed:', err instanceof Error ? err.message : err);
    return fallback();
  }
}

function buildMessage(date: string, lage: string, items: Candidate[]): string {
  const lines: string[] = [`🗞 <b>Dein Tagesbriefing</b> · ${date}`];
  if (lage) lines.push(`<i>${esc(lage)}</i>`);
  lines.push('');
  items.forEach((c, i) => {
    const dot = c.rank === 1 ? '🔴' : '🟠';
    const kw = c.keywords.length > 1 ? `${esc(c.keywords[0])} +${c.keywords.length - 1}` : esc(c.keywords[0]);
    lines.push(`${i + 1}. ${dot} <b>${esc(c.title)}</b>`);
    if (c.firstLine) lines.push(`<i>${kw}</i> — ${esc(c.firstLine)}`);
    else lines.push(`<i>${kw}</i>`);
    lines.push(`<a href="${c.source_url}">→ Quelle${c.source_name ? ` (${esc(c.source_name)})` : ''}</a>`);
    lines.push('');
  });
  return lines.join('\n').slice(0, 4096);
}

/**
 * Build + send one user's daily briefing. Returns the number of items sent (0 if
 * nothing cleared the bar — a quiet day stays silent). Marks every included
 * article's classifications telegram_sent so nothing repeats tomorrow.
 */
export async function sendDailyBriefing(userId: string): Promise<number> {
  const [st] = await db.select().from(settings).where(eq(settings.user_id, userId));
  if (!st || !pushConnected(st)) return 0;

  const cands = await loadCandidates(userId);
  if (cands.length === 0) {
    await db.update(settings).set({ daily_push_last_sent: new Date(), updated_at: new Date() }).where(eq(settings.user_id, userId));
    return 0;
  }

  const { lage, picks } = await editorialSelect(cands);
  const chosen = picks.map((i) => cands[i]);

  if (chosen.length > 0) {
    const date = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
    // Only attach the deep-link button for a real public URL — Telegram rejects
    // localhost, and a bad button URL would otherwise fail the whole message.
    const keyboard = /^https:\/\//.test(config.clientUrl)
      ? { inline_keyboard: [[{ text: '📲 Alle Meldungen im Feed', url: `${config.clientUrl}/feed` }]] }
      : undefined;
    await sendPush(st, buildMessage(date, lage, chosen), keyboard);

    const clsIds = chosen.flatMap((c) => c.cls_ids);
    for (let i = 0; i < clsIds.length; i += 50) {
      const slice = clsIds.slice(i, i + 50);
      // Mark each as briefed (telegram_sent) so it never repeats.
      for (const id of slice) {
        await db.insert(user_article_state).values({ user_id: userId, classification_id: id, telegram_sent: true, telegram_sent_at: new Date() })
          .onConflictDoUpdate({ target: [user_article_state.user_id, user_article_state.classification_id], set: { telegram_sent: true, telegram_sent_at: new Date(), updated_at: new Date() } });
      }
    }
  }

  await db.update(settings).set({ daily_push_last_sent: new Date(), updated_at: new Date() }).where(eq(settings.user_id, userId));
  if (chosen.length > 0) console.log(`[daily] user ${userId}: Tagesbriefing mit ${chosen.length} Meldungen gesendet`);
  return chosen.length;
}
