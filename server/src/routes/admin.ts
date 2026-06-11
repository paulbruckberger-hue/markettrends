import { Router, Response, NextFunction } from 'express';
import { and, eq, isNotNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import {
  app_config, users, settings, user_article_state, user_content_profiles,
  watch_items, DEFAULT_RANK_CRITERIA, RankCriteria,
} from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { rerankBatch, rerankStatus } from '../services/rerank';
import { loadContentProfile, rebuildContentProfile, repersonalizeUserTerm } from '../services/personalize';
import { backfillLinkedInRuns, backfillLinkedInStatus } from '../services/backfillLinkedIn';

export const adminRouter = Router();

/** Admin-only guard — must come after authMiddleware. */
function adminOnly(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Kein Admin-Zugriff' });
    return;
  }
  next();
}

adminRouter.use(authMiddleware);
adminRouter.use(adminOnly);

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

function isValidRankCriteria(v: unknown): v is RankCriteria {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  for (const lang of ['de', 'en']) {
    const block = obj[lang];
    if (!block || typeof block !== 'object') return false;
    const b = block as Record<string, unknown>;
    if (typeof b.rank1 !== 'string' || typeof b.rank2 !== 'string' || typeof b.rank3 !== 'string') return false;
    if (!b.rank1.trim() || !b.rank2.trim() || !b.rank3.trim()) return false;
  }
  return true;
}

// GET /api/admin/config
adminRouter.get('/config', async (_req, res: Response) => {
  const [cfg] = await db.select().from(app_config).where(eq(app_config.id, 1));
  if (!cfg) {
    const [created] = await db.insert(app_config).values({ id: 1 }).onConflictDoNothing().returning();
    res.json(created
      ? { ...created, rank_criteria: created.rank_criteria ?? DEFAULT_RANK_CRITERIA }
      : { id: 1, linkedin_max_posts: 25, linkedin_posted_limit: 'week', google_news_max_results: 20, collector_max_classifications: 30, rank_criteria: DEFAULT_RANK_CRITERIA });
    return;
  }
  // Always return rank_criteria, falling back to defaults if not yet set
  res.json({ ...cfg, rank_criteria: cfg.rank_criteria ?? DEFAULT_RANK_CRITERIA });
});

// PUT /api/admin/config
adminRouter.put('/config', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = { updated_at: new Date() };

  if (typeof b.linkedin_max_posts === 'number' && b.linkedin_max_posts > 0) {
    patch.linkedin_max_posts = Math.min(500, Math.round(b.linkedin_max_posts));
  }
  if (['day', 'week', 'month'].includes(b.linkedin_posted_limit)) {
    patch.linkedin_posted_limit = b.linkedin_posted_limit;
  }
  if (typeof b.google_news_max_results === 'number' && b.google_news_max_results > 0) {
    patch.google_news_max_results = Math.min(100, Math.round(b.google_news_max_results));
  }
  if (typeof b.collector_max_classifications === 'number' && b.collector_max_classifications > 0) {
    // Classification is near-free (Gemini Flash); the cap exists only to bound a
    // single run's wall-time. Raised from 100 so "classify everything scraped"
    // is actually possible.
    patch.collector_max_classifications = Math.min(2000, Math.round(b.collector_max_classifications));
  }
  if (isValidRankCriteria(b.rank_criteria)) {
    patch.rank_criteria = b.rank_criteria;
  }

  // Ensure row exists
  await db.insert(app_config).values({ id: 1 }).onConflictDoNothing();
  const [updated] = await db.update(app_config).set(patch).where(eq(app_config.id, 1)).returning();
  res.json({ ...updated, rank_criteria: updated.rank_criteria ?? DEFAULT_RANK_CRITERIA });
});

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────

// GET /api/admin/users
adminRouter.get('/users', async (_req, res: Response) => {
  const rows = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
    is_active: users.is_active,
    created_at: users.created_at,
  }).from(users).orderBy(users.created_at);
  res.json(rows);
});

// POST /api/admin/users  → create user
adminRouter.post('/users', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const username = typeof b.username === 'string' ? b.username.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const role = b.role === 'admin' ? 'admin' : 'user';
  if (!username || password.length < 4) {
    res.status(400).json({ error: 'username und password (min. 4 Zeichen) erforderlich' });
    return;
  }
  const password_hash = bcrypt.hashSync(password, 10);
  const [created] = await db.insert(users).values({
    username,
    password_hash,
    role,
    email: typeof b.email === 'string' ? b.email.trim() || null : null,
    is_active: true,
  }).onConflictDoNothing({ target: users.username }).returning();

  if (!created) {
    res.status(409).json({ error: `Benutzername "${username}" ist bereits vergeben` });
    return;
  }
  await db.insert(settings).values({ user_id: created.id }).onConflictDoNothing();
  res.status(201).json({ id: created.id, username: created.username, role: created.role, is_active: created.is_active });
});

// PUT /api/admin/users/:id  → toggle active / change role
adminRouter.put('/users/:id', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (b.role === 'admin' || b.role === 'user') patch.role = b.role;
  if (typeof b.email === 'string') patch.email = b.email.trim() || null;

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Keine gültigen Felder' });
    return;
  }
  const [updated] = await db.update(users)
    .set(patch)
    .where(eq(users.id, req.params.id))
    .returning({ id: users.id, username: users.username, role: users.role, is_active: users.is_active, email: users.email });
  if (!updated) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  res.json(updated);
});

