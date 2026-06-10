import { Router, Response } from 'express';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { newsletter_clusters, watch_items } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { suggestClusters } from '../services/clusterSuggest';

export const clustersRouter = Router();
clustersRouter.use(authMiddleware);

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function sanitizeCluster(b: any): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 60);
  if (typeof b.color === 'string') patch.color = b.color;
  if (b.delivery === 'combined' || b.delivery === 'separate') patch.delivery = b.delivery;
  if (b.cadence === 'weekly' || b.cadence === 'daily') patch.cadence = b.cadence;
  if (typeof b.day === 'string' && DAYS.includes(b.day)) patch.day = b.day;
  if (typeof b.sort_order === 'number') patch.sort_order = b.sort_order;
  return patch;
}

// GET /api/clusters → user's clusters + member watch ids + count
clustersRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const clusters = await db.select()
    .from(newsletter_clusters)
    .where(eq(newsletter_clusters.user_id, userId))
    .orderBy(asc(newsletter_clusters.sort_order), asc(newsletter_clusters.created_at));

  const members = await db.select({ id: watch_items.id, cluster_id: watch_items.cluster_id })
    .from(watch_items)
    .where(and(eq(watch_items.user_id, userId), eq(watch_items.is_active, true)));

  const byCluster = new Map<string, string[]>();
  let unassigned = 0;
  for (const m of members) {
    if (!m.cluster_id) { unassigned++; continue; }
    const arr = byCluster.get(m.cluster_id) ?? [];
    arr.push(m.id);
    byCluster.set(m.cluster_id, arr);
  }

  res.json({
    clusters: clusters.map((c) => ({ ...c, member_ids: byCluster.get(c.id) ?? [] })),
    unassigned_count: unassigned,
  });
});

// POST /api/clusters → create
clustersRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const patch = sanitizeCluster(req.body ?? {});
  if (!patch.name) {
    res.status(400).json({ error: 'name erforderlich' });
    return;
  }
  const [created] = await db.insert(newsletter_clusters)
    .values({ user_id: req.user!.id, ...patch } as any)
    .returning();
  res.status(201).json(created);
});

// PUT /api/clusters/:id → update
clustersRouter.put('/:id', async (req: AuthedRequest, res: Response) => {
  const patch = sanitizeCluster(req.body ?? {});
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Keine gültigen Felder' });
    return;
  }
  const [updated] = await db.update(newsletter_clusters)
    .set(patch)
    .where(and(eq(newsletter_clusters.id, req.params.id), eq(newsletter_clusters.user_id, req.user!.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  res.json(updated);
});

// DELETE /api/clusters/:id → members fall back to "unassigned" via FK ON DELETE SET NULL
clustersRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const [deleted] = await db.delete(newsletter_clusters)
    .where(and(eq(newsletter_clusters.id, req.params.id), eq(newsletter_clusters.user_id, req.user!.id)))
    .returning();
  if (!deleted) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  res.json({ success: true });
});

// POST /api/clusters/assign → assign watches to a cluster (or null = unassign)
// body: { cluster_id: string|null, watch_item_ids: string[] }
clustersRouter.post('/assign', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const clusterId: string | null = req.body?.cluster_id ?? null;
  const ids: string[] = Array.isArray(req.body?.watch_item_ids) ? req.body.watch_item_ids : [];
  if (ids.length === 0) { res.status(400).json({ error: 'watch_item_ids erforderlich' }); return; }

  if (clusterId) {
    const [owns] = await db.select({ id: newsletter_clusters.id })
      .from(newsletter_clusters)
      .where(and(eq(newsletter_clusters.id, clusterId), eq(newsletter_clusters.user_id, userId)));
    if (!owns) { res.status(404).json({ error: 'Cluster nicht gefunden' }); return; }
  }

  await db.update(watch_items)
    .set({ cluster_id: clusterId })
    .where(and(eq(watch_items.user_id, userId), inArray(watch_items.id, ids)));
  res.json({ success: true, cluster_id: clusterId, count: ids.length });
});

// GET /api/clusters/suggest → AI grouping proposal (nothing persisted)
clustersRouter.get('/suggest', async (req: AuthedRequest, res: Response) => {
  try {
    const suggestions = await suggestClusters(req.user!.id);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Vorschlag fehlgeschlagen' });
  }
});

// POST /api/clusters/apply-suggestion → create suggested clusters + assign members
// body: { clusters: [{ name, color?, member_ids: [] }] }
clustersRouter.post('/apply-suggestion', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const incoming = Array.isArray(req.body?.clusters) ? req.body.clusters : [];
  if (incoming.length === 0) { res.status(400).json({ error: 'clusters erforderlich' }); return; }

  // Only assign watches that actually belong to the user.
  const owned = await db.select({ id: watch_items.id })
    .from(watch_items)
    .where(and(eq(watch_items.user_id, userId), eq(watch_items.is_active, true)));
  const ownedSet = new Set(owned.map((o) => o.id));

  const created: unknown[] = [];
  let order = Date.now() % 100000;
  for (const c of incoming) {
    const name = typeof c.name === 'string' ? c.name.trim().slice(0, 60) : '';
    if (!name) continue;
    const memberIds: string[] = Array.isArray(c.member_ids) ? c.member_ids.filter((id: string) => ownedSet.has(id)) : [];
    const [cluster] = await db.insert(newsletter_clusters)
      .values({ user_id: userId, name, color: typeof c.color === 'string' ? c.color : '#3B82F6', sort_order: order++ })
      .returning();
    if (memberIds.length) {
      await db.update(watch_items)
        .set({ cluster_id: cluster.id })
        .where(and(eq(watch_items.user_id, userId), inArray(watch_items.id, memberIds)));
    }
    created.push({ ...cluster, member_ids: memberIds });
  }
  res.status(201).json({ clusters: created });
});
