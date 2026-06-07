import { classifyWithClaude } from './claude';
import { classifyWithGemini } from './gemini';
import { classifyWithDeepseek } from './deepseek';
import { RankCriteria, DEFAULT_RANK_CRITERIA } from '../../db/schema';

export type AiModel = 'claude' | 'gemini' | 'deepseek';

/**
 * Bumped whenever the base ranking prompt changes. Classifications carry the
 * version they were ranked with, so a bulk rerank can target only stale rows.
 */
export const RANK_PROMPT_VERSION = 1;

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
  /** Free-text hint from the user describing what matters for this keyword. Injected into the prompt. */
  contextHint?: string | null;
}

export interface FewShotExample {
  content: string;   // title + excerpt (truncated)
  ai_rank: number;
  user_rank: number;
}

export interface RelevanceExample {
  content: string;            // title + excerpt (truncated)
  feedback: 'up' | 'down';    // 👍 more like this | 👎 less like this
}

export interface ClassificationOptions {
  /** Custom rank criteria from app_config. Falls back to hardcoded defaults. */
  rankCriteria?: RankCriteria;
  /** Recent user corrections used as few-shot learning examples. */
  fewShotExamples?: FewShotExample[];
  /** Recent 👍/👎 relevance feedback used to bias the ranking toward user preferences. */
  relevanceFeedback?: RelevanceExample[];
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
    base: 'You are a Strategic Intelligence Analyst for a senior executive. You judge how relevant a piece of content is for an observed term — strictly, from a decision-maker\'s perspective — and summarise it for action. Answer EXCLUSIVELY in English.',
    headline: 'concise Executive Headline in English',
    reason: 'short justification (1 sentence, English) — state WHY this rank, referencing the observed term',
    tag: 'max three keywords in English',
  };
  return {
    base: 'Du bist ein strategischer Intelligence-Analyst für eine Führungskraft. Du bewertest streng aus Entscheider-Sicht, wie relevant ein Inhalt für einen Beobachtungsbegriff ist, und fasst ihn handlungsorientiert zusammen. Antworte AUSSCHLIESSLICH auf Deutsch.',
    headline: 'prägnante Executive-Headline auf Deutsch',
    reason: 'kurze Begründung (1 Satz, Deutsch) — nenne, WARUM dieser Rang, mit Bezug zum Beobachtungsbegriff',
    tag: 'max drei Schlagworte auf Deutsch',
  };
}

function rankRules(lang = 'de', criteria?: RankCriteria, term = ''): string {
  const c = criteria?.[lang as 'de' | 'en'] ?? DEFAULT_RANK_CRITERIA[lang as 'de' | 'en'];
  if (lang === 'en') return `RANKING — strategic relevance, in two steps.

STEP 1 — Relevance gate (MANDATORY): Does the content directly relate to, materially affect, or provide concrete data about the observed term "${term}"?
- NO → assign rank 3, no matter how well-written or generally "important" the news is. Do not proceed to step 2.
- YES → continue to step 2.

STEP 2 — Scoring:
- 1 (Critical): ${c.rank1}
  Typical triggers: launch of competing products/offerings or major partnerships; significant regulatory changes or deadlines; first-hand studies/whitepapers with new data or projections; systemic market shifts.
- 2 (Relevant): ${c.rank2}
  Typical: incremental updates to existing topics, secondary trends, general macro commentary, earnings of peripheral players, policy discussion before the legislative phase.
- 3 (Noise): ${c.rank3}
  Also: anything that fails step 1, plus generic opinion/marketing pieces with no new substance.

CALIBRATION: Be strict. Rank 1 is the exception, reserved for clearly actionable top signals — when in doubt, use rank 2. Marketing, PR boilerplate and generic "future of the industry" pieces are never rank 1.

RESPONSE FORMAT: Reply with ONE JSON object only, no Markdown code fences, no text before or after.`;
  return `RANKING — strategische Relevanz, in zwei Schritten.

SCHRITT 1 — Relevanzfilter (PFLICHT): Bezieht sich der Inhalt direkt auf den Beobachtungsbegriff »${term}«, betrifft ihn wesentlich oder liefert konkrete Daten dazu?
- NEIN → Rang 3, egal wie gut geschrieben oder allgemein „wichtig" die Nachricht ist. Schritt 2 entfällt.
- JA → weiter zu Schritt 2.

SCHRITT 2 — Einstufung:
- 1 (Kritisch): ${c.rank1}
  Typische Auslöser: Markteinführung konkurrierender Produkte/Angebote oder bedeutende Partnerschaften; wesentliche Regulierungsänderungen oder -fristen; erstmalige Studien/Whitepapers mit neuen Daten oder Prognosen; systemische Marktverschiebungen.
- 2 (Relevant): ${c.rank2}
  Typisch: inkrementelle Updates zu Bestehendem, sekundäre Trends, allgemeine Makro-Kommentare, Zahlen von Randakteuren, Politik-Diskussionen vor der Gesetzesphase.
- 3 (Rauschen): ${c.rank3}
  Außerdem: alles, was Schritt 1 nicht besteht, sowie generische Meinungs-/Marketingtexte ohne neue Substanz.

KALIBRIERUNG: Sei streng. Rang 1 ist die Ausnahme für klar handlungsrelevante Top-Signale — im Zweifel Rang 2. Marketing, PR-Floskeln und allgemeine „Zukunft-der-Branche"-Texte sind nie Rang 1.

ANTWORTFORMAT: Antworte ausschließlich mit EINEM JSON-Objekt, ohne Markdown-Codeblöcke, ohne Erklärtext davor oder danach.`;
}

