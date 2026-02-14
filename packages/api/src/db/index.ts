import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Check if using cloud database (requires SSL)
const isCloudDB = config.database.connectionString.includes('supabase.co') ||
                  config.database.connectionString.includes('supabase.com') ||
                  config.database.connectionString.includes('neon.tech');

export const pool = new Pool({
  connectionString: config.database.connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: true } : false,
  max: config.database.maxConnections,
  idleTimeoutMillis: config.database.idleTimeoutMs,
  connectionTimeoutMillis: config.database.connectionTimeoutMs,
});

// Set search_path to include public schema (needed for Neon)
pool.on('connect', (client) => {
  client.query('SET search_path TO public');
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
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

/**
 * Execute a function within a database transaction.
 * Automatically commits on success, rolls back on error.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down database pool...');
  pool.end().then(() => {
    logger.info('Database pool closed');
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
