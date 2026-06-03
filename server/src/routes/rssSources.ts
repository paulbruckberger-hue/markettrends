import { Router, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { rss_sources } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';

export const rssSourcesRouter = Router();
rssSourcesRouter.use(authMiddleware);

// GET /api/rss-sources  → inkl. last_ok_at / last_error (Health)
rssSourcesRouter.get('/', async (_req: AuthedRequest, res: Response) => {
  const feeds = await db.select().from(rss_sources).orderBy(rss_sources.category, rss_sources.name);
  res.json(feeds);
});

// PUT /api/rss-sources/:id  → { is_active }
rssSourcesRouter.put('/:id', async (req: AuthedRequest, res: Response) => {
  if (typeof req.body?.is_active !== 'boolean') {
    res.status(400).json({ error: 'is_active (boolean) erforderlich' });
    return;
  }
  const [updated] = await db.update(rss_sources)
    .set({ is_active: req.body.is_active })
    .where(eq(rss_sources.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  res.json(updated);
});
