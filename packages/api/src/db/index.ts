import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.connectionString,
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
