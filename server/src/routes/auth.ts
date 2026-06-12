import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { and, count, eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users, watch_items } from '../db/schema';
import { authMiddleware, signToken, AuthedRequest } from '../middleware/auth';
import { entitlementsFor } from '../lib/entitlements';

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
