/**
 * Where the Postgres connection string comes from.
 *
 * `DATABASE_URL` is the name Vercel's Neon integration writes when you
 * provision a database from the marketplace - it names the variable itself and
 * you never get to choose. `POSTGRES_URL` is the other name that same
 * integration sets, and is accepted so a project wired up by hand still works.
 * An explicitly set DATABASE_URL always wins.
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
  'No Postgres connection string. Set DATABASE_URL (or POSTGRES_URL, which ' +
  "Vercel's Neon integration sets for you). Locally: run `vercel env pull " +
  '.env.production.local --environment=production`, or copy backend/.env.example to backend/.env';

module.exports = { databaseUrl, DATABASE_URL_MISSING };
