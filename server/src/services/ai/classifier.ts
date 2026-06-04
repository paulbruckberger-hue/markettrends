import { classifyWithClaude } from './claude';
import { classifyWithGemini } from './gemini';
import { classifyWithDeepseek } from './deepseek';

export type AiModel = 'claude' | 'gemini' | 'deepseek';

export const SIGNAL_TYPES = [
  'product_launch', 'expansion', 'partnership', 'personnel',
  'funding', 'regulatory', 'earnings', 'general',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export interface ClassificationInput {
  content: string;          // original_title + raw_excerpt
  searchQuery: string;
  watchType: 'topic' | 'company';
  sourceType: string;
  language?: string;        // 'de' (default) | 'en'
}

export interface ClassificationResult {
  rank: 1 | 2 | 3;
  rank_reason: string;
  title: string;            // Executive Headline (Deutsch)
  summary: string;          // "• …\n• …\n• …"
  sentiment: 'positive' | 'negative' | 'neutral';
  tags: string[];           // max 3
  signal_type?: SignalType; // nur bei watchType='company'
}

// ---------- Prompts ----------

function langInstruction(lang = 'de'): { base: string; headline: string; reason: string; tag: string } {
  if (lang === 'en') return {
    base: 'You are an experienced B2B market analyst. Assess how relevant a piece of content is for an observed term and summarise it for an executive. Answer EXCLUSIVELY in English.',
    headline: 'concise Executive Headline in English',
    reason: 'short justification (1 sentence, English)',
    tag: 'max three keywords in English',
  };
  return {
    base: 'Du bist ein erfahrener B2B-Marktanalyst. Du bewertest, wie relevant ein Inhalt für einen Beobachtungsbegriff ist, und fasst ihn für eine Führungskraft zusammen. Antworte AUSSCHLIESSLICH auf Deutsch.',
    headline: 'prägnante Executive-Headline auf Deutsch',
    reason: 'kurze Begründung (1 Satz, Deutsch)',
    tag: 'max drei Schlagworte auf Deutsch',
  };
}

function rankRules(lang = 'de'): string {
  if (lang === 'en') return `RANK (importance/relevance):
- 1 = highly relevant: significant market signal, directly related, actionable.
- 2 = relevant: clear connection, worth watching, not urgent.
- 3 = marginal: weak/indirect connection or generic news.

RESPONSE FORMAT: Reply with ONE JSON object only, no Markdown code fences, no text before or after.`;
  return `RANK (Wichtigkeit/Relevanz):
- 1 = hochrelevant: bedeutendes Marktsignal, direkt zum Begriff, handlungsrelevant.
- 2 = relevant: klarer Bezug, beobachtenswert, aber nicht dringend.
- 3 = am Rande: schwacher/indirekter Bezug oder generische Nachricht.

ANTWORTFORMAT: Antworte ausschließlich mit EINEM JSON-Objekt, ohne Markdown-Codeblöcke, ohne Erklärtext davor oder danach.`;
}

const TOPIC_PROMPT = (input: ClassificationInput) => {
  const lang = input.language || 'de';
  const l = langInstruction(lang);
  const watched = lang === 'en' ? 'Observed topic' : 'Beobachtetes Thema';
  const source = lang === 'en' ? 'Source' : 'Quelle';
  const content = lang === 'en' ? 'Content' : 'Inhalt';
  return `${l.base}

${rankRules(lang)}

${watched}: "${input.searchQuery}"
${source}: ${input.sourceType}

${content}:
"""
${input.content.slice(0, 4000)}
"""

${lang === 'en' ? 'Return JSON in exactly this form' : 'Gib JSON in genau dieser Form zurück'}:
{
  "rank": 1,
  "rank_reason": "${l.reason}",
  "title": "${l.headline}",
  "summary": "• first point\\n• second point\\n• third point",
  "sentiment": "positive | negative | neutral",
  "tags": ["${l.tag}"]
}`;
};

const COMPANY_PROMPT = (input: ClassificationInput) => {
  const lang = input.language || 'de';
  const l = langInstruction(lang);
  const watched = lang === 'en' ? 'Observed company' : 'Beobachtetes Unternehmen';
  const source = lang === 'en' ? 'Source' : 'Quelle';
  const content = lang === 'en' ? 'Content' : 'Inhalt';
  const signalNote = lang === 'en'
    ? 'Also determine the signal_type from this list: product_launch, expansion, partnership, personnel, funding, regulatory, earnings, general.'
    : 'Bestimme zusätzlich den Signal-Typ (signal_type) aus dieser Liste: product_launch, expansion, partnership, personnel, funding, regulatory, earnings, general.';
  return `${l.base}

${rankRules(lang)}

${watched}: "${input.searchQuery}"
${source}: ${input.sourceType}

${signalNote}

${content}:
"""
${input.content.slice(0, 4000)}
"""

${lang === 'en' ? 'Return JSON in exactly this form' : 'Gib JSON in genau dieser Form zurück'}:
{
  "rank": 1,
  "rank_reason": "${l.reason}",
  "title": "${l.headline}",
  "summary": "• first point\\n• second point\\n• third point",
  "sentiment": "positive | negative | neutral",
  "tags": ["${l.tag}"],
  "signal_type": "partnership"
}`;
};;

export function buildPrompt(input: ClassificationInput): string {
  return input.watchType === 'company' ? COMPANY_PROMPT(input) : TOPIC_PROMPT(input);
}

// ---------- Robust parsing (never throws) ----------

function coerceRank(v: unknown): 1 | 2 | 3 {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return n === 1 || n === 2 ? n : 3;
}

function coerceSentiment(v: unknown): ClassificationResult['sentiment'] {
  return v === 'positive' || v === 'negative' ? v : 'neutral';
}

function coerceTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

function coerceSignal(v: unknown): SignalType | undefined {
  return SIGNAL_TYPES.includes(v as SignalType) ? (v as SignalType) : undefined;
}

export function parseClassificationJson(raw: string, input: ClassificationInput): ClassificationResult {
  const fallbackTitle = (input.content.split('\n')[0] || input.searchQuery).slice(0, 140);
  const fallback: ClassificationResult = {
    rank: 3,
    rank_reason: 'Automatische Einstufung (Antwort nicht eindeutig auswertbar).',
    title: fallbackTitle,
    summary: '• Inhalt konnte nicht automatisch zusammengefasst werden.',
    sentiment: 'neutral',
    tags: [],
    ...(input.watchType === 'company' ? { signal_type: 'general' as SignalType } : {}),
  };

  if (!raw || !raw.trim()) return fallback;

  // Strip code fences and isolate the JSON object.
  let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return fallback;
  text = text.slice(first, last + 1);

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const result: ClassificationResult = {
      rank: coerceRank(obj.rank),
      rank_reason: typeof obj.rank_reason === 'string' ? obj.rank_reason : fallback.rank_reason,
      title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : fallbackTitle,
      summary: typeof obj.summary === 'string' && obj.summary.trim() ? obj.summary.trim() : fallback.summary,
      sentiment: coerceSentiment(obj.sentiment),
      tags: coerceTags(obj.tags),
    };
    if (input.watchType === 'company') {
      result.signal_type = coerceSignal(obj.signal_type) ?? 'general';
    }
    return result;
  } catch {
    return fallback;
  }
}

