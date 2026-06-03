import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { search_terms } from '../db/schema';
import { collectAll, collectForSearchTerm } from '../services/collector';

/**
 * Collector job entrypoint (`node dist/jobs/collect.js`).
 * - SEARCH_TERM_ID set → process only that term (manual "Jetzt abrufen").
 * - otherwise → batch over all active search_terms (scheduled run).
 */
async function main(): Promise<void> {
  const termId = process.env.SEARCH_TERM_ID?.trim();

  if (termId) {
    console.log(`[collect] single-term run for ${termId}`);
    const [term] = await db.select().from(search_terms).where(eq(search_terms.id, termId));
    if (!term) throw new Error(`search_term ${termId} not found`);
    const summary = await collectForSearchTerm(term, 'manual');
    console.log('[collect] done:', summary);
  } else {
    console.log('[collect] batch run for all active search_terms');
    const summaries = await collectAll('scheduled');
    console.log(`[collect] done: ${summaries.length} terms processed`);
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[collect] fatal:', err);
    pool.end().finally(() => process.exit(1));
  });
