import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { search_terms, watch_items } from '../db/schema';
import { generateText } from './ai/classifier';
import { getActiveAiConfig } from './personalize';

export interface SuggestedCluster {
  name: string;
  color: string;
  member_ids: string[];   // watch_item ids
}

// Distinct, email-friendly colours assigned round-robin to suggested clusters.
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

/**
 * Ask the active AI model to group THIS user's active watches into 2–5 themed
 * newsletter clusters. The user stays in control — these are only suggestions
 * the frontend shows for accept/edit before anything is persisted. Returns []
 * when there are too few watches or the model output can't be parsed.
 */
export async function suggestClusters(userId: string): Promise<SuggestedCluster[]> {
  const rows = await db.select({
    id: watch_items.id,
    name: watch_items.display_name,
    label: watch_items.label,
    type: search_terms.type,
  })
    .from(watch_items)
    .innerJoin(search_terms, eq(search_terms.id, watch_items.search_term_id))
    .where(and(eq(watch_items.user_id, userId), eq(watch_items.is_active, true)));

  if (rows.length < 2) return [];

  const list = rows
    .map((r) => `- id:${r.id} | "${r.name}" (${r.type}${r.label ? `, Label: ${r.label}` : ''})`)
    .join('\n');

  const ai = await getActiveAiConfig();
  const prompt = `Du gruppierst die Markt-Beobachtungen (Keywords/Firmen) eines B2B-Analysten in sinnvolle Themen-Cluster für seinen Newsletter.

Beobachtungen:
${list}

Regeln:
- Jede Beobachtung gehört zu genau EINEM Cluster (referenziert per id). Lass keine aus.
- Bilde 2 bis 5 Cluster. Kurze, prägnante deutsche Cluster-Namen (max. 3 Wörter), z.B. "Wettbewerber AT", "Regulatorik", "Produkt-Trends", "Zahlungsverkehr".
- Gruppiere thematisch sinnvoll (Wettbewerber, Regulierung, Region, Produktkategorie …).

Antworte NUR mit JSON (kein Markdown, keine Erklärung):
{"clusters":[{"name":"...","member_ids":["<id>", "..."]}]}`;

  let raw: string;
  try {
    raw = await generateText(prompt, ai.model, ai.variant);
  } catch (err) {
    console.error('[clusterSuggest] AI failed:', err instanceof Error ? err.message : err);
    return [];
  }

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) return [];

  let parsed: { clusters?: { name?: string; member_ids?: string[] }[] };
  try {
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch {
    return [];
  }

  const valid = new Set(rows.map((r) => r.id));
  const out: SuggestedCluster[] = [];
  (parsed.clusters ?? []).forEach((c, i) => {
    const ids = Array.from(new Set((c.member_ids ?? []).filter((id) => valid.has(id))));
    const name = typeof c.name === 'string' ? c.name.trim().slice(0, 40) : '';
    if (name && ids.length) out.push({ name, color: PALETTE[i % PALETTE.length], member_ids: ids });
  });
  return out;
}
