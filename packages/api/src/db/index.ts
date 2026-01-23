import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

// Check if using cloud database (requires SSL)
const isCloudDB = config.database.connectionString.includes('supabase.co') ||
                  config.database.connectionString.includes('supabase.com') ||
                  config.database.connectionString.includes('neon.tech');

export const pool = new Pool({
  connectionString: config.database.connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: false } : false,
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
  }

  return result;
}

export async function getClient() {
  return pool.connect();
}