function fewShotBlock(examples: FewShotExample[] | undefined, lang = 'de'): string {
  if (!examples || examples.length === 0) return '';
  const intro = lang === 'en'
    ? 'LEARNING EXAMPLES — previous user corrections (apply the same logic to similar content):'
    : 'LERNBEISPIELE — frühere Nutzerkorrekturen (gleiche Logik auf ähnliche Inhalte anwenden):';
  const lines = examples.map((ex, i) => {
    const snippet = ex.content.replace(/\s+/g, ' ').slice(0, 130);
    const correction = lang === 'en'
      ? `AI rank ${ex.ai_rank} → user corrected to rank ${ex.user_rank}`
      : `KI-Rang ${ex.ai_rank} → Nutzer korrigierte auf Rang ${ex.user_rank}`;
    return `  ${i + 1}. "${snippet}" → ${correction}`;
  });
  return `\n${intro}\n${lines.join('\n')}\n`;
}

function relevanceBlock(examples: RelevanceExample[] | undefined, lang = 'de'): string {
  if (!examples || examples.length === 0) return '';
  const snip = (s: string) => s.replace(/\s+/g, ' ').slice(0, 130);
  const up = examples.filter((e) => e.feedback === 'up').slice(0, 6);
  const down = examples.filter((e) => e.feedback === 'down').slice(0, 6);
  const intro = lang === 'en'
    ? 'RELEVANCE PREFERENCES — the reader graded similar items. Weight comparable content accordingly: lift items like the 👍 examples toward a better (lower) rank, push items like the 👎 examples toward a weaker (higher) rank.'
    : 'RELEVANZ-PRÄFERENZEN — der Leser hat ähnliche Inhalte bewertet. Gewichte vergleichbare Inhalte entsprechend: Inhalte wie die 👍-Beispiele höher (besserer/niedrigerer Rang), Inhalte wie die 👎-Beispiele niedriger (schwächerer/höherer Rang) einstufen.';
  const block = (arr: RelevanceExample[], label: string) =>
    arr.length ? `${label}\n${arr.map((e, i) => `  ${i + 1}. "${snip(e.content)}"`).join('\n')}` : '';
  const upLabel = lang === 'en' ? '👍 More relevant:' : '👍 Relevanter:';
  const downLabel = lang === 'en' ? '👎 Less relevant:' : '👎 Weniger relevant:';
  const parts = [block(up, upLabel), block(down, downLabel)].filter(Boolean);
  if (parts.length === 0) return '';
  return `\n${intro}\n${parts.join('\n')}\n`;
}

