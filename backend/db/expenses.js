/**
 * Expense reads and writes, including the filtered list behind the Expenses
 * page. Replaces models/Expense.js.
 */

const { query, queryOne } = require('./pool');
const { toApi, toApiList, buildSet, isUuid } = require('./rows');

// Sort keys the client is allowed to ask for, mapped to real columns so the
// query string can never reach the SQL.
const SORT_COLUMNS = {
  date: 'date',
  amount: 'amount',
  category: 'category',
  createdAt: 'created_at',
};

/**
 * `%` and `_` are wildcards to LIKE, so escape them in user text - otherwise a
 * search for "50%" matches everything. `\` is the escape character.
 */
const escapeLike = (input) => String(input).replace(/[\\%_]/g, (ch) => `\\${ch}`);

/**
 * Turns the query string into a WHERE clause and its parameters.
 *
 * Returns the SQL fragment (without the WHERE keyword), the values, and the
 * next free placeholder number so the caller can append LIMIT/OFFSET.
 */
const buildWhere = (userId, q = {}) => {
  const clauses = ['user_id = $1'];
  const values = [userId];
  let n = 2;

  const { from, to, category, paymentMethod, minAmount, maxAmount, search, isRecurring } = q;

  if (from) {
    clauses.push(`date >= $${n}`);
    values.push(new Date(from));
    n += 1;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999); // make `to` inclusive
    clauses.push(`date <= $${n}`);
    values.push(end);
    n += 1;
  }

  if (category) {
    clauses.push(`category = ANY($${n})`);
    values.push(String(category).split(','));
    n += 1;
  }
  if (paymentMethod) {
    clauses.push(`payment_method = ANY($${n})`);
    values.push(String(paymentMethod).split(','));
    n += 1;
  }

  if (minAmount) {
    clauses.push(`amount >= $${n}`);
    values.push(Number(minAmount));
    n += 1;
  }
  if (maxAmount) {
    clauses.push(`amount <= $${n}`);
    values.push(Number(maxAmount));
    n += 1;
  }

  if (isRecurring === 'true') clauses.push('is_recurring');

  if (search) {
    // Same two fields the old regex searched, still case-insensitive.
    clauses.push(`(description ILIKE $${n} ESCAPE '\\' OR category ILIKE $${n} ESCAPE '\\')`);
    values.push(`%${escapeLike(search)}%`);
    n += 1;
  }

  return { where: clauses.join(' AND '), values, next: n };
};

/**
 * One page of expenses, the count of the whole filtered set, and its total -
 * so the UI can show "total for this filter" without a second round trip.
 */
