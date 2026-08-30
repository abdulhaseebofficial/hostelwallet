const { query } = require('../db/pool');
const { migrate } = require('../db/migrate');
const { databaseUrl, DATABASE_URL_MISSING } = require('./databaseUrl');

/**
 * Open the database and make sure the schema is there.
 *
 * The schema is applied on connect rather than as a separate deploy step
 * because there is no deploy step to hang it off: Vercel imports the app and
 * serves it. db/schema.sql is idempotent and takes an advisory lock, so this
 * costs one cheap round trip on a cold start and is safe when several
 * functions start at once.
 */
const connectDB = async () => {
  if (!databaseUrl()) {
    throw new Error(DATABASE_URL_MISSING);
  }

  const [{ db, version }] = await query(
    `SELECT current_database() AS db, current_setting('server_version') AS version`
  );

  await migrate();

  // The host comes from the URL rather than inet_server_addr(), which reports
  // the pooler's own loopback address and tells you nothing useful.
  const host = new URL(databaseUrl()).host;
  console.log(`[db] Postgres ${version} connected: ${host}/${db}`);
  return { db, host };
};

module.exports = connectDB;
