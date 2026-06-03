import { config } from '../../config';
import { withRetry } from '../../lib/retry';

const APIFY_BASE = 'https://api.apify.com/v2';

export function apifyEnabled(): boolean {
  return !!config.apifyApiToken;
}

/**
 * Run an Apify actor synchronously and return its dataset items.
 * actorSlug uses "username/name"; the API needs "username~name".
 */
export async function runActorSync<T = Record<string, unknown>>(
  actorSlug: string,
  input: Record<string, unknown>,
  timeoutSecs = 120
): Promise<T[]> {
  if (!config.apifyApiToken) throw new Error('APIFY_API_TOKEN not configured');
  const id = actorSlug.replace('/', '~');
  const url = `${APIFY_BASE}/acts/${id}/run-sync-get-dataset-items?token=${config.apifyApiToken}&timeout=${timeoutSecs}`;

  return withRetry(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), (timeoutSecs + 15) * 1000);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Apify ${actorSlug} ${resp.status}: ${body.slice(0, 300)}`);
      }
      const data = (await resp.json()) as T[];
      return Array.isArray(data) ? data : [];
    } finally {
      clearTimeout(timer);
    }
  }, { label: `apify(${actorSlug})`, attempts: 2, baseDelayMs: 2000 });
}
