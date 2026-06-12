import { Router, Response, NextFunction } from 'express';
import { and, count, desc, eq, isNotNull, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import {
  app_config, users, settings, user_article_state, user_content_profiles,
  watch_items, search_terms, user_invites, DEFAULT_RANK_CRITERIA, RankCriteria,
} from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { rerankBatch, rerankStatus } from '../services/rerank';
import { loadContentProfile, rebuildContentProfile, repersonalizeUserTerm } from '../services/personalize';
import { backfillLinkedInRuns, backfillLinkedInStatus } from '../services/backfillLinkedIn';
import { entitlementsFor } from '../lib/entitlements';
import { createInvite, sendInviteEmail, inviteAcceptUrl } from '../services/invites';
import { mailerConfigured } from '../services/mailer';
import { addWatch, recomputeTermActive } from '../services/watchlistService';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
    plan: users.plan,
    is_comp: users.is_comp,
    keyword_bonus: users.keyword_bonus,
    subscription_status: users.subscription_status,
  }).from(users).orderBy(users.created_at);

  // Aktive Keyword-Anzahl je User (für used/quota-Anzeige) in einer Abfrage.
  const counts = await db.select({ uid: watch_items.user_id, cnt: count() })
    .from(watch_items).where(eq(watch_items.is_active, true)).groupBy(watch_items.user_id);
  const usedMap = new Map(counts.map((c) => [c.uid, Number(c.cnt)]));

  res.json(rows.map((u) => ({ ...u, used: usedMap.get(u.id) ?? 0, entitlements: entitlementsFor(u) })));
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

// PUT /api/admin/users/:id  → aktiv/Rolle/E-Mail + Tarif/Comp/Bonus-Keywords
adminRouter.put('/users/:id', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (b.role === 'admin' || b.role === 'user') patch.role = b.role;
  if (typeof b.email === 'string') patch.email = b.email.trim() || null;
  if (b.plan === 'free' || b.plan === 'plus' || b.plan === 'pro') patch.plan = b.plan;
  if (typeof b.is_comp === 'boolean') patch.is_comp = b.is_comp;
  if (Number.isInteger(b.keyword_bonus) && b.keyword_bonus >= 0) {
    patch.keyword_bonus = Math.min(1000, b.keyword_bonus);
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Keine gültigen Felder' });
    return;
  }
  const [updated] = await db.update(users)
    .set(patch)
    .where(eq(users.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  res.json({
    id: updated.id, username: updated.username, email: updated.email, role: updated.role,
    is_active: updated.is_active, plan: updated.plan, is_comp: updated.is_comp,
    keyword_bonus: updated.keyword_bonus, entitlements: entitlementsFor(updated),
  });
});

// POST /api/admin/users/:id/reset-password
adminRouter.post('/users/:id/reset-password', async (req: AuthedRequest, res: Response) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 4) {
    res.status(400).json({ error: 'Passwort (min. 4 Zeichen) erforderlich' });
    return;
  }
  const [updated] = await db.update(users)
    .set({ password_hash: bcrypt.hashSync(password, 10) })
    .where(eq(users.id, req.params.id))
    .returning({ id: users.id });
  if (!updated) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  res.json({ success: true });
});

// DELETE /api/admin/users/:id  (Schutz: nicht sich selbst, nicht der letzte Admin)
adminRouter.delete('/users/:id', async (req: AuthedRequest, res: Response) => {
  const id = req.params.id;
  if (id === req.user!.id) {
    res.status(400).json({ error: 'Du kannst dich nicht selbst löschen' });
    return;
  }
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  if (target.role === 'admin') {
    const [{ c }] = await db.select({ c: count() }).from(users).where(eq(users.role, 'admin'));
    if (Number(c) <= 1) {
      res.status(400).json({ error: 'Der letzte Admin kann nicht gelöscht werden' });
      return;
    }
  }
  await db.delete(users).where(eq(users.id, id)); // Abos/Settings cascaden
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// Invites (Admin lädt Kund:innen per E-Mail ein)
// ─────────────────────────────────────────────

// GET /api/admin/invites
adminRouter.get('/invites', async (_req, res: Response) => {
  const rows = await db.select().from(user_invites).orderBy(desc(user_invites.created_at));
  res.json(rows.map((r) => ({ ...r, accept_url: inviteAcceptUrl(r.token) })));
});

// POST /api/admin/invites  { email, role?, plan?, keyword_bonus? }
adminRouter.post('/invites', async (req: AuthedRequest, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben' });
    return;
  }
  const [existing] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.username, email), eq(users.email, email)));
  if (existing) {
    res.status(409).json({ error: 'Für diese E-Mail existiert bereits ein Konto' });
    return;
  }
  const plan = ['free', 'plus', 'pro'].includes(req.body?.plan) ? req.body.plan : 'free';
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  const keyword_bonus = Number.isInteger(req.body?.keyword_bonus) ? Math.max(0, req.body.keyword_bonus) : 0;

  const invite = await createInvite({ email, role, plan, keyword_bonus, invited_by: req.user!.id });

  let emailed = false;
  let email_error: string | undefined;
  if (mailerConfigured()) {
    try { await sendInviteEmail(invite); emailed = true; }
    catch (err) { email_error = err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen'; }
  }
  // accept_url immer zurückgeben → der Admin kann den Link auch manuell teilen,
  // selbst wenn SMTP (noch) nicht konfiguriert ist.
  res.status(201).json({ invite, emailed, accept_url: inviteAcceptUrl(invite.token), email_error });
});

