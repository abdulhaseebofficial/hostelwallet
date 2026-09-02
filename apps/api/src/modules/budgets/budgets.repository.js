/**
 * Budget limits. Replaces models/Budget.js.
 *
 * `limit` is a reserved word in SQL, so the column is quoted everywhere. The
 * unique index on (user_id, year, month, category) is what makes the upserts
 * below safe against two requests arriving at once.
 */

const { query, queryOne } = require('../../infrastructure/database/pool');
const { toApi, toApiList, isUuid } = require('../../infrastructure/database/rows');

/** Every limit for one month. */
const listForPeriod = async (userId, month, year) => {
  const rows = await query(
    `SELECT id, user_id, category, "limit", month, year, created_at, updated_at
       FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3
       ORDER BY category`,
    [userId, month, year]
  );
  return toApiList(rows);
};

const findById = async (id, userId) => {
  if (!isUuid(id)) return null;
  const row = await queryOne(
    `SELECT id, user_id, category, "limit", month, year, created_at, updated_at
       FROM budgets WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return toApi(row);
};

/**
 * Sets a limit, replacing any existing one for that category and month -
 * the same "upsert" the old findOneAndUpdate({ upsert: true }) gave.
 */
const upsert = async (userId, category, limit, month, year) => {
  const row = await queryOne(
    `INSERT INTO budgets (user_id, category, "limit", month, year)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, year, month, category)
       DO UPDATE SET "limit" = EXCLUDED."limit", updated_at = now()
     RETURNING id, user_id, category, "limit", month, year, created_at, updated_at`,
    [userId, category, limit, month, year]
  );
  return toApi(row);
};

/**
 * Saves a whole plan in one statement - used by the "apply AI budget" button.
 * Returns how many rows were written.
 */
const upsertMany = async (userId, items, month, year) => {
  if (!items.length) return 0;

  // One multi-row INSERT rather than a statement per category.
  const values = [userId, month, year];
  const tuples = items.map((item, i) => {
    values.push(item.category, Number(item.limit));
    return `($1, $${4 + i * 2}, $${5 + i * 2}, $2, $3)`;
  });

  const rows = await query(
    `INSERT INTO budgets (user_id, category, "limit", month, year)
     VALUES ${tuples.join(', ')}
     ON CONFLICT (user_id, year, month, category)
       DO UPDATE SET "limit" = EXCLUDED."limit", updated_at = now()
     RETURNING id`,
    values
  );
  return rows.length;
};

const update = async (id, userId, limit) => {
  const row = await queryOne(
    `UPDATE budgets SET "limit" = $3, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, category, "limit", month, year, created_at, updated_at`,
    [id, userId, limit]
  );
  return toApi(row);
};

const remove = async (id, userId) => {
  if (!isUuid(id)) return false;
  const rows = await query(`DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id`, [
    id,
    userId,
  ]);
  return rows.length > 0;
};

/** How many budgets still use a category - blocks deleting one in use. */
const countByCategory = async (userId, category) => {
  const row = await queryOne(
    `SELECT count(*)::bigint AS n FROM budgets WHERE user_id = $1 AND category = $2`,
    [userId, category]
  );
  return Number(row.n);
};

/** Every budget this student has, for the export. */
const listAllForUser = async (userId) => {
  const rows = await query(
    `SELECT id, user_id, category, "limit", month, year, created_at, updated_at
       FROM budgets WHERE user_id = $1 ORDER BY year DESC, month DESC, category`,
    [userId]
  );
  return toApiList(rows);
};

module.exports = {
  listForPeriod,
  findById,
  upsert,
  upsertMany,
  update,
  remove,
  countByCategory,
  listAllForUser,
};
