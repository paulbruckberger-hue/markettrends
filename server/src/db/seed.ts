import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './client';
import { users, settings, rss_sources, app_config } from './schema';

/**
 * Seed data. Idempotent — uses onConflictDoNothing so repeated container starts
 * never duplicate. Creates the single active MVP user `paul` and a curated set
 * of RSS feeds. Some feeds may be blocked/unreliable; the collector isolates
 * per-feed errors, so a dead feed never breaks a run (it just gets last_error).
 */

const SEED_USER = { username: 'paul', password: 'PaulB1', role: 'admin' };

type FeedSeed = {
  name: string;
  url: string;
  category: string;
  language: string;
};

const RSS_FEEDS: FeedSeed[] = [
  // ---- global_tech ----
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'global_tech', language: 'en' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'global_tech', language: 'en' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'global_tech', language: 'en' },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', category: 'global_tech', language: 'en' },

  // ---- global_finance ----
  { name: 'MarketWatch Top Stories', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', category: 'global_finance', language: 'en' },
  { name: 'CNBC Finance', url: 'https://search.cnbc.com/rss/2.0/feed/originalrssfeeds.xml?partnerId=2000', category: 'global_finance', language: 'en' },

  // ---- global_fintech ----
  { name: 'Finextra', url: 'https://www.finextra.com/rss/headlines.aspx', category: 'global_fintech', language: 'en' },
  { name: 'The Fintech Times', url: 'https://thefintechtimes.com/feed/', category: 'global_fintech', language: 'en' },
  { name: 'PYMNTS', url: 'https://www.pymnts.com/feed/', category: 'global_fintech', language: 'en' },

  // ---- dach ----
  { name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen', category: 'dach', language: 'de' },
  { name: 't3n', url: 'https://t3n.de/rss.xml', category: 'dach', language: 'de' },
  { name: 'Gründerszene', url: 'https://www.businessinsider.de/gruenderszene/feed/', category: 'dach', language: 'de' },

  // ---- austria ----
  { name: 'Der Standard – Wirtschaft', url: 'https://www.derstandard.at/rss/wirtschaft', category: 'austria', language: 'de' },
  { name: 'Die Presse – Wirtschaft', url: 'https://www.diepresse.com/rss/Wirtschaft', category: 'austria', language: 'de' },
  { name: 'Trending Topics', url: 'https://www.trendingtopics.eu/feed/', category: 'austria', language: 'de' },
  { name: 'ORF News', url: 'https://rss.orf.at/news.xml', category: 'austria', language: 'de' },

  // ---- regulatory ----
  { name: 'ECB Press Releases', url: 'https://www.ecb.europa.eu/rss/press.html', category: 'regulatory', language: 'en' },
  { name: 'ESMA News', url: 'https://www.esma.europa.eu/rss.xml', category: 'regulatory', language: 'en' },
];

export async function runSeed(): Promise<void> {
  console.log('[seed] ensuring user + settings + rss feeds ...');

  // ---- User Paul ----
  const password_hash = bcrypt.hashSync(SEED_USER.password, 10);
  await db.insert(users).values({
    username: SEED_USER.username,
    password_hash,
    role: SEED_USER.role,
    is_active: true,
  }).onConflictDoNothing({ target: users.username });

  const [paul] = await db.select().from(users).where(eq(users.username, SEED_USER.username));
  if (!paul) throw new Error('[seed] failed to create/find user paul');

  // ---- Settings for Paul ----
  await db.insert(settings).values({ user_id: paul.id }).onConflictDoNothing();

  // ---- RSS Feeds ----
  for (const feed of RSS_FEEDS) {
    await db.insert(rss_sources).values({
      name: feed.name,
      url: feed.url,
      category: feed.category,
      language: feed.language,
      is_active: true,
    }).onConflictDoNothing({ target: rss_sources.url });
  }

  // ---- App Config (global default row) ----
  await db.insert(app_config).values({ id: 1 }).onConflictDoNothing();

  console.log(`[seed] done. user=${paul.username} feeds=${RSS_FEEDS.length}`);
}

// Standalone entrypoint: `npm run db:seed`
if (require.main === module) {
  runSeed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
