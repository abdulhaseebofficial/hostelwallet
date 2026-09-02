/**
 * The refresh_tokens table.
 *
 * Only hashes are stored, one row per signed-in device, so a database dump
 * yields no usable session. A token that verifies cryptographically but has no
 * row here has already been rotated - see auth.service for what that means.
 *
 * revokeAllSessions is deliberately NOT here: it deletes these rows *and*
 * bumps the account's token_version in one transaction, which makes it an
 * operation on the account rather than on this table. It lives with users, and
 * auth reaches it through users.service.
 */

const { query, queryOne, transaction } = require('../../infrastructure/database/pool');

/**
 * Records one session, prunes expired rows, and keeps only the newest `max`
 * so a student cannot accumulate sessions without limit.
 */
const addRefreshToken = async (userId, tokenHash, expiresAt, max) =>
  transaction(async (tx) => {
    await tx.query(`DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= now()`, [
      userId,
    ]);
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

module.exports = { addRefreshToken, hasRefreshToken, removeRefreshToken };
