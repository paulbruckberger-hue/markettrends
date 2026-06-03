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

const DEFAULT_VARIANT = 'claude-sonnet-4-20250514';

/**
 * Sends the classification prompt to Claude and returns the raw text response.
 * Retries on transient errors (e.g. 429) with exponential backoff.
 */
export async function classifyWithClaude(prompt: string, variant?: string): Promise<string> {
  const anthropic = getClient();
  const model = variant || DEFAULT_VARIANT;

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
