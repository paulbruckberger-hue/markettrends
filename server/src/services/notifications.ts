import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, classifications, settings, user_article_state, watch_items } from '../db/schema';
import { InlineKeyboard, sendTelegramMessage, telegramEnabled } from './telegram';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface NotifClassification {
  id: string;
  rank: number;
  title: string;
  summary: string;
  source_url: string;
  source_name: string | null;
  breaking?: boolean;
}

/**
 * Action buttons under each push: request the full briefing, or give relevance
 * feedback that trains the per-keyword AI ranking. `chosen` marks the tapped
 * option with a ✓ when we rebuild the keyboard after a feedback tap.
 * callback_data stays well under Telegram's 64-byte limit (prefix + UUID).
 */
export function buildPushKeyboard(classificationId: string, chosen?: 'up' | 'down'): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: 'ℹ️ Mehr Infos', callback_data: `info:${classificationId}` }],
      [
        { text: chosen === 'up' ? '✅ Relevant' : '👍 Relevant', callback_data: `fb:up:${classificationId}` },
        { text: chosen === 'down' ? '✅ Weniger' : '👎 Weniger relevant', callback_data: `fb:dn:${classificationId}` },
      ],
    ],
  };
}

function buildMessage(c: NotifClassification, watchName: string): string {
  const head = c.breaking ? '⚡ <b>BREAKING</b>' : (c.rank === 1 ? '🔴' : '🟠');
  const first = (c.summary || '').split('\n')[0].replace(/^[•\-*]\s*/, '').trim();
  return [
    `${head} <b>${esc(c.title)}</b>`,
    `<i>${esc(watchName)}${c.breaking ? '' : ` · Rang ${c.rank}`}</i>`,
    first ? esc(first) : '',
    '',
    `<a href="${c.source_url}">→ Quelle${c.source_name ? ` (${esc(c.source_name)})` : ''}</a>`,
  ].filter(Boolean).join('\n');
}

/**
 * Instant Telegram push for a term — ONLY for rare "breaking" items, and only to
 * subscribers who kept breaking alerts on. Everything else (normal rank 1/2) is
 * NOT pushed per-article anymore; it is bundled into the once-daily briefing.
 * telegram_sent dedups against both the breaking push and the daily briefing.
 * Never throws — a failed send is logged and skipped.
 */
export async function fanOutBreaking(searchTermId: string): Promise<number> {
  if (!telegramEnabled()) return 0;

  const cls = await db.select({
    id: classifications.id,
    rank: classifications.rank,
    title: classifications.title,
    summary: classifications.summary,
    source_url: articles.source_url,
    source_name: articles.source_name,
  })
    .from(classifications)
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .where(and(
      eq(classifications.search_term_id, searchTermId),
      eq(classifications.breaking, true),
      gte(classifications.created_at, sql`now() - interval '2 days'`),
    ));
  if (cls.length === 0) return 0;

  const subs = await db.select({ user_id: watch_items.user_id, display_name: watch_items.display_name })
    .from(watch_items)
    .where(and(eq(watch_items.search_term_id, searchTermId), eq(watch_items.is_active, true)));

  let sent = 0;
  for (const sub of subs) {
    const [st] = await db.select().from(settings).where(eq(settings.user_id, sub.user_id));
    if (!st || !st.telegram_connected || !st.telegram_chat_id || !st.breaking_alerts_enabled) continue;

    for (const c of cls) {
      const [state] = await db.select({ telegram_sent: user_article_state.telegram_sent })
        .from(user_article_state)
        .where(and(eq(user_article_state.user_id, sub.user_id), eq(user_article_state.classification_id, c.id)));
      if (state?.telegram_sent) continue;

      try {
        await sendTelegramMessage(st.telegram_chat_id, buildMessage({ ...c, breaking: true }, sub.display_name), buildPushKeyboard(c.id));
        await db.insert(user_article_state).values({
          user_id: sub.user_id,
          classification_id: c.id,
          telegram_sent: true,
          telegram_sent_at: new Date(),
        }).onConflictDoUpdate({
          target: [user_article_state.user_id, user_article_state.classification_id],
          set: { telegram_sent: true, telegram_sent_at: new Date(), updated_at: new Date() },
        });
        sent++;
      } catch (err) {
        console.error('[notify] breaking send failed:', err instanceof Error ? err.message : err);
      }
    }
  }
  if (sent > 0) console.log(`[notify] term ${searchTermId}: ${sent} Breaking-Pushes gesendet`);
  return sent;
}
