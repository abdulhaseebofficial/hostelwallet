/**
 * Fail fast on a dangerous configuration instead of booting into it.
 *
 * The rule everywhere below is DEFAULT-DENY: if NODE_ENV is not set we treat
 * the process as production. Forgetting to set it must never be the thing that
 * turns on debug output or leaks a password-reset token.
 */

const { databaseUrl, DATABASE_URL_MISSING } = require('./databaseUrl');

const PLACEHOLDERS = [
  'change_me_access_secret',
  'change_me_refresh_secret',
  'change_me',
  'secret',
  'changeme',
];

const MIN_SECRET_LENGTH = 32;

/** True unless NODE_ENV explicitly says otherwise. */
const isProduction = () => process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';

/** Debug output (stack traces, dev reset links) is opt-in, never the default. */
const isDevelopment = () => process.env.NODE_ENV === 'development';

const checkSecret = (name, errors, warnings) => {
  const value = process.env[name];

  if (!value) {
    errors.push(`${name} is not set. Generate one: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
    return;
  }
  if (PLACEHOLDERS.includes(value.toLowerCase())) {
    errors.push(`${name} is still the placeholder from .env.example. Replace it with a real random value.`);
    return;
  }
  if (value.length < MIN_SECRET_LENGTH) {
    const message = `${name} is only ${value.length} characters; use at least ${MIN_SECRET_LENGTH}.`;
    if (isProduction()) errors.push(message);
    else warnings.push(message);
  }
};

/**
 * Validates the environment. Throws in production, warns in development, so a
 * student running locally is never blocked but a real deployment cannot start
 * with a guessable signing key.
 */
const validateEnv = () => {
  const errors = [];
  const warnings = [];

  checkSecret('JWT_ACCESS_SECRET', errors, warnings);
  checkSecret('JWT_REFRESH_SECRET', errors, warnings);

  if (process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  if (!databaseUrl()) {
    errors.push(DATABASE_URL_MISSING);
  }

  if (isProduction()) {
    if (!process.env.NODE_ENV) {
      warnings.push('NODE_ENV is not set; treating this process as production.');
    }
    if (!process.env.CLIENT_URL) {
      warnings.push('CLIENT_URL is not set, so CORS only allows http://localhost:5173.');
    }
    if (process.env.ALLOW_DEV_RESET_LINK === 'true') {
      errors.push('ALLOW_DEV_RESET_LINK must never be enabled outside local development.');
    }
  }

  warnings.forEach((w) => console.warn(`[config] warning: ${w}`));

  if (errors.length) {
    const detail = errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(`Refusing to start, the configuration is unsafe:\n${detail}\n`);
  }

  console.log(`[config] validated (${isProduction() ? 'production' : process.env.NODE_ENV} mode)`);
};

module.exports = { validateEnv, isProduction, isDevelopment };
