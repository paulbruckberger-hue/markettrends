import { config } from '../../config';
import { withRetry } from '../../lib/retry';

const DEFAULT_VARIANT = 'deepseek-chat';

function resolveModel(variant?: string): string {
  return variant && variant.startsWith('deepseek') ? variant : DEFAULT_VARIANT;
}

interface DeepseekResponse {
  choices?: { message?: { content?: string } }[];
}

/** Calls DeepSeek (OpenAI-compatible REST) and returns the raw text response. */
export async function classifyWithDeepseek(prompt: string, variant?: string): Promise<string> {
  if (!config.deepseekApiKey) throw new Error('DEEPSEEK_API_KEY is not configured');
  const model = resolveModel(variant);

  return withRetry(async () => {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.2,
        stream: false,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`DeepSeek ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as DeepseekResponse;
    return (data.choices?.[0]?.message?.content ?? '').trim();
  }, { label: `deepseek(${model})`, attempts: 3, baseDelayMs: 1000 });
}

export async function testDeepseek(variant?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const out = await classifyWithDeepseek('Antworte nur mit: {"ok":true}', variant);
    return { ok: true, message: out.slice(0, 200) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'unbekannter Fehler' };
  }
}
