import { Router, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import { app_config, users, settings } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';

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

// GET /api/admin/config
adminRouter.get('/config', async (_req, res: Response) => {
  const [cfg] = await db.select().from(app_config).where(eq(app_config.id, 1));
  if (!cfg) {
    // Ensure row exists, return defaults
    const [created] = await db.insert(app_config).values({ id: 1 }).onConflictDoNothing().returning();
    res.json(created ?? { id: 1, linkedin_max_posts: 25, linkedin_posted_limit: 'week', google_news_max_results: 20, collector_max_classifications: 30 });
    return;
  }
  res.json(cfg);
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
    patch.collector_max_classifications = Math.min(100, Math.round(b.collector_max_classifications));
  }

  // Ensure row exists
  await db.insert(app_config).values({ id: 1 }).onConflictDoNothing();
  const [updated] = await db.update(app_config).set(patch).where(eq(app_config.id, 1)).returning();
  res.json(updated);
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