const list = async (userId, q = {}) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const sortColumn = SORT_COLUMNS[q.sortBy] || 'date';
  const direction = q.order === 'asc' ? 'ASC' : 'DESC';

  const { where, values, next } = buildWhere(userId, q);

  const [items, summary] = await Promise.all([
    query(
      `SELECT * FROM expenses WHERE ${where}
        ORDER BY ${sortColumn} ${direction}, id DESC
        LIMIT $${next} OFFSET $${next + 1}`,
      [...values, limit, (page - 1) * limit]
    ),
    queryOne(
      `SELECT count(*)::bigint AS total, COALESCE(sum(amount), 0) AS sum
         FROM expenses WHERE ${where}`,
      values
    ),
  ]);

  const total = Number(summary.total);
  return {
    items: toApiList(items),
    total,
    filteredTotal: Math.round(Number(summary.sum) * 100) / 100,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

/** One expense, scoped to its owner so another student's id reads as missing. */
const findById = async (id, userId) => {
  if (!isUuid(id)) return null;
  const row = await queryOne(`SELECT * FROM expenses WHERE id = $1 AND user_id = $2`, [id, userId]);
  return toApi(row);
};

const create = async (userId, data) => {
  const row = await queryOne(
    `INSERT INTO expenses
       (user_id, amount, category, description, payment_method, date,
        is_recurring, recurring_frequency, next_run_at, generated_from)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      data.amount,
      data.category,
      data.description || '',
      data.paymentMethod || 'Cash',
      data.date,
      Boolean(data.isRecurring),
      data.recurringFrequency || 'monthly',
      data.nextRunAt || null,
      data.generatedFrom || null,
    ]
  );
  return toApi(row);
};

const update = async (id, userId, patch) => {
  const columns = {
    amount: patch.amount,
    category: patch.category,
    description: patch.description,
    payment_method: patch.paymentMethod,
    date: patch.date,
    is_recurring: patch.isRecurring,
    recurring_frequency: patch.recurringFrequency,
    next_run_at: patch.nextRunAt,
  };

  const { fragment, values, next } = buildSet(columns);
  if (!fragment) return findById(id, userId);

  const row = await queryOne(
    `UPDATE expenses SET ${fragment}, updated_at = now()
      WHERE id = $${next} AND user_id = $${next + 1} RETURNING *`,
    [...values, id, userId]
  );
  return toApi(row);
};

const remove = async (id, userId) => {
  if (!isUuid(id)) return false;
  const rows = await query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id`, [
    id,
    userId,
  ]);
  return rows.length > 0;
};

/** Every expense this student has, for the "download everything" export. */
const listAllForUser = async (userId) => {
  const rows = await query(
    `SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC, id DESC`,
    [userId]
  );
  return toApiList(rows);
};

/** Every expense in a date range, oldest first - the report export. */
const listForRange = async (userId, from, to) => {
  const rows = await query(
    `SELECT * FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date, id`,
    [userId, from, to]
  );
  return toApiList(rows);
};

/** How many expenses still use a category - blocks deleting one in use. */
const countByCategory = async (userId, category) => {
  const row = await queryOne(
    `SELECT count(*)::bigint AS n FROM expenses WHERE user_id = $1 AND category = $2`,
    [userId, category]
  );
  return Number(row.n);
};

/* --------------------------- recurring sweep ------------------------ */

/** Recurring templates that have come due, for one user or for everybody. */
const findDue = async (userId = null) => {
  const rows = userId
    ? await query(
        `SELECT * FROM expenses
          WHERE user_id = $1 AND is_recurring AND next_run_at IS NOT NULL AND next_run_at <= now()`,
        [userId]
      )
    : await query(
        `SELECT * FROM expenses
          WHERE is_recurring AND next_run_at IS NOT NULL AND next_run_at <= now()`
      );
  return toApiList(rows);
};

/** Moves a template's pointer forward after it has been materialised. */
const setNextRunAt = async (id, nextRunAt) => {
  await query(`UPDATE expenses SET next_run_at = $2, updated_at = now() WHERE id = $1`, [
    id,
    nextRunAt,
  ]);
};

/** Everyone with a template that has come due, for the nightly sweep. */
const userIdsWithDue = async () => {
  const rows = await query(
    `SELECT DISTINCT user_id FROM expenses
      WHERE is_recurring AND next_run_at IS NOT NULL AND next_run_at <= now()`
  );
  return rows.map((r) => r.user_id);
};

/** Writes the occurrences a template has generated, in one statement. */
const createMany = async (clones) => {
  if (!clones.length) return 0;

  const values = [];
  const tuples = clones.map((c, i) => {
    const base = i * 8;
    values.push(
      c.userId,
      c.amount,
      c.category,
      c.description || '',
      c.paymentMethod || 'Cash',
      c.date,
      false,
      c.generatedFrom || null
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  const rows = await query(
    `INSERT INTO expenses
       (user_id, amount, category, description, payment_method, date, is_recurring, generated_from)
     VALUES ${tuples.join(', ')} RETURNING id`,
    values
  );
  return rows.length;
};

/* ----------------------------- alert rules -------------------------- */

/** How many expenses this student logged since `since` - drives the nudge. */
const countCreatedSince = async (userId, since) => {
  const row = await queryOne(
    `SELECT count(*)::bigint AS n FROM expenses WHERE user_id = $1 AND created_at >= $2`,
    [userId, since]
  );
  return Number(row.n);
};

/** Recurring bills falling due on or before `by`. */
const findBillsDueBy = async (userId, by) => {
  const rows = await query(
    `SELECT * FROM expenses
      WHERE user_id = $1 AND is_recurring AND next_run_at IS NOT NULL AND next_run_at <= $2
      ORDER BY next_run_at`,
    [userId, by]
  );
  return toApiList(rows);
};

module.exports = {
  buildWhere,
  list,
  findById,
  create,
  update,
  remove,
  countByCategory,
  listAllForUser,
  listForRange,
  findDue,
  setNextRunAt,
  userIdsWithDue,
  createMany,
  countCreatedSince,
  findBillsDueBy,
};