// ---------- Dispatcher ----------

/**
 * Classify a single (article, search_term) pair. Delegates to the configured
 * provider, then parses robustly. Throws only if the provider call itself fails
 * after retries — the caller skips that article and logs to job_runs.
 */
export async function classify(
  input: ClassificationInput,
  model: AiModel,
  variant?: string
): Promise<ClassificationResult> {
  const prompt = buildPrompt(input);
  let raw: string;
  switch (model) {
    case 'claude':
      raw = await classifyWithClaude(prompt, variant);
      break;
    case 'gemini':
      raw = await classifyWithGemini(prompt, variant);
      break;
    case 'deepseek':
      raw = await classifyWithDeepseek(prompt, variant);
      break;
    default:
      throw new Error(`AI model '${model}' is not implemented`);
  }
  return parseClassificationJson(raw, input);
}

/** Free-form text generation (e.g. newsletter summary). Returns raw text. */
export async function generateText(prompt: string, model: AiModel, variant?: string): Promise<string> {
  switch (model) {
    case 'claude': return classifyWithClaude(prompt, variant);
    case 'gemini': return classifyWithGemini(prompt, variant);
    case 'deepseek': return classifyWithDeepseek(prompt, variant);
    default: throw new Error(`AI model '${model}' is not implemented`);
  }
}
