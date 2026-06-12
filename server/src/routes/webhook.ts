import { Router, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/client';
import { articles, classifications, settings, user_article_state, users, watch_items } from '../db/schema';
import {
  answerCallback, editMessageReplyMarkup, sendTelegramMessage,
} from '../services/telegram';
import { buildPushKeyboard } from '../services/notifications';
import { repersonalizeUserTerm } from '../services/personalize';
import { handleBotMessage } from '../services/botRegistration';

export const webhookRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'positiv 🟢', negative: 'negativ 🔴', neutral: 'neutral ⚪',
};

// POST /webhook/telegram  (public, secret-verifiziert)
webhookRouter.post('/telegram', async (req: Request, res: Response) => {
  const secret = req.header('x-telegram-bot-api-secret-token');
  if (config.telegramWebhookSecret && secret !== config.telegramWebhookSecret) {
    res.sendStatus(401);
    return;
  }
  // Process THEN acknowledge: on Cloud Run CPU is only allocated during the
  // request, so the immediate-learning re-rank must finish before we respond
  // (a button tap already got a fast answerCallback toast meanwhile). Bounded,
  // so we stay well within Telegram's webhook timeout.
  try {
    if (req.body?.callback_query) {
      await handleCallback(req.body.callback_query);
    } else {
      await handleMessage(req.body?.message);
    }
  } catch (err) {
    console.error('[webhook] telegram error:', err instanceof Error ? err.message : err);
  } finally {
    res.sendStatus(200);
  }
});

/**
 * Eingehende Telegram-Nachricht. Zwei Fälle:
 *  1) `/start <userId>` mit gültiger User-UUID → bestehendes Konto mit dem Chat
 *     verknüpfen (App-Button „Mit Telegram verbinden").
 *  2) Sonst → kanal-offene Registrierung/Konversation: ein Konto entsteht direkt
 *     im Chat (services/botRegistration), inkl. passwortlosem Web-Login-Link.
 */
async function handleMessage(msg: any): Promise<void> {
  const text: string = msg?.text ?? '';
  const chatId = msg?.chat?.id;
  if (!chatId) return;
  const chat = String(chatId);

  const payload = text.startsWith('/start') ? text.split(/\s+/)[1]?.trim() : undefined;
  if (payload && UUID_RE.test(payload)) {
    const [user] = await db.select().from(users).where(eq(users.id, payload));
    if (user) {
      await db.insert(settings).values({
        user_id: user.id,
        telegram_chat_id: chat,
        telegram_connected: true,
      }).onConflictDoUpdate({
        target: settings.user_id,
        set: { telegram_chat_id: chat, telegram_connected: true, updated_at: new Date() },
      });
      await sendTelegramMessage(chat, '✅ <b>Verbunden!</b> Du erhältst ab jetzt Push-Benachrichtigungen für wichtige Markttrends.');
      return;
    }
  }

  await handleBotMessage({
    channel: 'telegram',
    chatId: chat,
    text,
    profile: {
      firstName: msg?.from?.first_name,
      telegramUserId: msg?.from?.id != null ? String(msg.from.id) : undefined,
    },
    reply: (html) => sendTelegramMessage(chat, html),
  });
}

/** Inline-button taps: "Mehr Infos" + 👍/👎 relevance feedback. */
async function handleCallback(cb: any): Promise<void> {
  const chatId = cb?.message?.chat?.id;
  const messageId = cb?.message?.message_id;
  const data: string = cb?.data ?? '';
  if (!chatId || !cb?.id) return;

  const userId = await findUserByChat(String(chatId));
  if (!userId) {
    await answerCallback(cb.id, 'Bitte zuerst in der App mit Telegram verbinden.');
    return;
  }

  if (data.startsWith('info:')) {
    await sendMoreInfo(String(chatId), userId, data.slice('info:'.length));
    await answerCallback(cb.id);
    return;
  }

  if (data.startsWith('fb:')) {
    const dir = data.slice(3, 5);                 // 'up' | 'dn'
    const classificationId = data.slice('fb:xx:'.length);
    const feedback: 'up' | 'down' = dir === 'dn' ? 'down' : 'up';
    const termId = await saveFeedback(userId, classificationId, feedback);
    // Fast toast first (stops the button spinner), keyboard ✓, THEN learn.
    await answerCallback(
      cb.id,
      !termId ? 'Meldung nicht mehr verfügbar.'
        : feedback === 'up' ? '👍 Danke! Die KI lernt sofort mit.'
          : '👎 Danke! Solche Meldungen ranken wir für dich sofort niedriger.',
    );
    if (termId && messageId) {
      await editMessageReplyMarkup(String(chatId), messageId, buildPushKeyboard(classificationId, feedback));
    }
    // Immediate, automatic learning — same path as the in-app feedback.
    if (termId) {
      try {
        await repersonalizeUserTerm(userId, termId);
      } catch (err) {
        console.error('[webhook] repersonalize failed:', err instanceof Error ? err.message : err);
      }
    }
    return;
  }

  await answerCallback(cb.id);
}

