import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { linkedin_query_runs } from '../../db/schema';

/**
 * Global per-day LinkedIn scrape ledger — the cost brake for Apify.
 *
 * LinkedIn search is GLOBAL (one query returns multilingual results) and Apify
 * bills per scraped post. Two failure modes drove the cost explosion:
 *  1. Intra-term alias fan-out: one keyword → primary + up to 5 translated
 *     aliases, each a separate paid scrape.
 *  2. Inter-term alias collision: different German keywords often map to the
 *     SAME English alias (e.g. "Privatbanking" and "Private Banking" both →
 *     "private banking"), so the identical query was scraped multiple times in
 *     one batch — and again on manual runs.
 *
 * This ledger guarantees that a given (query, window) is scraped at most ONCE
 * per Vienna calendar day, GLOBALLY across all terms, batches, scheduled and
 * manual runs. Translations still run (different query strings → different
 * rows), but never twice for the same string in 24h.
 */

const VIENNA_TZ = 'Europe/Vienna';

export function viennaDayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VIENNA_TZ }).format(d); // YYYY-MM-DD
}

const norm = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Atomically claim today's scrape for (query, postedLimit). Returns true if THIS
 * caller won the slot and should run the (paid) scrape, false if another run
 * already scraped this query+window today. Atomic via INSERT … ON CONFLICT DO
 * NOTHING, so concurrent runs can't both scrape.
 */
export async function claimLinkedInScrape(query: string, postedLimit: string): Promise<boolean> {
  const rows = await db.insert(linkedin_query_runs)
    .values({ query_norm: norm(query), posted_limit: postedLimit, day_key: viennaDayKey() })
    .onConflictDoNothing()
    .returning({ query_norm: linkedin_query_runs.query_norm });
  return rows.length > 0;
}

/**
 * Release a claim — call only when the scrape FAILED, so a later run today can
 * retry it instead of being permanently blocked by a dead claim.
 */
export async function releaseLinkedInScrape(query: string, postedLimit: string): Promise<void> {
  await db.delete(linkedin_query_runs).where(and(
    eq(linkedin_query_runs.query_norm, norm(query)),
    eq(linkedin_query_runs.posted_limit, postedLimit),
    eq(linkedin_query_runs.day_key, viennaDayKey()),
  ));
}
