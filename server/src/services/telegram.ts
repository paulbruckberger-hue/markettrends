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

/** Send an HTML message. Long messages are truncated to Telegram's 4096 limit. */
export async function sendTelegramMessage(chatId: string, html: string): Promise<void> {
  await call('sendMessage', {
    chat_id: chatId,
    text: html.slice(0, 4096),
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });
}

export async function getTelegramMe(): Promise<{ username?: string; first_name?: string }> {
  return call('getMe', {});
}

export async function setTelegramWebhook(url: string): Promise<void> {
  await call('setWebhook', { url, secret_token: config.telegramWebhookSecret });
}
