import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { and, count, eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users, watch_items, settings } from '../db/schema';
import { authMiddleware, signToken, AuthedRequest } from '../middleware/auth';
import { entitlementsFor } from '../lib/entitlements';
import { findValidInvite, markInviteAccepted } from '../services/invites';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const authRouter = Router();

/** Active-watch count used to show quota usage (used/remaining). */
async function activeWatchCount(userId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() })
    .from(watch_items)
    .where(and(eq(watch_items.user_id, userId), eq(watch_items.is_active, true)));
  return Number(row?.cnt ?? 0);
}

/** Full user payload returned to the client (identity + plan + entitlements). */
async function buildMePayload(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const ent = entitlementsFor(user);
  const used = await activeWatchCount(user.id);
  const remaining = ent.unlimited ? null : Math.max(0, (ent.quota ?? 0) - used);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    onboarding_completed: user.onboarding_completed,
    plan: user.plan,
    subscription_status: user.subscription_status,
    current_period_end: user.current_period_end,
    entitlements: { ...ent, used, remaining },
  };
}

// POST /api/auth/login
authRouter.post('/login', async (req, res: Response) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    return;
  }

  // Login per Benutzername ODER E-Mail (Self-Signup nutzt die E-Mail).
  const ident = username.toLowerCase().trim();
  const [user] = await db.select().from(users)
    .where(or(eq(users.username, ident), eq(users.email, ident)));
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const authUser = { id: user.id, username: user.username, role: user.role };
  res.json({ token: signToken(authUser), user: authUser });
});

// POST /api/auth/register — öffentliche Selbst-Registrierung (Gratis-Tarif, keine Karte)
authRouter.post('/register', async (req, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen haben' });
    return;
  }
  const [existing] = await db.select().from(users)
    .where(or(eq(users.username, email), eq(users.email, email)));
  if (existing) {
    res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
    return;
  }
  const [created] = await db.insert(users).values({
    username: email,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    role: 'user',
    plan: 'free',
    onboarding_completed: false,
  }).onConflictDoNothing({ target: users.username }).returning();
  if (!created) {
    res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
    return;
  }
  await db.insert(settings).values({ user_id: created.id }).onConflictDoNothing();
  const authUser = { id: created.id, username: created.username, role: created.role };
  res.status(201).json({ token: signToken(authUser), user: authUser });
});

// GET /api/auth/invite/:token — Einladung für die Accept-Seite validieren
authRouter.get('/invite/:token', async (req, res: Response) => {
  const invite = await findValidInvite(req.params.token);
  if (!invite) {
    res.status(404).json({ valid: false, error: 'Einladung ungültig oder abgelaufen' });
    return;
  }
  res.json({ valid: true, email: invite.email, plan: invite.plan, role: invite.role });
});

// POST /api/auth/accept-invite — Einladung annehmen, Passwort setzen, einloggen
authRouter.post('/accept-invite', async (req, res: Response) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!token || password.length < 6) {
    res.status(400).json({ error: 'Token und Passwort (min. 6 Zeichen) erforderlich' });
    return;
  }
  const invite = await findValidInvite(token);
  if (!invite) {
    res.status(400).json({ error: 'Einladung ungültig oder abgelaufen' });
    return;
  }
  const email = invite.email.toLowerCase().trim();
  const [existing] = await db.select().from(users)
    .where(or(eq(users.username, email), eq(users.email, email)));
  if (existing) {
    await markInviteAccepted(invite.id);
    res.status(409).json({ error: 'Für diese E-Mail existiert bereits ein Konto — bitte einloggen' });
    return;
  }
  const [created] = await db.insert(users).values({
    username: email,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    role: invite.role === 'admin' ? 'admin' : 'user',
    plan: invite.plan,
    keyword_bonus: invite.keyword_bonus,
    onboarding_completed: false,
  }).returning();
  await db.insert(settings).values({ user_id: created.id }).onConflictDoNothing();
  await markInviteAccepted(invite.id);
  const authUser = { id: created.id, username: created.username, role: created.role };
  res.status(201).json({ token: signToken(authUser), user: authUser });
});

// POST /api/auth/logout (stateless — client drops the token)
authRouter.post('/logout', (_req, res: Response) => {
  res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (req: AuthedRequest, res: Response) => {
  const user = await buildMePayload(req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  res.json({ user });
});

// POST /api/auth/onboarding/complete
// Markiert die Interessen-Abfrage als erledigt. Serverseitig persistiert, damit
// sie genau einmal (nach der ersten Anmeldung) erscheint — geräteübergreifend.
authRouter.post('/onboarding/complete', authMiddleware, async (req: AuthedRequest, res: Response) => {
  await db.update(users)
    .set({ onboarding_completed: true })
    .where(eq(users.id, req.user!.id));
  res.json({ success: true });
});
