import { Router, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import {
  BillingError, createCheckoutSession, createPortalSession, planCatalog, stripeEnabled,
} from '../services/stripe';
import { PlanTier } from '../lib/entitlements';

export const billingRouter = Router();
billingRouter.use(authMiddleware);

// GET /api/billing/plans — Tarif-Katalog + ob Bezahlung aktiv ist
billingRouter.get('/plans', (_req, res: Response) => {
  res.json({ enabled: stripeEnabled(), plans: planCatalog() });
});

// POST /api/billing/checkout { plan: 'plus' | 'pro' } → Stripe-Checkout-URL
billingRouter.post('/checkout', async (req: AuthedRequest, res: Response) => {
  const plan = req.body?.plan as PlanTier;
  if (plan !== 'plus' && plan !== 'pro') {
    res.status(400).json({ error: 'Ungültiger Tarif' });
    return;
  }
  if (!stripeEnabled()) {
    res.status(503).json({ error: 'Zahlungen sind noch nicht aktiviert' });
    return;
  }
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  try {
    res.json({ url: await createCheckoutSession(user, plan) });
  } catch (err) {
    if (err instanceof BillingError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});

// POST /api/billing/portal → Stripe-Kundenportal-URL (Abo verwalten/kündigen)
billingRouter.post('/portal', async (req: AuthedRequest, res: Response) => {
  if (!stripeEnabled()) {
    res.status(503).json({ error: 'Zahlungen sind noch nicht aktiviert' });
    return;
  }
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: 'Benutzer nicht gefunden' });
    return;
  }
  try {
    res.json({ url: await createPortalSession(user) });
  } catch (err) {
    if (err instanceof BillingError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});