async function findUserByChat(chatId: string): Promise<string | null> {
  const [st] = await db.select({ user_id: settings.user_id })
    .from(settings)
    .where(eq(settings.telegram_chat_id, chatId));
  return st?.user_id ?? null;
}

/**
 * Persist a relevance vote on the same `user_article_state.user_feedback` column
 * the in-app 👍/👎 uses (one unified feedback state across all channels). Returns
 * the classification's search_term_id (for immediate re-ranking) or null if the
 * user does not subscribe to the term.
 */
async function saveFeedback(userId: string, classificationId: string, feedback: 'up' | 'down'): Promise<string | null> {
  const [allowed] = await db.select({ search_term_id: classifications.search_term_id })
    .from(classifications)
    .innerJoin(watch_items, eq(watch_items.search_term_id, classifications.search_term_id))
    .where(and(eq(classifications.id, classificationId), eq(watch_items.user_id, userId)))
    .limit(1);
  if (!allowed) return null;

  await db.insert(user_article_state).values({
    user_id: userId,
    classification_id: classificationId,
    user_feedback: feedback,
  }).onConflictDoUpdate({
    target: [user_article_state.user_id, user_article_state.classification_id],
    set: { user_feedback: feedback, updated_at: new Date() },
  });
  return allowed.search_term_id;
}

/** Send the full briefing for one classification (all bullets + context + tags). */
async function sendMoreInfo(chatId: string, userId: string, classificationId: string): Promise<void> {
  const [row] = await db.select({
    title: classifications.title,
    summary: classifications.summary,
    rank_reason: classifications.rank_reason,
    sentiment: classifications.sentiment,
    signal_type: classifications.signal_type,
    tags: classifications.tags,
    source_url: articles.source_url,
    source_name: articles.source_name,
    full_text: articles.full_text,
    raw_excerpt: articles.raw_excerpt,
  })
    .from(classifications)
    .innerJoin(articles, eq(articles.id, classifications.article_id))
    .innerJoin(watch_items, eq(watch_items.search_term_id, classifications.search_term_id))
    .where(and(eq(classifications.id, classificationId), eq(watch_items.user_id, userId)))
    .limit(1);

  if (!row) {
    await sendTelegramMessage(chatId, 'Diese Meldung ist nicht mehr verfügbar.');
    return;
  }

  const bullets = (row.summary || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => '• ' + esc(l.replace(/^[•\-*]\s*/, ''))).join('\n');
  const body = (row.full_text || row.raw_excerpt || '').trim();
  const snippet = body ? esc(body.slice(0, 600)) + (body.length > 600 ? '…' : '') : '';
  const tags = Array.isArray(row.tags) && row.tags.length
    ? row.tags.map((t) => '#' + esc(String(t).replace(/\s+/g, ''))).join(' ') : '';
  const meta = [
    row.sentiment ? `Stimmung: ${SENTIMENT_LABEL[row.sentiment] ?? esc(row.sentiment)}` : '',
    row.signal_type ? `Signal: ${esc(row.signal_type)}` : '',
  ].filter(Boolean).join(' · ');

  const parts = [
    `📋 <b>${esc(row.title)}</b>`,
    bullets,
    row.rank_reason ? `<i>${esc(row.rank_reason)}</i>` : '',
    snippet ? `\n${snippet}` : '',
    meta,
    tags,
    `\n<a href="${row.source_url}">→ Zur Quelle${row.source_name ? ` (${esc(row.source_name)})` : ''}</a>`,
    config.clientUrl ? `<a href="${config.clientUrl}/feed">→ In der App öffnen</a>` : '',
  ].filter(Boolean).join('\n');

  await sendTelegramMessage(chatId, parts);
}
