import { config } from '../../config';
import { withRetry } from '../../lib/retry';

const APIFY_BASE = 'https://api.apify.com/v2';

export function apifyEnabled(): boolean {
  return !!config.apifyApiToken;
}

/** Authenticated GET against the Apify REST API. Returns parsed JSON. */
async function apifyGet<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  if (!config.apifyApiToken) throw new Error('APIFY_API_TOKEN not configured');
  const qs = new URLSearchParams({ token: config.apifyApiToken });
  for (const [k, v] of Object.entries(query)) qs.set(k, String(v));
  const url = `${APIFY_BASE}${path}?${qs.toString()}`;
  return withRetry(async () => {
    const resp = await fetch(url, { headers: { accept: 'application/json' } });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Apify GET ${path} ${resp.status}: ${body.slice(0, 200)}`);
    }
    return (await resp.json()) as T;
  }, { label: `apifyGet(${path})`, attempts: 2, baseDelayMs: 1500 });
}

export interface ApifyRunSummary {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  defaultDatasetId?: string;
  defaultKeyValueStoreId?: string;
}

/** List an actor's past runs (newest first). Reads ALREADY-EXECUTED runs — no new scrape, no extra cost. */
export async function listActorRuns(
  actorSlug: string,
  { status = 'SUCCEEDED', limit = 10, offset = 0 }: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ total: number; items: ApifyRunSummary[] }> {
  const id = actorSlug.replace('/', '~');
  const res = await apifyGet<{ data: { total: number; items: ApifyRunSummary[] } }>(
    `/acts/${id}/runs`, { status, desc: 'true', limit, offset },
  );
  return { total: res.data?.total ?? 0, items: res.data?.items ?? [] };
}

/** The INPUT record of a run's key-value store (tells us which query produced the dataset). Null if gone. */
export async function getRunInput<T = Record<string, unknown>>(kvStoreId: string): Promise<T | null> {
  try { return await apifyGet<T>(`/key-value-stores/${kvStoreId}/records/INPUT`); }
  catch { return null; }
}

/** All items of an already-produced dataset (already paid for). */
export async function getDatasetItems<T = Record<string, unknown>>(datasetId: string): Promise<T[]> {
  try {
    const items = await apifyGet<T[]>(`/datasets/${datasetId}/items`, { clean: 'true', format: 'json', limit: 1000 });
    return Array.isArray(items) ? items : [];
  } catch { return []; }
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