// ─────────────────────────────────────────────
// Rerank (re-classify existing articles with the current prompt + per-user ranks)
// ─────────────────────────────────────────────

// GET /api/admin/rerank → progress counts
adminRouter.get('/rerank', async (_req, res: Response) => {
  res.json(await rerankStatus());
});

// POST /api/admin/rerank → process one batch (call repeatedly until done)
adminRouter.post('/rerank', async (req: AuthedRequest, res: Response) => {
  const limit = typeof req.body?.limit === 'number' ? req.body.limit : 20;
  try {
    res.json(await rerankBatch(limit));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Rerank fehlgeschlagen' });
  }
});

// ─────────────────────────────────────────────
// Global content profiles + re-apply feedback (Option 2)
// ─────────────────────────────────────────────

/** All users who have given any 👍/👎 OR already have a content profile. */
async function usersWithSignal(): Promise<string[]> {
  const fb = await db.selectDistinct({ id: user_article_state.user_id })
    .from(user_article_state).where(isNotNull(user_article_state.user_feedback));
  const prof = await db.select({ id: user_content_profiles.user_id }).from(user_content_profiles);
  return [...new Set([...fb.map((r) => r.id), ...prof.map((r) => r.id)])];
}

// POST /api/admin/rebuild-profiles → (re)build every user's global content profile
// from their existing 👍/👎 across all keywords. Seeds Option 2 from existing ratings.
adminRouter.post('/rebuild-profiles', async (_req: AuthedRequest, res: Response) => {
  try {
    const fb = await db.selectDistinct({ id: user_article_state.user_id })
      .from(user_article_state).where(isNotNull(user_article_state.user_feedback));
    const out: { user: string; hasProfile: boolean; profile?: string }[] = [];
    for (const u of fb) {
      const profile = await rebuildContentProfile(u.id);
      out.push({ user: u.id, hasProfile: !!profile, profile: profile ?? undefined });
    }
    res.json({ users: fb.length, profilesBuilt: out.filter((o) => o.hasProfile).length, detail: out });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Profil-Aufbau fehlgeschlagen' });
  }
});

// GET /api/admin/reapply-feedback → how many (user, term) pairs will be re-personalised
adminRouter.get('/reapply-feedback', async (_req: AuthedRequest, res: Response) => {
  const uids = await usersWithSignal();
  if (uids.length === 0) { res.json({ totalPairs: 0 }); return; }
  const subs = await db.select({ uid: watch_items.user_id, tid: watch_items.search_term_id })
    .from(watch_items).where(eq(watch_items.is_active, true));
  const pairs = subs.filter((s) => uids.includes(s.uid));
  res.json({ totalPairs: pairs.length });
});

// POST /api/admin/reapply-feedback { offset, batch } → re-personalise a batch of
// (user, term) pairs using each user's seeded global profile + term feedback.
// Resumable & idempotent. Run /rebuild-profiles first.
adminRouter.post('/reapply-feedback', async (req: AuthedRequest, res: Response) => {
  const offset = typeof req.body?.offset === 'number' ? Math.max(0, req.body.offset) : 0;
  const batch = typeof req.body?.batch === 'number' ? Math.min(20, Math.max(1, req.body.batch)) : 5;
  try {
    const uids = await usersWithSignal();
    const subs = await db.select({ uid: watch_items.user_id, tid: watch_items.search_term_id })
      .from(watch_items).where(eq(watch_items.is_active, true));
    const pairs = subs.filter((s) => uids.includes(s.uid))
      .sort((a, b) => (a.uid + a.tid).localeCompare(b.uid + b.tid));
    const slice = pairs.slice(offset, offset + batch);

    let personalised = 0;
    for (const p of slice) {
      personalised += await repersonalizeUserTerm(p.uid, p.tid, 200, { skipProfileRebuild: true });
    }
    const nextOffset = offset + slice.length;
    res.json({ processedPairs: slice.length, personalised, offset, nextOffset, totalPairs: pairs.length, done: nextOffset >= pairs.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Re-Apply fehlgeschlagen' });
  }
});

// ─────────────────────────────────────────────
// Backfill: classify already-scraped LinkedIn posts from past Apify runs (no new scrape)
// ─────────────────────────────────────────────

// GET /api/admin/backfill-linkedin → number of past runs available
adminRouter.get('/backfill-linkedin', async (_req: AuthedRequest, res: Response) => {
  try {
    res.json(await backfillLinkedInStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Status fehlgeschlagen' });
  }
});

// POST /api/admin/backfill-linkedin { offset, runs } → process a batch of past runs
adminRouter.post('/backfill-linkedin', async (req: AuthedRequest, res: Response) => {
  const offset = typeof req.body?.offset === 'number' ? Math.max(0, req.body.offset) : 0;
  const runs = typeof req.body?.runs === 'number' ? Math.min(10, Math.max(1, req.body.runs)) : 3;
  try {
    res.json(await backfillLinkedInRuns(offset, runs));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Backfill fehlgeschlagen' });
  }
});