function contextBlock(input: ClassificationInput): string {
  if (!input.contextHint?.trim()) return '';
  const label = (input.language || 'de') === 'en'
    ? 'User context (what matters most for this keyword)'
    : 'Nutzer-Kontext (was für dieses Keyword besonders wichtig ist)';
  return `${label}: ${input.contextHint.trim()}\n`;
}

const TOPIC_PROMPT = (input: ClassificationInput, opts?: ClassificationOptions) => {
  const lang = input.language || 'de';
  const l = langInstruction(lang);
  const watched = lang === 'en' ? 'Observed topic' : 'Beobachtetes Thema';
  const source = lang === 'en' ? 'Source' : 'Quelle';
  const content = lang === 'en' ? 'Content' : 'Inhalt';
  return `${l.base}

${rankRules(lang, opts?.rankCriteria, input.searchQuery)}
${fewShotBlock(opts?.fewShotExamples, lang)}${relevanceBlock(opts?.relevanceFeedback, lang)}
${watched}: "${input.searchQuery}"
${contextBlock(input)}${source}: ${input.sourceType}

${content}:
"""
${input.content.slice(0, 4000)}
"""

${lang === 'en' ? 'Return JSON in exactly this form' : 'Gib JSON in genau dieser Form zurück'}:
{
  "rank": 2,
  "rank_reason": "${l.reason}",
  "title": "${l.headline}",
  "summary": "• first point\\n• second point\\n• third point",
  "sentiment": "positive | negative | neutral",
  "tags": ["${l.tag}"]
}`;
};

const COMPANY_PROMPT = (input: ClassificationInput, opts?: ClassificationOptions) => {
  const lang = input.language || 'de';
  const l = langInstruction(lang);
  const watched = lang === 'en' ? 'Observed company' : 'Beobachtetes Unternehmen';
  const source = lang === 'en' ? 'Source' : 'Quelle';
  const content = lang === 'en' ? 'Content' : 'Inhalt';
  const signalNote = lang === 'en'
    ? 'Also determine the signal_type from this list: product_launch, expansion, partnership, personnel, funding, regulatory, earnings, general.'
    : 'Bestimme zusätzlich den Signal-Typ (signal_type) aus dieser Liste: product_launch, expansion, partnership, personnel, funding, regulatory, earnings, general.';
  return `${l.base}

${rankRules(lang, opts?.rankCriteria, input.searchQuery)}
${fewShotBlock(opts?.fewShotExamples, lang)}${relevanceBlock(opts?.relevanceFeedback, lang)}
${watched}: "${input.searchQuery}"
${contextBlock(input)}${source}: ${input.sourceType}

${signalNote}

${content}:
"""
${input.content.slice(0, 4000)}
"""

${lang === 'en' ? 'Return JSON in exactly this form' : 'Gib JSON in genau dieser Form zurück'}:
{
  "rank": 2,
  "rank_reason": "${l.reason}",
  "title": "${l.headline}",
  "summary": "• first point\\n• second point\\n• third point",
  "sentiment": "positive | negative | neutral",
  "tags": ["${l.tag}"],
  "signal_type": "partnership"
}`;
};

export function buildPrompt(input: ClassificationInput, opts?: ClassificationOptions): string {
  return input.watchType === 'company' ? COMPANY_PROMPT(input, opts) : TOPIC_PROMPT(input, opts);
}

// ---------- Per-user personalization (re-rank) ----------

export interface PersonalizeInput {
  content: string;
  searchQuery: string;
  watchType: 'topic' | 'company';
  baseRank: number;          // objective shared rank to adjust from
  language?: string;
}

export interface PersonalizeOptions {
  /** This user's 👍/👎 relevance feedback. */
  relevanceFeedback?: RelevanceExample[];
  /** This user's own rank corrections. */
  fewShotExamples?: FewShotExample[];
}

