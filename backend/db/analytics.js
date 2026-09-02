/**
 * The aggregate queries behind the dashboard, the reports page and the AI
 * advisor. Plain GROUP BY queries, returning a `{ _id, total }` row shape so
 * the pure helpers in utils/calculations.js (shapeCategoryTotals) can stay
 * ignorant of where the numbers came from.
 */

const { query, queryOne } = require('./pool');

/** Total expenses grouped by category, biggest first. */
const categoryTotals = async (userId, from, to) => {
  const rows = await query(
    `SELECT category AS _id, sum(amount) AS total, count(*)::bigint AS count
       FROM expenses
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      GROUP BY category
      ORDER BY total DESC`,
    [userId, from, to]
  );
  return rows.map((r) => ({ _id: r._id, total: Number(r.total), count: Number(r.count) }));
};

/** Total expenses for a date range. */
const totalSpent = async (userId, from, to) => {
  const row = await queryOne(
    `SELECT COALESCE(sum(amount), 0) AS total FROM expenses
      WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, from, to]
  );
  return Number(row.total);
};

/** Total logged income for a date range. */
const totalIncome = async (userId, from, to) => {
  const row = await queryOne(
    `SELECT COALESCE(sum(amount), 0) AS total FROM income
      WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, from, to]
  );
  return Number(row.total);
};

/**
 * Spend per day, keyed 'YYYY-MM-DD'.
 *
 * The grouping has to happen in the same timezone the rest of the app counts
 * days in, otherwise the zero-filled trend drifts by a day. `offsetMinutes` is
 * the server's own UTC offset: shifting the stored instant by it and reading
 * the date off gives exactly what `Date#getDate()` would say in this process.
 */
const dailyTotals = async (userId, from, to, offsetMinutes) => {
  const rows = await query(
    `SELECT to_char((date AT TIME ZONE 'UTC') + ($4 || ' minutes')::interval, 'YYYY-MM-DD') AS _id,
            sum(amount) AS total
       FROM expenses
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      GROUP BY 1
      ORDER BY 1`,
    [userId, from, to, String(offsetMinutes)]
  );
  return rows.map((r) => ({ _id: r._id, total: Number(r.total) }));
};

/** How many expenses fall in a range. */
const countExpenses = async (userId, from, to) => {
  const row = await queryOne(
    `SELECT count(*)::bigint AS n FROM expenses
      WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, from, to]
  );
  return Number(row.n);
};

/** Spend per payment method for a range, biggest first. */
const paymentMethodTotals = async (userId, from, to) => {
  const rows = await query(
    `SELECT payment_method AS _id, sum(amount) AS total, count(*)::bigint AS count
       FROM expenses
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      GROUP BY payment_method
      ORDER BY total DESC`,
    [userId, from, to]
  );
  return rows.map((r) => ({ _id: r._id, total: Number(r.total), count: Number(r.count) }));
};

/** The single biggest expenses in a range. */
const topExpenses = async (userId, from, to, limit = 5) => {
  const rows = await query(
    `SELECT id, amount, category, description, date FROM expenses
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      ORDER BY amount DESC LIMIT $4`,
    [userId, from, to, limit]
  );
  return rows.map((r) => ({
    _id: r.id,
    amount: Number(r.amount),
    category: r.category,
    description: r.description,
    date: r.date,
  }));
};

module.exports = {
  categoryTotals,
  totalSpent,
  totalIncome,
  dailyTotals,
  countExpenses,
  paymentMethodTotals,
  topExpenses,
};
