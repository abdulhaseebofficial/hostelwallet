/**
 * Where the MongoDB connection string comes from.
 *
 * `MONGO_URI` is what this app documents and what `.env.example` uses.
 * `MONGODB_URI` is what Vercel's native MongoDB Atlas integration writes when
 * you provision a cluster from the marketplace - it names the variable itself
 * and you never get to choose. Accepting both means the integration works with
 * nothing set by hand, while an explicitly set MONGO_URI still wins.
 *
 * Kept in its own module because the connector and the environment validator
 * both need this answer, and two copies of it would eventually disagree.
 */
const MONGO_URI_VARS = ['MONGO_URI', 'MONGODB_URI'];

/** The connection string, or undefined when none of the names are set. */
const mongoUri = () => {
  for (const name of MONGO_URI_VARS) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
};

/** The message shown when nothing is configured, listing both accepted names. */
const MONGO_URI_MISSING =
  'No MongoDB connection string. Set MONGO_URI (or MONGODB_URI, which Vercel\'s ' +
  'MongoDB Atlas integration sets for you). Locally: copy backend/.env.example to backend/.env';

module.exports = { mongoUri, MONGO_URI_VARS, MONGO_URI_MISSING };
