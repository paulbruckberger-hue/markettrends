import { and, eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { settings, users } from '../db/schema';
import { sendNewsletter } from '../services/newsletter';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Newsletter job entrypoint (`node dist/jobs/sendNewsletters.js`).
 * Runs daily; sends to users whose newsletter_day matches today + enabled.
 */
async function main(): Promise<void> {
  const today = DAYS[new Date().getDay()];
  const recipients = await db.select({ user_id: settings.user_id })
    .from(settings)
    .innerJoin(users, eq(users.id, settings.user_id))
    .where(and(
      eq(settings.newsletter_enabled, true),
      eq(settings.newsletter_day, today),
      eq(users.is_active, true),
    ));

  console.log(`[newsletter-job] ${today}: ${recipients.length} Empfänger`);
  for (const r of recipients) {
    try {
      const sent = await sendNewsletter(r.user_id);
      console.log(`  user ${r.user_id}: ${sent ? 'gesendet' : 'übersprungen'}`);
    } catch (err) {
      console.error(`  user ${r.user_id} Fehler:`, err instanceof Error ? err.message : err);
    }
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[newsletter-job] fatal:', err);
    pool.end().finally(() => process.exit(1));
  });
