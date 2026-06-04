import { eq } from 'drizzle-orm';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config';
import { db } from '../db/client';
import { search_terms } from '../db/schema';
import { collectForSearchTerm } from '../services/collector';

/**
 * Trigger a collection for one search_term.
 * - Production (GCP_PROJECT_ID set): execute the Cloud Run Job with a
 *   SEARCH_TERM_ID override via the Cloud Run Admin API (OIDC).
 * - Local dev: run the collector in-process (fire-and-forget) so "Jetzt
 *   abrufen" works end-to-end without GCP. Status is polled via job_runs.
 */
export async function triggerCollector(
  searchTermId: string,
  lookbackDays?: number,
): Promise<{ mode: 'cloudrun' | 'local' }> {
  if (config.gcpProjectId) {
    await runCloudRunJob(searchTermId, lookbackDays);
    return { mode: 'cloudrun' };
  }

  const [term] = await db.select().from(search_terms).where(eq(search_terms.id, searchTermId));
  if (term) {
    void collectForSearchTerm(term, 'manual', lookbackDays).catch((err) => {
      console.error('[jobTrigger:local] collection failed:', err);
    });
  }
  return { mode: 'local' };
}

async function runCloudRunJob(searchTermId: string, lookbackDays?: number): Promise<void> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const url = `https://${config.gcpRegion}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${config.gcpProjectId}/jobs/${config.collectorJobName}:run`;
  const env: { name: string; value: string }[] = [{ name: 'SEARCH_TERM_ID', value: searchTermId }];
  if (lookbackDays) env.push({ name: 'LOOKBACK_DAYS', value: String(lookbackDays) });
  await client.request({
    url,
    method: 'POST',
    data: { overrides: { containerOverrides: [{ env }] } },
  });
}
