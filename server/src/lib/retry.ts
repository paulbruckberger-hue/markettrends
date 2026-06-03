/**
 * Exponential backoff for external calls (AI, Apify, RSS).
 * 3 attempts by default, base delay 1s, doubling each time, with jitter.
 * Never let a single transient failure kill a whole run — callers decide what
 * to do once retries are exhausted (skip the item, log to job_runs, etc.).
 */
export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const label = opts.label ?? 'call';

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 250);
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[retry] ${label} attempt ${i + 1}/${attempts} failed: ${msg} — retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}
