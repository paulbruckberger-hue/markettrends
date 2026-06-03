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

const BASE_RULES = `Du bist ein erfahrener B2B-Marktanalyst. Du bewertest, wie relevant ein Inhalt für einen Beobachtungsbegriff ist, und fasst ihn für eine Führungskraft auf Deutsch zusammen.

RANK (Wichtigkeit/Relevanz):
- 1 = hochrelevant: bedeutendes Marktsignal, direkt zum Begriff, handlungsrelevant.
- 2 = relevant: klarer Bezug, beobachtenswert, aber nicht dringend.
- 3 = am Rande: schwacher/indirekter Bezug oder generische Nachricht.

ANTWORTFORMAT: Antworte ausschließlich mit EINEM JSON-Objekt, ohne Markdown-Codeblöcke, ohne Erklärtext davor oder danach.`;

const TOPIC_PROMPT = (input: ClassificationInput) => `${BASE_RULES}

Beobachtetes Thema: "${input.searchQuery}"
Quelle: ${input.sourceType}

Inhalt:
"""
${input.content.slice(0, 4000)}
"""

Gib JSON in genau dieser Form zurück:
{
  "rank": 1,
  "rank_reason": "kurze Begründung (1 Satz, Deutsch)",
  "title": "prägnante Executive-Headline auf Deutsch",
  "summary": "• erster Punkt\\n• zweiter Punkt\\n• dritter Punkt",
  "sentiment": "positive | negative | neutral",
  "tags": ["max", "drei", "schlagworte"]
}`;

const COMPANY_PROMPT = (input: ClassificationInput) => `${BASE_RULES}

Beobachtetes Unternehmen: "${input.searchQuery}"
Quelle: ${input.sourceType}

Bestimme zusätzlich den Signal-Typ (signal_type) aus dieser Liste:
product_launch, expansion, partnership, personnel, funding, regulatory, earnings, general.

Inhalt:
"""
${input.content.slice(0, 4000)}
"""

Gib JSON in genau dieser Form zurück:
{
  "rank": 1,
  "rank_reason": "kurze Begründung (1 Satz, Deutsch)",
  "title": "prägnante Executive-Headline auf Deutsch",
  "summary": "• erster Punkt\\n• zweiter Punkt\\n• dritter Punkt",
  "sentiment": "positive | negative | neutral",
  "tags": ["max", "drei", "schlagworte"],
  "signal_type": "partnership"
}`;

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
