/**
 * The debts and debt_payments tables.
 *
 * Two things this file is careful about.
 *
 * The arithmetic is done in SQL, on numeric columns, never in JavaScript. Three
 * instalments of 33.33 against 100.00 have to leave exactly 0.01, and adding
 * them up in floating point does not.
 *
 * A payment locks its debt row before reading the balance. Two payments
 * arriving together would otherwise both read the old total, both write their
 * own, and the second would silently erase the first.
 */

const { query, queryOne, transaction } = require('../../infrastructure/database/pool');
const { toApi, toApiList, buildSet, isUuid } = require('../../infrastructure/database/rows');

/**
 * Every debt column plus the two figures that are always derived rather than
 * stored: what is left, and whether today has passed the due date.
 *
 * Overdue is computed here so it can never be stale, and so it can be filtered
 * and sorted on in the same query that reads it.
 */
const DEBT_COLUMNS = `
  d.*,
  (d.original_amount - d.paid_amount) AS remaining_amount,
  (d.status <> 'SETTLED' AND d.due_date IS NOT NULL AND d.due_date < now()) AS is_overdue`;

/* ------------------------------ reading ----------------------------- */

const SORTS = {
  newest: 'd.transaction_date DESC, d.id DESC',
  oldest: 'd.transaction_date ASC, d.id ASC',
  amount: 'd.original_amount DESC, d.id DESC',
  remaining: '(d.original_amount - d.paid_amount) DESC, d.id DESC',
  due: 'd.due_date ASC NULLS LAST, d.id DESC',
};

/** Escapes the wildcards a student can type into a search box. */
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Turns the query string into a WHERE clause and its values.
 *
 * `status=OVERDUE` is a filter on the derived expression, not on the column,
 * which is why it is spelled out here rather than compared to `d.status`.
 */
const buildFilters = (userId, filters = {}) => {
  const clauses = ['d.user_id = $1'];
  const values = [userId];
  const next = () => values.length + 1;

  const { kind, status, search, from, to, dueFrom, dueTo } = filters;

  if (kind === 'BORROWED' || kind === 'LENT') {
    clauses.push(`d.kind = $${next()}`);
    values.push(kind);
  }

  if (status === 'OVERDUE') {
    clauses.push(`d.status <> 'SETTLED' AND d.due_date IS NOT NULL AND d.due_date < now()`);
  } else if (status === 'OUTSTANDING') {
    clauses.push(`d.status <> 'SETTLED'`);
  } else if (['PENDING', 'PARTIALLY_PAID', 'SETTLED'].includes(status)) {
    clauses.push(`d.status = $${next()}`);
    values.push(status);
  }

  if (search) {
    // Both halves compare against the same value, so the placeholder number is
    // taken once. Reading `values.length` again for the second half would give
    // the index of the *previous* parameter, because the push has not happened
    // yet - which is how the note clause once ended up comparing a name to a
    // user id, and every search returned a 500.
    const n = next();
    clauses.push(`(d.person_name ILIKE $${n} ESCAPE '\\' OR d.note ILIKE $${n} ESCAPE '\\')`);
    values.push(`%${escapeLike(search)}%`);
  }

  if (from) {
    clauses.push(`d.transaction_date >= $${next()}`);
    values.push(new Date(from));
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    clauses.push(`d.transaction_date <= $${next()}`);
    values.push(end);
  }
  if (dueFrom) {
    clauses.push(`d.due_date >= $${next()}`);
    values.push(new Date(dueFrom));
  }
  if (dueTo) {
    const end = new Date(dueTo);
    end.setHours(23, 59, 59, 999);
    clauses.push(`d.due_date <= $${next()}`);
    values.push(end);
  }

  return { where: clauses.join(' AND '), values };
};

