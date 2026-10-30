import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl:
    env.NODE_ENV === 'production' ||
    (env.DATABASE_URL && env.DATABASE_URL.includes('sslmode=require'))
      ? { rejectUnauthorized: false }
      : undefined,
});

export const db = drizzle(pool, { schema });
