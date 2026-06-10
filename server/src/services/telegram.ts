import { config } from '../config';
import { withRetry } from '../lib/retry';

const API = (method: string) => `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;

export function telegramEnabled(): boolean {
  return !!config.telegramBotToken;
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!config.telegramBotToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return withRetry(async () => {
    const resp = await fetch(API(method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? resp.status}`);
    return data.result as T;
  }, { label: `telegram(${method})`, attempts: 3, baseDelayMs: 1000 });
}

/** A Telegram inline keyboard attached under a message. */
export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data?: string; url?: string }[][];
}

/** Send an HTML message. Long messages are truncated to Telegram's 4096 limit. */
export async function sendTelegramMessage(chatId: string, html: string, replyMarkup?: InlineKeyboard): Promise<void> {
  await call('sendMessage', {
    chat_id: chatId,
    text: html.slice(0, 4096),
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

/** Acknowledge a button tap (stops the client spinner; optional toast text). */
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await call('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text: text.slice(0, 200) } : {}),
  });
}

/** Swap the inline keyboard under an already-sent message (e.g. to show a ✓). */
export async function editMessageReplyMarkup(chatId: string, messageId: number, replyMarkup: InlineKeyboard): Promise<void> {
  try {
    await call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });
  } catch (err) {
    // "message is not modified" etc. — non-fatal, the feedback was still saved.
    console.error('[telegram] editMessageReplyMarkup:', err instanceof Error ? err.message : err);
  }
}

export async function getTelegramMe(): Promise<{ username?: string; first_name?: string }> {
  return call('getMe', {});
}

export async function setTelegramWebhook(url: string): Promise<void> {
  await call('setWebhook', { url, secret_token: config.telegramWebhookSecret });
}
