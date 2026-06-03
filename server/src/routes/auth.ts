import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { authMiddleware, signToken, AuthedRequest } from '../middleware/auth';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res: Response) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase().trim()));
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
  const [user] = await db.select({
    id: users.id, username: users.username, role: users.role, email: users.email,
  }).from(users).where(eq(users.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  res.json({ user });
});
