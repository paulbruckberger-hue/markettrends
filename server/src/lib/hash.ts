import crypto from 'crypto';

/**
 * Normalize a search query for dedup: lowercase + collapse whitespace + trim.
 * Two users typing "Embedded  Finance" and "embedded finance" share one term.
 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'source',
  '__twitter_impression', 'guccounter', 'guce_referrer', 'guce_referrer_sig',
]);

/**
 * Normalize a URL for article dedup: lowercase host, strip tracking params,
 * drop fragments and trailing slashes. Falls back to the raw string if parsing
 * fails (e.g. malformed URLs from flaky feeds).
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    u.host = u.host.toLowerCase();
    u.protocol = u.protocol.toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    let out = u.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/** Stable content hash for an article = MD5 of the normalized URL. */
export function contentHash(rawUrl: string): string {
  return crypto.createHash('md5').update(normalizeUrl(rawUrl)).digest('hex');
}
