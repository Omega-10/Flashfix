import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDbUrl } from './env.ts';

let pool: Pool | null = null;

/**
 * Returns the singleton Neon PostgreSQL Pool, or null if DATABASE_URL is not configured.
 */
export function getPool(): Pool | null {
  const dbUrl = getDbUrl();
  if (!dbUrl) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle Neon PostgreSQL client:', err);
    });
  }

  return pool;
}

/**
 * Executes a query using the pooled connection.
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const p = getPool();
  if (!p) {
    throw new Error('Database connection unavailable: DATABASE_URL is not configured.');
  }
  return p.query<R>(text, params);
}

/**
 * Executes a callback within an atomic transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 */
export async function runTx<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error('Database connection unavailable: DATABASE_URL is not configured.');
  }

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error during transaction rollback:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
