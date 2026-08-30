/**
 * Everything that reads or writes a student's account.
 *
 * Replaces models/User.js. The behaviour mongoose used to provide implicitly
 * lives here explicitly: the password is hashed on the way in, the private
 * columns are stripped on the way out, and the refresh tokens live in their own
 * table instead of an embedded array.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, queryOne, transaction } = require('./pool');
const { toApi, toApiList, buildSet, isUuid } = require('./rows');
const { DEFAULT_CATEGORIES } = require('../config/constants');

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Columns that must never reach the client. */
const PRIVATE = ['password', 'reset_password_token', 'reset_password_expires', 'token_version'];

// Everything except the password, which is only fetched where it is compared.
const PUBLIC_COLUMNS = `
  id, name, email, monthly_income, currency, university, hostel_name,
  custom_categories, theme, onboarding_completed, token_version,
  last_expense_reminder_at, created_at, updated_at
`;

/**
 * A user as the API returns it. The private columns are dropped here rather
 * than left to each controller, which is what userSchema.toJSON used to do.
 */
const toPublicUser = (user) => {
  if (!user) return null;
  const out = { ...user };
  delete out.password;
  delete out.resetPasswordToken;
  delete out.resetPasswordExpires;
  delete out.tokenVersion;
  return out;
};

/* ------------------------------- lookups ---------------------------- */

const findByEmail = async (email, { withPassword = false } = {}) => {
  const row = await queryOne(
    `SELECT ${PUBLIC_COLUMNS}${withPassword ? ', password' : ''}
       FROM users WHERE lower(email) = lower($1)`,
    [String(email || '')]
  );
  return toApi(row);
};

const findById = async (id, { withPassword = false } = {}) => {
  if (!isUuid(id)) return null;
  const row = await queryOne(
    `SELECT ${PUBLIC_COLUMNS}${withPassword ? ', password' : ''} FROM users WHERE id = $1`,
    [id]
  );
  return toApi(row);
};

/** Every user, for the nightly alert sweep. */
const findAllForAlerts = async () => {
  const rows = await query(
    `SELECT id, name, currency, monthly_income, last_expense_reminder_at FROM users`
  );
  return toApiList(rows);
};

/* ------------------------------ creation ---------------------------- */

const create = async ({
  name,
  email,
  password,
  monthlyIncome = 0,
  currency = 'INR',
  university = '',
  hostelName = '',
}) => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const row = await queryOne(
    `INSERT INTO users (name, email, password, monthly_income, currency, university, hostel_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_COLUMNS}`,
    [
      String(name).trim(),
      String(email).trim().toLowerCase(),
      hash,
      monthlyIncome || 0,
      String(currency || 'INR').toUpperCase(),
      university || '',
      hostelName || '',
    ]
  );
  return toApi(row);
};

/* ------------------------------ passwords --------------------------- */

const comparePassword = (candidate, hash) => bcrypt.compare(candidate, hash || '');

/**
 * Sets a new password and invalidates every existing session: the version bump
 * kills tokens that still verify, and dropping the rows kills the rest.
 */
const setPassword = async (userId, newPassword) => {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  return transaction(async (tx) => {
    const row = await tx.queryOne(
      `UPDATE users
          SET password = $2,
              token_version = token_version + 1,
              reset_password_token = NULL,
              reset_password_expires = NULL,
              updated_at = now()
        WHERE id = $1
        RETURNING ${PUBLIC_COLUMNS}`,
      [userId, hash]
    );
    await tx.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    return toApi(row);
  });
};

/* --------------------------- password reset ------------------------- */

/** Creates a reset token: the raw value is e-mailed, only the hash is stored. */
const createPasswordResetToken = async (userId) => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  await query(
    `UPDATE users
        SET reset_password_token = $2, reset_password_expires = $3, updated_at = now()
      WHERE id = $1`,
    [userId, hashed, new Date(Date.now() + RESET_TOKEN_TTL_MS)]
  );
  return raw;
};

/** The account a still-valid reset token belongs to, if any. */
const findByResetToken = async (hashedToken) => {
  const row = await queryOne(
    `SELECT ${PUBLIC_COLUMNS} FROM users
      WHERE reset_password_token = $1 AND reset_password_expires > now()`,
    [hashedToken]
  );
  return toApi(row);
};

/* --------------------------- refresh tokens ------------------------- */

/**
 * Records a refresh token hash, drops the ones that have expired, and keeps at
 * most `max` devices signed in by discarding the oldest.
 */
const addRefreshToken = async (userId, tokenHash, expiresAt, max) =>
  transaction(async (tx) => {
    await tx.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= now()`,
      [userId]
    );
    await tx.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO NOTHING`,
      [userId, tokenHash, expiresAt]
    );
    await tx.query(
      `DELETE FROM refresh_tokens
        WHERE user_id = $1
          AND id NOT IN (
            SELECT id FROM refresh_tokens WHERE user_id = $1
             ORDER BY created_at DESC LIMIT $2
          )`,
      [userId, max]
    );
  });

/** True when this exact token is still one the server recognises. */
const hasRefreshToken = async (userId, tokenHash) => {
  const row = await queryOne(
    `SELECT 1 AS ok FROM refresh_tokens
      WHERE user_id = $1 AND token_hash = $2 AND expires_at > now()`,
    [userId, tokenHash]
  );
  return Boolean(row);
};

const removeRefreshToken = async (userId, tokenHash) => {
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2`, [
    userId,
    tokenHash,
  ]);
};

/** Signs every device out: forget the stored tokens and invalidate the rest. */
const revokeAllSessions = async (userId) =>
  transaction(async (tx) => {
    await tx.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    await tx.query(
      `UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1`,
      [userId]
    );
  });

/* ------------------------------- profile ---------------------------- */

/** Applies a partial profile update. Unknown keys are ignored by design. */
const updateProfile = async (userId, patch) => {
  const columns = {
    name: patch.name,
    monthly_income: patch.monthlyIncome,
    currency: patch.currency === undefined ? undefined : String(patch.currency).toUpperCase(),
    university: patch.university,
    hostel_name: patch.hostelName,
    theme: patch.theme,
    onboarding_completed: patch.onboardingCompleted,
    custom_categories: patch.customCategories,
    last_expense_reminder_at: patch.lastExpenseReminderAt,
  };

  const { fragment, values, next } = buildSet(columns);
  if (!fragment) return findById(userId);

  const row = await queryOne(
    `UPDATE users SET ${fragment}, updated_at = now()
      WHERE id = $${next} RETURNING ${PUBLIC_COLUMNS}`,
    [...values, userId]
  );
  return toApi(row);
};

/** Every category this user can pick from. */
const allCategories = (user) => [...DEFAULT_CATEGORIES, ...((user && user.customCategories) || [])];

const remove = async (userId) => {
  // Every child table is ON DELETE CASCADE, so one statement is enough.
  const rows = await query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  return rows.length > 0;
};

module.exports = {
  toPublicUser,
  findByEmail,
  findById,
  findAllForAlerts,
  create,
  comparePassword,
  setPassword,
  createPasswordResetToken,
  findByResetToken,
  addRefreshToken,
  hasRefreshToken,
  removeRefreshToken,
  revokeAllSessions,
  updateProfile,
  allCategories,
  remove,
  PRIVATE,
};
