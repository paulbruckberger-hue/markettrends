import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { withRetry } from '../../lib/retry';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

// Stand 2026-08: claude-sonnet-4-20250514 wurde abgeschaltet (HTTP 404).
// Aktuelle IDs tragen keinen Datumszusatz mehr.
const DEFAULT_VARIANT = 'claude-sonnet-5';

/**
 * Die Modellkennung wird pro Nutzer gespeichert, nicht pro Anbieter. Beim
 * Wechsel des Anbieters steht dort also noch die Kennung des vorherigen
 * (z.B. "deepseek-v4-flash") — die Anthropic mit 404 ablehnt. Fremde Kennungen
 * werden daher verworfen und der Standard verwendet, wie es Gemini und DeepSeek
 * bereits handhaben.
 */
function resolveModel(variant?: string): string {
  return variant && variant.startsWith('claude') ? variant : DEFAULT_VARIANT;
}

/**
 * Sends the classification prompt to Claude and returns the raw text response.
 * Retries on transient errors (e.g. 429) with exponential backoff.
 */
export async function classifyWithClaude(prompt: string, variant?: string): Promise<string> {
  const anthropic = getClient();
  const model = resolveModel(variant);

  return withRetry(async () => {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return resp.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  }, { label: `claude(${model})`, attempts: 3, baseDelayMs: 1000 });
}

/** Lightweight connectivity test for the Settings page. */
export async function testClaude(variant?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const out = await classifyWithClaude('Antworte nur mit: {"ok":true}', variant);
    return { ok: true, message: out.slice(0, 200) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'unbekannter Fehler' };
  }
}
