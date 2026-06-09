import { AiModel, generateText } from './ai/classifier';
import { WatchType } from '../types';

export interface QueryAlias {
  lang: string;  // 'de' | 'en' | 'fr' | 'es' | 'it'
  q: string;
}

export const ALIAS_LANGS = ['de', 'en', 'fr', 'es', 'it'] as const;

/**
 * Ask the AI for the best search phrase per language so the collector can search
 * one topic across multiple language editions ("Tagesgeld" → "savings account"
 * → "compte d'épargne" …). Company/brand names are kept unchanged across
 * languages. Returns [] on any failure (caller falls back to the original term).
 */
export async function generateAliases(
  query: string,
  type: WatchType,
  model: AiModel,
  variant?: string,
): Promise<QueryAlias[]> {
  const kind = type === 'company' ? 'company, brand or product name' : 'topic / concept';
  const prompt = `You are a multilingual search assistant for a news monitoring tool.
Given this ${kind}: "${query}"

Return the best concise search phrase to find news about it in each language:
German (de), English (en), French (fr), Spanish (es), Italian (it).

Rules:
- If it is a company, brand, product or other proper name, KEEP IT UNCHANGED in every language. Do not translate names.
- If it is a topic or concept, give the most natural term a journalist would actually use in that language (the common term — not a literal word-by-word translation).
- One short phrase per language. No explanations, no quotes around the phrase.

Respond with ONLY a JSON array, no markdown:
[{"lang":"de","q":"..."},{"lang":"en","q":"..."},{"lang":"fr","q":"..."},{"lang":"es","q":"..."},{"lang":"it","q":"..."}]`;

  let raw: string;
  try {
    raw = await generateText(prompt, model, variant);
  } catch {
    return [];
  }

  const first = raw.indexOf('[');
  const last = raw.lastIndexOf(']');
  if (first === -1 || last <= first) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const out: QueryAlias[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const lang = String((item as Record<string, unknown>).lang ?? '').toLowerCase().slice(0, 2);
    const q = String((item as Record<string, unknown>).q ?? '').trim().replace(/\s+/g, ' ');
    if (!(ALIAS_LANGS as readonly string[]).includes(lang)) continue;
    if (!q || q.length > 80 || seen.has(lang)) continue;
    seen.add(lang);
    out.push({ lang, q });
    if (out.length >= ALIAS_LANGS.length) break;
  }
  return out;
}