/** One page of debts, plus the totals for everything the filter matched. */
const list = async (userId, filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const order = SORTS[filters.sort] || SORTS.newest;

  const { where, values } = buildFilters(userId, filters);

  const rows = await query(
    `SELECT ${DEBT_COLUMNS} FROM debts d
      WHERE ${where}
      ORDER BY ${order}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]
  );

  const summary = await queryOne(
    `SELECT count(*)::bigint AS total,
            coalesce(sum(d.original_amount - d.paid_amount), 0) AS outstanding
       FROM debts d WHERE ${where}`,
    values
  );

  const total = Number(summary.total);

  return {
    items: toApiList(rows),
    filteredOutstanding: Number(summary.outstanding),
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

const findById = async (id, userId) => {
  if (!isUuid(id)) return null;
  const row = await queryOne(
    `SELECT ${DEBT_COLUMNS} FROM debts d WHERE d.id = $1 AND d.user_id = $2`,
    [id, userId]
  );
  return row ? toApi(row) : null;
};

/** The ledger behind one debt, newest payment first. */
const payments = async (debtId, userId) => {
  if (!isUuid(debtId)) return [];
  const rows = await query(
    `SELECT * FROM debt_payments
      WHERE debt_id = $1 AND user_id = $2
      ORDER BY paid_on DESC, created_at DESC`,
    [debtId, userId]
  );
  return toApiList(rows);
};

/* ------------------------------ writing ----------------------------- */

const create = async (userId, input) => {
  const row = await queryOne(
    `INSERT INTO debts
       (user_id, kind, person_name, person_contact, original_amount,
        transaction_date, due_date, category, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${DEBT_COLUMNS.replace(/d\./g, '')}`,
    [
      userId,
      input.kind,
      input.personName,
      input.personContact || '',
      input.originalAmount,
      input.transactionDate,
      input.dueDate || null,
      input.category || null,
      input.note || '',
    ]
  );
  return toApi(row);
};

/**
 * Applies a partial update. The money columns are deliberately not settable:
 * a balance is what the ledger says it is, not what a request claims.
 */
const update = async (id, userId, patch) => {
  const columns = {
    kind: patch.kind,
    person_name: patch.personName,
    person_contact: patch.personContact,
    original_amount: patch.originalAmount,
    transaction_date: patch.transactionDate,
    due_date: patch.dueDate,
    category: patch.category,
    note: patch.note,
  };

  const { fragment, values, next } = buildSet(columns);
  if (!fragment) return findById(id, userId);

  // Changing the original amount can change what the status should be - paying
  // 500 against a debt later corrected to 500 settles it - so the status is
  // recomputed from the balance rather than left as it was.
  //
  // All of it in ONE statement, deliberately. Writing the amount first and the
  // status second leaves the row saying two different things about itself in
  // between: a reader sees PARTIALLY_PAID on a debt that is now fully paid, and
  // if the second statement never runs, it stays that way. The database refuses
  // that intermediate row outright (debts_status_matches_balance), which is how
  // the split came to light.
  //
  // Postgres evaluates every SET expression against the row as it was BEFORE
  // the update, so the status below cannot simply read original_amount - that
  // would still be the old figure. It reads the incoming value instead, falling
  // back to the stored one when the amount is not part of this patch.
  const amountPlaceholder = patch.originalAmount === undefined ? 'original_amount' : `$${next}`;
  const amountValues = patch.originalAmount === undefined ? [] : [patch.originalAmount];
  const idPosition = next + amountValues.length;

  const row = await queryOne(
    `UPDATE debts
        SET ${fragment},
            status = CASE
              WHEN paid_amount >= ${amountPlaceholder}::numeric THEN 'SETTLED'
              WHEN paid_amount > 0 THEN 'PARTIALLY_PAID'
              ELSE 'PENDING' END,
            settled_at = CASE
              WHEN paid_amount >= ${amountPlaceholder}::numeric THEN coalesce(settled_at, now())
              ELSE NULL END,
            updated_at = now()
      WHERE id = $${idPosition} AND user_id = $${idPosition + 1}
      RETURNING id`,
    [...values, ...amountValues, id, userId]
  );
  if (!row) return null;

  return findById(id, userId);
};

const remove = async (id, userId) => {
  if (!isUuid(id)) return false;
  // debt_payments is ON DELETE CASCADE, so the ledger goes with it.
  const rows = await query(`DELETE FROM debts WHERE id = $1 AND user_id = $2 RETURNING id`, [
    id,
    userId,
  ]);
  return rows.length > 0;
};

/* ----------------------------- payments ----------------------------- */

/**
 * Records a payment and moves the balance, atomically.
 *
 * The row is locked first: two payments arriving together would otherwise both
 * read the old total and the second would overwrite the first. Everything after
 * the lock - the insert, the new total, the status - happens in one transaction,
 * so a failure anywhere leaves no half-applied payment.
 *
 * Returns a reason rather than throwing, so the service decides what each one
 * means to a caller.
 */
const addPayment = async (debtId, userId, { amount, paidOn, note }) =>
  transaction(async (tx) => {
    if (!isUuid(debtId)) return { reason: 'NOT_FOUND' };

    const current = await tx.queryOne(
      `SELECT original_amount, paid_amount, status
         FROM debts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [debtId, userId]
    );
    if (!current) return { reason: 'NOT_FOUND' };

    // Compared in SQL against numeric columns, so a payment that exactly
    // clears the balance is recognised as exactly clearing it.
    const room = await tx.queryOne(
      `SELECT ($1::numeric - $2::numeric) < $3::numeric AS too_much`,
      [current.original_amount, current.paid_amount, amount]
    );
    if (room.too_much) {
      return {
        reason: 'OVERPAY',
        remaining: Number(current.original_amount) - Number(current.paid_amount),
      };
    }

    const payment = await tx.queryOne(
      `INSERT INTO debt_payments (debt_id, user_id, amount, paid_on, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [debtId, userId, amount, paidOn || new Date(), note || '']
    );

    await tx.query(
      `UPDATE debts
          SET paid_amount = paid_amount + $3::numeric,
              status = CASE
                WHEN paid_amount + $3::numeric >= original_amount THEN 'SETTLED'
                WHEN paid_amount + $3::numeric > 0 THEN 'PARTIALLY_PAID'
                ELSE 'PENDING' END,
              settled_at = CASE
                WHEN paid_amount + $3::numeric >= original_amount
                THEN coalesce(settled_at, now()) ELSE NULL END,
              updated_at = now()
        WHERE id = $1 AND user_id = $2`,
      [debtId, userId, amount]
    );

    const row = await tx.queryOne(
      `SELECT ${DEBT_COLUMNS} FROM debts d WHERE d.id = $1 AND d.user_id = $2`,
      [debtId, userId]
    );

    return {
      reason: 'OK',
      debt: toApi(row),
      payment: toApi(payment),
      wasSettled: current.status === 'SETTLED',
    };
  });

/**
 * Removes a payment and puts the balance back, atomically.
 *
 * Used to correct a mistyped entry. The debt returns to whatever status the
 * remaining ledger implies, so undoing the payment that settled a debt reopens
 * it rather than leaving it wrongly closed.
 */
const removePayment = async (debtId, paymentId, userId) =>
  transaction(async (tx) => {
    if (!isUuid(debtId) || !isUuid(paymentId)) return { reason: 'NOT_FOUND' };

    const locked = await tx.queryOne(
      `SELECT id FROM debts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [debtId, userId]
    );
    if (!locked) return { reason: 'NOT_FOUND' };

    const removed = await tx.queryOne(
      `DELETE FROM debt_payments
        WHERE id = $1 AND debt_id = $2 AND user_id = $3 RETURNING amount`,
      [paymentId, debtId, userId]
    );
    if (!removed) return { reason: 'PAYMENT_NOT_FOUND' };

    await tx.query(
      `UPDATE debts
          SET paid_amount = paid_amount - $3::numeric,
              status = CASE
                WHEN paid_amount - $3::numeric >= original_amount THEN 'SETTLED'
                WHEN paid_amount - $3::numeric > 0 THEN 'PARTIALLY_PAID'
                ELSE 'PENDING' END,
              settled_at = CASE
                WHEN paid_amount - $3::numeric >= original_amount
                THEN settled_at ELSE NULL END,
              updated_at = now()
        WHERE id = $1 AND user_id = $2`,
      [debtId, userId, removed.amount]
    );

    const row = await tx.queryOne(
      `SELECT ${DEBT_COLUMNS} FROM debts d WHERE d.id = $1 AND d.user_id = $2`,
      [debtId, userId]
    );
    return { reason: 'OK', debt: toApi(row) };
  });

