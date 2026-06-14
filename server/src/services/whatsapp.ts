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

// CallMeBot überträgt den Text als GET-Query-Parameter. Lange Briefings (Emojis
// → je ~12 Zeichen URL-kodiert, lange LinkedIn-URLs → ~3×) sprengen die Server-
// URL-Grenze (~2048 Zeichen) und CallMeBot schneidet den Text dann MITTEN im Wort
// ab — genau das Symptom des abgeschnittenen Tagesbriefings. Daher splitten wir
// in mehrere Nachrichten, deren KODIERTE Länge sicher unter der Grenze bleibt.
const MAX_ENCODED_PER_MSG = 1200; // konservativ unter ~2048 inkl. phone+apikey+endpoint
const encLen = (s: string): number => encodeURIComponent(s).length;

/** Text an Zeilengrenzen in Stücke ≤ maxEncoded (URL-kodiert) zerlegen. */
export function chunkForWhatsApp(text: string, maxEncoded = MAX_ENCODED_PER_MSG): string[] {
  const chunks: string[] = [];
  let cur = '';
  const flush = (): void => { if (cur) { chunks.push(cur); cur = ''; } };

  for (const line of text.split('\n')) {
    const candidate = cur ? `${cur}\n${line}` : line;
    if (encLen(candidate) <= maxEncoded) { cur = candidate; continue; }
    // Aktuelles Stück ist voll → abschließen, mit dieser Zeile neu beginnen.
    flush();
    if (encLen(line) <= maxEncoded) { cur = line; continue; }
    // Einzelne überlange Zeile (z.B. eine sehr lange URL) → hart zeichenweise teilen.
    let rest = line;
    while (encLen(rest) > maxEncoded) {
      let lo = 1, hi = rest.length, cut = 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (encLen(rest.slice(0, mid)) <= maxEncoded) { cut = mid; lo = mid + 1; } else hi = mid - 1;
      }
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    cur = rest;
  }
  flush();
  return chunks;
}

/** Ein einzelnes Stück an CallMeBot senden. Wirft bei Fehlern. */
async function sendOneWhatsApp(phone: string, apikey: string, text: string): Promise<void> {
  const url = `${ENDPOINT}?phone=${encodeURIComponent(normalizePhone(phone))}`
    + `&text=${encodeURIComponent(text)}`
    + `&apikey=${encodeURIComponent(apikey)}`;

  return withRetry(async () => {
    const resp = await fetch(url, { method: 'GET' });
    const raw = await resp.text();
    const body = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // CallMeBot liefert IMMER HTTP 200 mit Klartext/HTML, auch bei Fehlern. Die
    // Antwort enthält stets "Message to: … Text to send: …" als Echo; danach
    // entweder Erfolg ("Message queued/sent") oder der Fehlergrund ("APIKey is
    // invalid", "apikey parameter is missing", "not registered" …). Daher NICHT
    // nach Fehlerwörtern raten, sondern Erfolg explizit verlangen.
    const success = /queued|message sent|will receive it/i.test(body);
    if (!resp.ok || !success) {
      throw new Error(`CallMeBot: ${body.slice(0, 220) || resp.status}`);
    }
  }, { label: 'whatsapp(callmebot)', attempts: 2, baseDelayMs: 800 });
}

/**
 * Eine WhatsApp-Nachricht senden. Lange Nachrichten werden automatisch in
 * mehrere Teile gesplittet (CallMeBot-URL-Limit), sequenziell mit kleiner Pause
 * gegen das Free-Tier-Ratelimit. Wirft bei Fehlern (Caller fängt/loggt).
 */
export async function sendWhatsApp(phone: string, apikey: string, text: string): Promise<void> {
  if (!whatsappConfigured(phone, apikey)) throw new Error('WhatsApp (CallMeBot) ist nicht konfiguriert');
  const chunks = chunkForWhatsApp(text.slice(0, 8000)); // harte Obergrenze gegen Ausreißer
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    const body = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n${chunks[i]}` : chunks[i];
    await sendOneWhatsApp(phone, apikey, body);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 1500)); // CallMeBot-Ratelimit
  }
}
