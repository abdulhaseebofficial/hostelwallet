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

/** The connection string, or undefined when none of the names are set. */
const databaseUrl = () => {
  for (const name of DATABASE_URL_VARS) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
};

/** The message shown when nothing is configured, listing both accepted names. */
const DATABASE_URL_MISSING =
  'No Postgres connection string. Set POSTGRES_URL or DATABASE_URL, which ' +
  "the Vercel Supabase and Neon integrations set for you. Locally: run `vercel env pull " +
  '.env.production.local --environment=production`, or copy backend/.env.example to backend/.env';

module.exports = { databaseUrl, DATABASE_URL_MISSING };
