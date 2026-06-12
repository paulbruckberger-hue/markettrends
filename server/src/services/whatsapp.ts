import { withRetry } from '../lib/retry';

/**
 * WhatsApp-Versand über CallMeBot — kostenloser Dienst für persönliche
 * Benachrichtigungen an eine eigene (vorher freigeschaltete) Nummer.
 * Einrichtung pro Empfänger: einmalig die CallMeBot-Nummer in WhatsApp
 * anschreiben ("I allow callmebot to send me messages"), Antwort enthält den
 * persönlichen apikey. Danach genügt ein simpler GET-Request.
 *
 * Bewusste Grenzen von CallMeBot (Grund für "kostenlos jetzt"):
 *  - Keine interaktiven Buttons (👍/👎/Mehr-Infos bleiben Telegram-exklusiv).
 *  - Nur an Nummern, die sich freigeschaltet haben (kein Massen-/Kundenversand).
 * Für echten Kundenversand später: dieselbe sendWhatsApp-Signatur auf die
 * offizielle WhatsApp-Cloud-API umstellen — nur diese Datei ist betroffen.
 *
 * WhatsApp-Formatierung: *fett*, _kursiv_, ~durchgestrichen~, Links als nackte
 * URL (werden automatisch klickbar). Daher wandelt htmlToWhatsApp das für
 * Telegram gebaute HTML in WhatsApp-Markdown um.
 */

const ENDPOINT = 'https://api.callmebot.com/whatsapp.php';

/** WhatsApp ist pro User konfiguriert — kein serverweiter Key nötig. */
export function whatsappConfigured(phone?: string | null, apikey?: string | null): boolean {
  return !!(phone && apikey);
}

/** Telefonnummer normalisieren: nur Ziffern (CallMeBot akzeptiert mit/ohne +). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Telegram-HTML → WhatsApp-Text.
 *  <b>/<strong> → *fett*, <i>/<em> → _kursiv_,
 *  <a href="URL">LABEL</a> → "LABEL: URL" (URL wird in WhatsApp klickbar),
 *  übrige Tags entfernt, HTML-Entities zurückübersetzt.
 */
export function htmlToWhatsApp(html: string): string {
  let t = html;
  t = t.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gis, (_m, url: string, label: string) => {
    const clean = label.replace(/<[^>]+>/g, '').trim();
    return clean ? `${clean}: ${url}` : url;
  });
  t = t.replace(/<\/?(?:b|strong)>/gi, '*');
  t = t.replace(/<\/?(?:i|em)>/gi, '_');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return t.trim();
}

/** Eine WhatsApp-Nachricht senden. Wirft bei Fehlern (Caller fängt/loggt). */
export async function sendWhatsApp(phone: string, apikey: string, text: string): Promise<void> {
  if (!whatsappConfigured(phone, apikey)) throw new Error('WhatsApp (CallMeBot) ist nicht konfiguriert');
  const url = `${ENDPOINT}?phone=${encodeURIComponent(normalizePhone(phone))}`
    + `&text=${encodeURIComponent(text.slice(0, 3500))}`
    + `&apikey=${encodeURIComponent(apikey)}`;

  return withRetry(async () => {
    const resp = await fetch(url, { method: 'GET' });
    const body = await resp.text();
    // CallMeBot antwortet mit HTTP 200 + Klartext/HTML. Erfolg = "Message queued"
    // bzw. "Message Sent". Fehler (falscher Key, Nummer nicht freigeschaltet)
    // kommen als 203/HTML mit "ERROR"/"APIKEY".
    if (!resp.ok || /error|apikey is incorrect|not.*registered|you need to/i.test(body)) {
      throw new Error(`CallMeBot: ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || resp.status}`);
    }
  }, { label: 'whatsapp(callmebot)', attempts: 3, baseDelayMs: 1000 });
}
