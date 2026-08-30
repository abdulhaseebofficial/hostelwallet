/**
 * Notes from students about the app itself. Replaces models/Feedback.js.
 *
 * The row is kept even when the e-mail to the developer cannot be sent, which
 * is the normal case with no SMTP configured - the feedback is not lost just
 * because the mail hop is unavailable. `emailed` records which happened.
 */

const { query, queryOne } = require('./pool');
const { toApi, toApiList } = require('./rows');

const create = async (userId, { type, rating, message, page }) => {
  const row = await queryOne(
    `INSERT INTO feedback (user_id, type, rating, message, page)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type || 'General', rating || null, String(message).trim(), page || '']
  );
  return toApi(row);
};

/** Records that the developer e-mail actually went out. */
const markEmailed = async (id) => {
  const row = await queryOne(
    `UPDATE feedback SET emailed = true, updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return toApi(row);
};

/** What this student has already sent, newest first. */
const listForUser = async (userId, limit = 20) => {
  const rows = await query(
    `SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [userId, limit]
  );
  return toApiList(rows);
};

module.exports = { create, markEmailed, listForUser };
