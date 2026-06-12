import { settings } from '../db/schema';
import { InlineKeyboard, sendTelegramMessage, telegramEnabled } from './telegram';
import { htmlToWhatsApp, sendWhatsApp, whatsappConfigured } from './whatsapp';

/**
 * Kanal-Abstraktion über die User-Benachrichtigungen. Jeder User wählt in den
 * Settings push_channel = 'telegram' | 'whatsapp'. Caller (Tagesbriefing,
 * Breaking-Alerts, Tests) bauen weiterhin EIN HTML — sendPush leitet es an den
 * gewählten Kanal weiter und übersetzt es für WhatsApp.
 */

export type PushChannel = 'telegram' | 'whatsapp';
type Settings = typeof settings.$inferSelect;

export function pushChannel(st: Pick<Settings, 'push_channel'>): PushChannel {
  return st.push_channel === 'whatsapp' ? 'whatsapp' : 'telegram';
}

/** Felder, die zum Prüfen der Kanal-Verbindung nötig sind (volle Settings ⊇ davon). */
export type PushConnInfo = Pick<Settings,
  'push_channel' | 'telegram_connected' | 'telegram_chat_id'
  | 'whatsapp_connected' | 'whatsapp_phone' | 'whatsapp_apikey'>;

/** Ist der vom User gewählte Kanal einsatzbereit (verbunden + global verfügbar)? */
export function pushConnected(st: PushConnInfo): boolean {
  if (pushChannel(st) === 'whatsapp') {
    return st.whatsapp_connected && whatsappConfigured(st.whatsapp_phone, st.whatsapp_apikey);
  }
  return !!(telegramEnabled() && st.telegram_connected && st.telegram_chat_id);
}

/**
 * Eine Push-Nachricht an den gewählten Kanal senden.
 *  - Telegram: HTML + optionale Inline-Buttons (Feedback etc.).
 *  - WhatsApp: HTML → WhatsApp-Text; Callback-Buttons entfallen, reine URL-
 *    Buttons (z.B. "Alle Meldungen im Feed") werden als Link-Zeilen angehängt.
 * Wirft bei Fehlern — Caller fängt/loggt wie bisher.
 */
export async function sendPush(st: Settings, html: string, keyboard?: InlineKeyboard): Promise<void> {
  if (pushChannel(st) === 'whatsapp') {
    let text = htmlToWhatsApp(html);
    const links = (keyboard?.inline_keyboard ?? [])
      .flat()
      .filter((b) => b.url)
      .map((b) => `${b.text.replace(/[^\p{L}\p{N}\s.,:!?()/-]/gu, '').trim()}: ${b.url}`);
    if (links.length) text += `\n\n${links.join('\n')}`;
    await sendWhatsApp(st.whatsapp_phone!, st.whatsapp_apikey!, text);
    return;
  }
  await sendTelegramMessage(st.telegram_chat_id!, html, keyboard);
}
