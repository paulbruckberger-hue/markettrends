import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { config } from '../config';

/**
 * Single pg Pool over DATABASE_URL (Supabase Session Pooler, SSL).
 * No Supabase SDK — pure Postgres, so the project stays portable.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
