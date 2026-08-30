/**
 * The one Postgres connection pool, plus the two helpers every repository uses.
 *
 * `pg` is enough here: Neon speaks ordinary Postgres over TLS, so the same
 * driver works for `npm run dev` locally and for the function on Vercel. The
 * pool is created lazily so importing a repository never opens a socket - the
 * health check has to answer even when the database is unreachable.
 */

const { Pool, types } = require('pg');
const { databaseUrl, DATABASE_URL_MISSING } = require('../config/databaseUrl');

/**
 * `pg` hands back BIGINT (20) and NUMERIC (1700) as strings to protect
 * precision. Every amount in this app is a JavaScript number - that is what
 * mongoose stored and what the API has always returned - so parse them back.
 * Counts from COUNT(*) are small enough that Number is exact.
 */
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

let pool = null;

/** The pool, created on first use. */
const getPool = () => {
  if (!pool) {
    const uri = databaseUrl();
    if (!uri) throw new Error(DATABASE_URL_MISSING);

    pool = new Pool({
      connectionString: uri,
      // Neon presents a publicly trusted certificate, so verify it. Only a
      // database on this machine is allowed to skip TLS - there is no network
      // to eavesdrop on, and local Postgres usually has no certificate at all.
      ssl: /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(uri) ? false : { rejectUnauthorized: true },
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // A pool error with no listener would take the whole process down.
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  return pool;
};

/** One query. Returns the rows, since that is all any caller wants. */
const query = async (text, params) => {
  const result = await getPool().query(text, params);
  return result.rows;
};

/** The first row, or undefined. */
const queryOne = async (text, params) => {
  const rows = await query(text, params);
  return rows[0];
};

/**
 * Runs `fn` inside a transaction on a single client, rolling back on throw.
 * Used where two writes must not be observed apart - contributing to a goal,
 * rotating a refresh token, deleting an account.
 */
const transaction = async (fn) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const scoped = {
      query: async (text, params) => (await client.query(text, params)).rows,
      queryOne: async (text, params) => (await client.query(text, params)).rows[0],
    };
    const result = await fn(scoped);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/** True when a live connection can be opened and answers. */
const isConnected = async () => {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

const closePool = async () => {
  if (pool) {
    const closing = pool;
    pool = null;
    await closing.end().catch(() => {});
  }
};

module.exports = { getPool, query, queryOne, transaction, isConnected, closePool };
