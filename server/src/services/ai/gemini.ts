import { config } from '../../config';
import { withRetry } from '../../lib/retry';

const DEFAULT_VARIANT = 'gemini-2.5-flash';

function resolveModel(variant?: string): string {
  return variant && variant.startsWith('gemini') ? variant : DEFAULT_VARIANT;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Calls Google Gemini (REST) and returns the raw text response.
 * Auth via the x-goog-api-key header (more robust across key types than ?key=).
 */
export async function classifyWithGemini(prompt: string, variant?: string): Promise<string> {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
  const model = resolveModel(variant);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  return withRetry(async () => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as GeminiResponse;
    return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  }, { label: `gemini(${model})`, attempts: 3, baseDelayMs: 1000 });
}

export async function testGemini(variant?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const out = await classifyWithGemini('Antworte nur mit: {"ok":true}', variant);
    return { ok: true, message: out.slice(0, 200) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'unbekannter Fehler' };
  }
}