// DELETE /api/admin/invites/:id
adminRouter.delete('/invites/:id', async (req: AuthedRequest, res: Response) => {
  const [deleted] = await db.delete(user_invites).where(eq(user_invites.id, req.params.id)).returning({ id: user_invites.id });
  if (!deleted) {
    res.status(404).json({ error: 'Einladung nicht gefunden' });
    return;
  }
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// User-Keywords verwalten (Admin pflegt die Beobachtungen eines Users)
// ─────────────────────────────────────────────

async function ensureUserExists(id: string): Promise<boolean> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  return !!u;
}

// GET /api/admin/users/:id/watchlist
adminRouter.get('/users/:id/watchlist', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureUserExists(req.params.id))) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  const rows = await db.select({
    id: watch_items.id,
    display_name: watch_items.display_name,
    label: watch_items.label,
    color: watch_items.color,
    is_active: watch_items.is_active,
    created_at: watch_items.created_at,
    search_term_id: search_terms.id,
    type: search_terms.type,
    query_display: search_terms.query_display,
    geo_filter: search_terms.geo_filter,
  })
    .from(watch_items)
    .innerJoin(search_terms, eq(watch_items.search_term_id, search_terms.id))
    .where(eq(watch_items.user_id, req.params.id))
    .orderBy(desc(watch_items.created_at));
  res.json(rows);
});

// POST /api/admin/users/:id/watchlist  → Keyword für den User anlegen (ohne Quota)
adminRouter.post('/users/:id/watchlist', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureUserExists(req.params.id))) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  const b = req.body ?? {};
  const type = b.type === 'company' ? 'company' : b.type === 'topic' ? 'topic' : null;
  const query = typeof b.query === 'string' ? b.query.trim() : '';
  if (!type || !query) {
    res.status(400).json({ error: 'type (topic|company) und query erforderlich' });
    return;
  }
  const { watchItem, term } = await addWatch(req.params.id, {
    type, query,
    geo_filter: b.geo_filter,
    display_name: typeof b.display_name === 'string' ? b.display_name : undefined,
    label: typeof b.label === 'string' ? b.label : undefined,
    color: typeof b.color === 'string' ? b.color : undefined,
  }, { enforceQuota: false });
  res.status(201).json({ ...watchItem, search_term: term });
});

// PUT /api/admin/users/:id/watchlist/:itemId  → umbenennen / aktiv schalten
adminRouter.put('/users/:id/watchlist/:itemId', async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof b.display_name === 'string') patch.display_name = b.display_name.trim();
  if (typeof b.label === 'string') patch.label = b.label;
  if (typeof b.color === 'string') patch.color = b.color;
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Keine gültigen Felder' });
    return;
  }
  const [updated] = await db.update(watch_items)
    .set(patch)
    .where(and(eq(watch_items.id, req.params.itemId), eq(watch_items.user_id, req.params.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Keyword nicht gefunden' });
    return;
  }
  await recomputeTermActive(updated.search_term_id);
  res.json(updated);
});

// DELETE /api/admin/users/:id/watchlist/:itemId
adminRouter.delete('/users/:id/watchlist/:itemId', async (req: AuthedRequest, res: Response) => {
  const [deleted] = await db.delete(watch_items)
    .where(and(eq(watch_items.id, req.params.itemId), eq(watch_items.user_id, req.params.id)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Keyword nicht gefunden' });
    return;
  }
  await recomputeTermActive(deleted.search_term_id);
  res.json({ success: true });
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
