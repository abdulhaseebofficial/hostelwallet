/**
 * Applies db/schema.sql.  `npm run migrate`
 *
 * The schema is written to be idempotent, so this is safe to run against a
 * database that is already up to date - which is what makes it usable as a
 * deploy step and as the first thing a new clone runs.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getPool, closePool } = require('./pool');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Runs the whole file in one transaction: either the database ends up with the
 * complete schema or it is left exactly as it was.
 */
const migrate = async () => {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Two functions starting at once would otherwise race on CREATE TABLE and
    // can deadlock. The lock is transaction-scoped, so it is released by the
    // COMMIT or ROLLBACK below whatever happens. The number is arbitrary but
    // must be the same in every process.
    await client.query('SELECT pg_advisory_xact_lock($1)', [4711001]);
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/** The tables the app expects, for the summary line and for the QA suite. */
const tableNames = async () => {
  const { rows } = await getPool().query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );
  return rows.map((r) => r.table_name);
};

if (require.main === module) {
  migrate()
    .then(tableNames)
    .then((tables) => {
      console.log(`[migrate] schema applied - ${tables.length} tables: ${tables.join(', ')}`);
    })
    .catch((err) => {
      console.error('[migrate] failed:', err.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}

module.exports = { migrate, tableNames };
