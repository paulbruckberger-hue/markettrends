import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { config } from '../config';
import { PlanTier, PLAN_LABEL, PLAN_PRICE_EUR, PLAN_QUOTA } from '../lib/entitlements';

/**
 * Stripe-Anbindung (Abo-Bezahlung). Lazy initialisiert wie telegram/mailer:
 * ohne STRIPE_SECRET_KEY sind die Billing-Endpunkte deaktiviert und die App
 * läuft normal weiter (Upgrade meldet dann „noch nicht aktiviert").
 *
 * Hinweis zu den Typen: das stripe-Paket exportiert in CommonJS einen callable
 * Constructor (keine top-level `Stripe.Event`-Namespace-Typen). Daher leiten wir
 * die nötigen Objekt-Typen aus der Client-Instanz ab — versions-robust.
 */

export class BillingError extends Error {}

type StripeClient = InstanceType<typeof Stripe>;
type StripeEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;
type StripeSubscription = Awaited<ReturnType<StripeClient['subscriptions']['retrieve']>>;
type StripeCheckoutSession = Awaited<ReturnType<StripeClient['checkout']['sessions']['retrieve']>>;

let stripe: StripeClient | null = null;

export function stripeEnabled(): boolean {
  return !!config.stripeSecretKey;
}

function getStripe(): StripeClient {
  if (!config.stripeSecretKey) throw new BillingError('Zahlungen sind noch nicht aktiviert');
  if (!stripe) stripe = new Stripe(config.stripeSecretKey);
  return stripe;
}

type DbUser = typeof users.$inferSelect;

/** Stripe-Price-ID für einen kostenpflichtigen Plan (oder null). */
function priceForPlan(plan: PlanTier): string | null {
  if (plan === 'plus') return config.stripePricePlus || null;
  if (plan === 'pro') return config.stripePricePro || null;
  return null;
}

/** Umkehrung: Stripe-Price-ID → Plan. */
function planForPrice(priceId: string | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === config.stripePricePlus) return 'plus';
  if (priceId === config.stripePricePro) return 'pro';
  return null;
}

function clientBase(): string {
  return (config.clientUrl || '').replace(/\/+$/, '');
}

/** Tarif-Katalog für die UI (GET /api/billing/plans). */
export function planCatalog() {
  return [
    { id: 'free' as PlanTier, label: PLAN_LABEL.free, price_eur: 0, quota: PLAN_QUOTA.free, purchasable: false },
    { id: 'plus' as PlanTier, label: PLAN_LABEL.plus, price_eur: PLAN_PRICE_EUR.plus, quota: PLAN_QUOTA.plus, purchasable: !!config.stripePricePlus },
    { id: 'pro' as PlanTier, label: PLAN_LABEL.pro, price_eur: PLAN_PRICE_EUR.pro, quota: PLAN_QUOTA.pro, purchasable: !!config.stripePricePro },
  ];
}

/** Stripe-Customer sicherstellen (und auf dem User persistieren). */
export async function ensureCustomer(user: DbUser): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await getStripe().customers.create({
    email: user.email ?? undefined,
    metadata: { user_id: user.id },
  });
  await db.update(users).set({ stripe_customer_id: customer.id }).where(eq(users.id, user.id));
  return customer.id;
}

/** Checkout-Session (Abo) erstellen → Weiterleitungs-URL. */
export async function createCheckoutSession(user: DbUser, plan: PlanTier): Promise<string> {
  const price = priceForPlan(plan);
  if (!price) throw new BillingError('Für diesen Tarif ist kein Stripe-Preis hinterlegt');
  const customer = await ensureCustomer(user);
  const base = clientBase();
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${base}/?billing=success`,
    cancel_url: `${base}/?billing=cancel`,
  });
  if (!session.url) throw new BillingError('Checkout konnte nicht gestartet werden');
  return session.url;
}

/** Stripe-Kundenportal (Abo verwalten/kündigen) → URL. */
export async function createPortalSession(user: DbUser): Promise<string> {
  if (!user.stripe_customer_id) throw new BillingError('Noch kein Abo vorhanden');
  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${clientBase()}/?billing=portal`,
  });
  return session.url;
}

/** Webhook-Signatur prüfen + Event parsen. */
export function constructEvent(rawBody: Buffer, signature: string): StripeEvent {
  if (!config.stripeWebhookSecret) throw new BillingError('Webhook-Secret fehlt');
  return getStripe().webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}

function subPeriodEnd(sub: StripeSubscription): Date | null {
  // Je nach API-Version liegt das Periodenende top-level oder am Item.
  const ts = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  return typeof ts === 'number' ? new Date(ts * 1000) : null;
}

/** Abo-Status aus Stripe auf den User spiegeln (Quelle der Wahrheit = Stripe). */
async function syncFromSubscription(sub: StripeSubscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const [user] = await db.select().from(users).where(eq(users.stripe_customer_id, customerId));
  if (!user) return;
  const active = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  const plan: PlanTier = active ? (planForPrice(sub.items.data[0]?.price?.id) ?? user.plan) : 'free';
  await db.update(users).set({
    plan,
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    current_period_end: subPeriodEnd(sub),
  }).where(eq(users.id, user.id));
}

/** Eingehendes Stripe-Event verarbeiten. */
export async function handleEvent(event: StripeEvent): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as StripeCheckoutSession;
      if (session.subscription) {
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const sub = await getStripe().subscriptions.retrieve(subId);
        await syncFromSubscription(sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncFromSubscription(event.data.object as StripeSubscription);
      break;
    }
    default:
      break;
  }
}
