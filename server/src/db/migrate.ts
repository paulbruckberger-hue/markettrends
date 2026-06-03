import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client';

/**
 * Applies all pending Drizzle migrations. Idempotent — Drizzle tracks applied
 * migrations in __drizzle_migrations, so calling this on every container start
 * is safe and a no-op once up to date.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  console.log(`[migrate] applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] done.');
}

// Standalone entrypoint: `npm run db:migrate`
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
