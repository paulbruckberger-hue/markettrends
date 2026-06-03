/**
 * Token-based pre-filter. Replaces naive substring matching so multi-word
 * topics like "AI in lending" still match texts where the exact phrase never
 * appears. We tokenize the query, drop stopwords, then require:
 *   - <=2 significant tokens  → ALL must appear
 *   - >2 significant tokens   → at least half must appear
 * For companies, the presence of the company name (any significant token) is
 * enough — handled by passing watchType='company'.
 */

const STOPWORDS = new Set([
  // English
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with',
  'at', 'by', 'from', 'as', 'is', 'are', 'be', 'this', 'that', 'it',
  // German
  'der', 'die', 'das', 'und', 'oder', 'von', 'im', 'in', 'auf', 'für',
  'mit', 'bei', 'aus', 'als', 'ist', 'sind', 'ein', 'eine', 'einen', 'den',
  'dem', 'des', 'zur', 'zum', 'am',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function matchesQuery(
  queryNormalized: string,
  text: string,
  watchType: 'topic' | 'company' = 'topic'
): boolean {
  const haystackTokens = new Set(tokenize(text));
  if (haystackTokens.size === 0) return false;

  const queryTokens = tokenize(queryNormalized);
  if (queryTokens.length === 0) {
    // Pure stopword query — fall back to substring.
    return text.toLowerCase().includes(queryNormalized.toLowerCase());
  }

  const present = queryTokens.filter((t) => haystackTokens.has(t)).length;

  if (watchType === 'company') {
    // Any significant token of the company name present is enough.
    return present >= 1;
  }

  if (queryTokens.length <= 2) {
    return present === queryTokens.length;
  }
  return present >= Math.ceil(queryTokens.length / 2);
}
