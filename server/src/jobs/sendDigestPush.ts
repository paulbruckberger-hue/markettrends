import { and, eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { settings, users } from '../db/schema';
import { sendDailyBriefing } from '../services/dailyDigest';

const TZ = 'Europe/Vienna';

function viennaYmdHour(d = new Date()): { ymd: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, hour: parseInt(parts.hour, 10) };
}

/**
 * Daily-briefing job — meant to run HOURLY. Sends each user's curated daily
 * Telegram briefing when the current Vienna hour matches their chosen delivery
 * hour and they haven't already received it today. Idempotent per day.
 */
async function main(): Promise<void> {
  const { ymd, hour } = viennaYmdHour();

  const recipients = await db.select({
    user_id: settings.user_id,
    push_hour: settings.daily_push_hour,
    last_sent: settings.daily_push_last_sent,
  })
    .from(settings)
    .innerJoin(users, eq(users.id, settings.user_id))
    .where(and(
      eq(settings.daily_push_enabled, true),
      eq(settings.telegram_connected, true),
      eq(users.is_active, true),
    ));

  let total = 0;
  let processed = 0;
  for (const r of recipients) {
    if (r.push_hour !== hour) continue;
    if (r.last_sent && viennaYmdHour(new Date(r.last_sent)).ymd === ymd) continue; // already today
    processed++;
    try {
      total += await sendDailyBriefing(r.user_id);
    } catch (err) {
      console.error(`[digest-job] user ${r.user_id} Fehler:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[digest-job] ${ymd} ${hour}:00 ${TZ} — ${processed} Empfänger fällig, ${total} Meldungen gesendet`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[digest-job] fatal:', err);
    pool.end().finally(() => process.exit(1));
  });