function buildPersonalizePrompt(input: PersonalizeInput, opts: PersonalizeOptions): string {
  const lang = input.language || 'de';
  const fb = relevanceBlock(opts.relevanceFeedback, lang);
  const corr = fewShotBlock(opts.fewShotExamples, lang);
  if (lang === 'en') {
    return `You personalise the relevance rank for ONE specific reader. The objective base rank of this signal is ${input.baseRank} (1 = critical, 2 = relevant, 3 = noise).

Adjust the rank FOR THIS READER based on their preferences below:
- Content similar to the 👍 examples → better (lower number).
- Content similar to the 👎 examples → weaker (higher number).
- Shift by at most one step, and only when the preferences clearly justify it — otherwise keep the base rank.
- Off-topic content stays rank 3 (the relevance gate still applies).
${fb}${corr}
Observed term: "${input.searchQuery}"
Content:
"""
${input.content.slice(0, 3000)}
"""

Reply with ONE JSON object only, no Markdown, no extra text:
{ "rank": 2, "rank_reason": "one short sentence referencing the reader's preference" }`;
  }
  return `Du personalisierst die Relevanz-Einstufung für EINE bestimmte Leser:in. Der objektive Basis-Rang dieses Signals ist ${input.baseRank} (1 = kritisch, 2 = relevant, 3 = Rauschen).

Passe den Rang FÜR DIESE LESER:IN anhand ihrer Präferenzen unten an:
- Inhalte ähnlich den 👍-Beispielen → besser (niedrigerer Rang).
- Inhalte ähnlich den 👎-Beispielen → schwächer (höherer Rang).
- Verschiebe höchstens um eine Stufe und nur, wenn die Präferenzen es klar rechtfertigen — sonst behalte den Basis-Rang.
- Themenfremde Inhalte bleiben Rang 3 (der Relevanzfilter gilt weiter).
${fb}${corr}
Beobachtungsbegriff: "${input.searchQuery}"
Inhalt:
"""
${input.content.slice(0, 3000)}
"""

Antworte ausschließlich mit EINEM JSON-Objekt, ohne Markdown, ohne Zusatztext:
{ "rank": 2, "rank_reason": "ein kurzer Satz mit Bezug zur Präferenz der Leser:in" }`;
}

function parsePersonalizeJson(raw: string, baseRank: number): { rank: 1 | 2 | 3; rank_reason: string } {
  const fallback = { rank: coerceRank(baseRank), rank_reason: '' };
  if (!raw || !raw.trim()) return fallback;
  let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return fallback;
  text = text.slice(first, last + 1);
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    return {
      rank: coerceRank(obj.rank),
      rank_reason: typeof obj.rank_reason === 'string' ? obj.rank_reason : '',
    };
  } catch {
    return fallback;
  }
}

/**
 * Re-rank a single signal for one specific user from that user's own feedback.
 * Returns the (possibly unchanged) base rank when the user has no feedback —
 * callers should gate on feedback presence to avoid wasted AI calls.
 */
export async function personalizeRank(
  input: PersonalizeInput,
  model: AiModel,
  variant: string | undefined,
  opts: PersonalizeOptions,
): Promise<{ rank: 1 | 2 | 3; rank_reason: string }> {
  const hasSignal = (opts.relevanceFeedback?.length ?? 0) > 0 || (opts.fewShotExamples?.length ?? 0) > 0;
  if (!hasSignal) return { rank: coerceRank(input.baseRank), rank_reason: '' };

  const prompt = buildPersonalizePrompt(input, opts);
  let raw: string;
  switch (model) {
    case 'claude': raw = await classifyWithClaude(prompt, variant); break;
    case 'gemini': raw = await classifyWithGemini(prompt, variant); break;
    case 'deepseek': raw = await classifyWithDeepseek(prompt, variant); break;
    default: throw new Error(`AI model '${model}' is not implemented`);
  }
  return parsePersonalizeJson(raw, input.baseRank);
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
  variant?: string,
  opts?: ClassificationOptions,
): Promise<ClassificationResult> {
  const prompt = buildPrompt(input, opts);
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