/* ------------------------------ summary ----------------------------- */

/**
 * What the student owes and is owed, counting only what is still outstanding.
 *
 * A settled debt contributes nothing: it is history, not a position. Every
 * figure is summed in SQL over numeric columns, so the totals are exact and the
 * frontend never adds money up itself.
 */
const summary = async (userId) => {
  const row = await queryOne(
    `SELECT
       coalesce(sum(original_amount - paid_amount)
                FILTER (WHERE kind = 'BORROWED' AND status <> 'SETTLED'), 0) AS payable,
       coalesce(sum(original_amount - paid_amount)
                FILTER (WHERE kind = 'LENT' AND status <> 'SETTLED'), 0) AS receivable,
       coalesce(sum(original_amount - paid_amount)
                FILTER (WHERE status <> 'SETTLED'
                        AND due_date IS NOT NULL AND due_date < now()), 0) AS overdue,
       count(*) FILTER (WHERE status <> 'SETTLED')::bigint AS outstanding_count,
       count(*) FILTER (WHERE status = 'SETTLED')::bigint AS settled_count,
       count(*) FILTER (WHERE status <> 'SETTLED'
                        AND due_date IS NOT NULL AND due_date < now())::bigint AS overdue_count
     FROM debts WHERE user_id = $1`,
    [userId]
  );

  return {
    payable: Number(row.payable),
    receivable: Number(row.receivable),
    overdue: Number(row.overdue),
    outstandingCount: Number(row.outstanding_count),
    settledCount: Number(row.settled_count),
    overdueCount: Number(row.overdue_count),
  };
};

/** Outstanding debts falling due within `days`, soonest first. */
const dueWithin = async (userId, days, limit = 5) => {
  const rows = await query(
    `SELECT ${DEBT_COLUMNS} FROM debts d
      WHERE d.user_id = $1 AND d.status <> 'SETTLED' AND d.due_date IS NOT NULL
        AND d.due_date <= now() + ($2 || ' days')::interval
      ORDER BY d.due_date ASC LIMIT $3`,
    [userId, String(days), limit]
  );
  return toApiList(rows);
};

module.exports = {
  list,
  findById,
  payments,
  create,
  update,
  remove,
  addPayment,
  removePayment,
  summary,
  dueWithin,
};
