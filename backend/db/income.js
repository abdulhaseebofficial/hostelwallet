/**
 * Income reads and writes. Replaces models/Income.js.
 */

const { query, queryOne } = require('./pool');
const { toApi, toApiList, buildSet, isUuid } = require('./rows');
const { startOfMonth, endOfMonth } = require('../utils/calculations');

/** Turns the query string into a WHERE clause and its parameters. */
const buildWhere = (userId, q = {}) => {
  const clauses = ['user_id = $1'];
  const values = [userId];
  let n = 2;

  const { month, year, from, to, source } = q;

  if (month && year) {
    clauses.push(`date >= $${n} AND date <= $${n + 1}`);
    values.push(startOfMonth(Number(year), Number(month)), endOfMonth(Number(year), Number(month)));
    n += 2;
  } else {
    if (from) {
      clauses.push(`date >= $${n}`);
      values.push(new Date(from));
      n += 1;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      clauses.push(`date <= $${n}`);
      values.push(end);
      n += 1;
    }
  }

  if (source) {
    clauses.push(`source = $${n}`);
    values.push(source);
    n += 1;
  }

  return { where: clauses.join(' AND '), values, next: n };
};

/** The filtered list plus its total, newest first. */
const list = async (userId, q = {}) => {
  const { where, values } = buildWhere(userId, q);

  const [items, summary] = await Promise.all([
    query(`SELECT * FROM income WHERE ${where} ORDER BY date DESC, id DESC`, values),
    queryOne(`SELECT COALESCE(sum(amount), 0) AS sum FROM income WHERE ${where}`, values),
  ]);

  return { items: toApiList(items), total: Math.round(Number(summary.sum) * 100) / 100 };
};

/** This month's income grouped by where it came from, biggest first. */
const totalsBySource = async (userId, from, to) => {
  const rows = await query(
    `SELECT source, sum(amount) AS total
       FROM income
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      GROUP BY source
      ORDER BY total DESC`,
    [userId, from, to]
  );
  return rows.map((r) => ({ source: r.source, total: Number(r.total) }));
};

const findById = async (id, userId) => {
  if (!isUuid(id)) return null;
  const row = await queryOne(`SELECT * FROM income WHERE id = $1 AND user_id = $2`, [id, userId]);
  return toApi(row);
};

const create = async (userId, data) => {
  const row = await queryOne(
    `INSERT INTO income (user_id, amount, source, note, date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, data.amount, data.source || 'Pocket Money', data.note || '', data.date]
  );
  return toApi(row);
};

const update = async (id, userId, patch) => {
  const { fragment, values, next } = buildSet({
    amount: patch.amount,
    source: patch.source,
    note: patch.note,
    date: patch.date,
  });
  if (!fragment) return findById(id, userId);

  const row = await queryOne(
    `UPDATE income SET ${fragment}, updated_at = now()
      WHERE id = $${next} AND user_id = $${next + 1} RETURNING *`,
    [...values, id, userId]
  );
  return toApi(row);
};

const remove = async (id, userId) => {
  if (!isUuid(id)) return false;
  const rows = await query(`DELETE FROM income WHERE id = $1 AND user_id = $2 RETURNING id`, [
    id,
    userId,
  ]);
  return rows.length > 0;
};

/** Every income row this student has, for the export. */
const listAllForUser = async (userId) => {
  const rows = await query(
    `SELECT * FROM income WHERE user_id = $1 ORDER BY date DESC, id DESC`,
    [userId]
  );
  return toApiList(rows);
};

module.exports = { list, totalsBySource, findById, create, update, remove, listAllForUser };
