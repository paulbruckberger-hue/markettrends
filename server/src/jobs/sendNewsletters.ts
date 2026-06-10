import { and, eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { settings, users } from '../db/schema';
import { sendDueNewsletters } from '../services/newsletter';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Newsletter job entrypoint (`node dist/jobs/sendNewsletters.js`). Runs daily.
 * Loads EVERY enabled recipient (not just those whose day is today) and lets
 * sendDueNewsletters() decide what is due: the combined weekly mail only on the
 * user's chosen day, plus any separate cluster mails on their own cadence.
 */
async function main(): Promise<void> {
  const today = DAYS[new Date().getDay()];
  const recipients = await db.select({ user_id: settings.user_id })
    .from(settings)
    .innerJoin(users, eq(users.id, settings.user_id))
    .where(and(
      eq(settings.newsletter_enabled, true),
      eq(users.is_active, true),
    ));

  console.log(`[newsletter-job] ${today}: ${recipients.length} aktive Empfänger werden geprüft`);
  for (const r of recipients) {
    try {
      const sent = await sendDueNewsletters(r.user_id, today);
      console.log(`  user ${r.user_id}: ${sent} Mail(s) gesendet`);
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
