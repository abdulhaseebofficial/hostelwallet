/**
 * Where the Postgres connection string comes from.
 *
 * Both names are accepted because the marketplace integrations disagree about
 * which one to write, and you never get to choose: Vercel's Supabase
 * integration sets only `POSTGRES_URL`, while Neon sets `DATABASE_URL` as well.
 * Accepting both means the app follows whichever database is connected without
 * a code change. An explicitly set DATABASE_URL always wins.
 *
 * Kept in its own module because the pool and the environment validator both
 * need this answer, and two copies of it would eventually disagree.
 */
const DATABASE_URL_VARS = ['DATABASE_URL', 'POSTGRES_URL'];

/**
 * Migrations prefer a direct connection.
 *
 * Supabase's POSTGRES_URL points at the pooler in transaction mode, which is
 * right for ordinary queries and wrong for DDL: a pooled connection can be
 * handed to another client between statements, and migrations want one session
 * that holds its advisory lock from BEGIN to COMMIT. Supabase publishes the
 * direct connection as POSTGRES_URL_NON_POOLING; DIRECT_URL is the name other
 * tools use for the same thing. Either is used when present, and everything
 * falls back to the ordinary string when neither is - which is the case on Neon
 * and locally, where the normal connection is already a real session.
 */
const DIRECT_URL_VARS = ['DIRECT_URL', 'POSTGRES_URL_NON_POOLING'];

const firstSet = (names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
};

/** The connection string, or undefined when none of the names are set. */
const databaseUrl = () => firstSet(DATABASE_URL_VARS);

/** The connection string migrations should use. */
const migrationUrl = () => firstSet(DIRECT_URL_VARS) || databaseUrl();

/** The message shown when nothing is configured, listing both accepted names. */
const DATABASE_URL_MISSING =
  'No Postgres connection string. Set POSTGRES_URL or DATABASE_URL, which ' +
  "the Vercel Supabase and Neon integrations set for you. Locally: run `vercel env pull " +
  '.env.production.local --environment=production`, or copy apps/api/.env.example to apps/api/.env';

module.exports = { databaseUrl, migrationUrl, DATABASE_URL_MISSING };
