/**
 * Expense rules.
 *
 * Three things this feature decides, all of them here:
 *
 *  - a category has to be one of the student's own, built-in or custom;
 *  - a recurring expense carries a pointer to when it next falls due, and that
 *    pointer has to stay consistent with the flag through every edit;
 *  - writing an expense can push a category over its limit, so the alert
 *    checks re-run afterwards.
 */

const expensesRepo = require('./expenses.repository');
const { isOwnCategory } = require('../../shared/categories');
const ApiError = require('../../shared/errors/ApiError');
const {
  firstRunAfter,
  materializeForUser,
} = require('../../infrastructure/scheduling/recurringExpenses.job');
const events = require('../../shared/events');

const DEFAULT_PAYMENT_METHOD = 'Cash';
const DEFAULT_FREQUENCY = 'monthly';

const assertOwnCategory = (user, category) => {
  if (!isOwnCategory(user, category)) {
    throw ApiError.badRequest(`"${category}" is not one of your categories`);
  }
};

/**
 * Announces a write, once the row is committed.
 *
 * Whether that means an alert is notifications' business, not this module's.
 * Fire and forget, as it was before: the expense is already saved and the
 * student should not wait on something that is not part of their answer.
 */
const announce = (user, expense, action) => {
  events.emit(events.EXPENSE_WRITTEN, { user, expense, action });
};

/** Filtered, sorted, paginated, with the sum of the filtered set. */
const list = async (userId, filters) => {
  // Catch recurring bills up first so the list is never stale.
  await materializeForUser(userId);
  return expensesRepo.list(userId, filters);
};

const getById = async (id, userId) => {
  const expense = await expensesRepo.findById(id, userId);
  if (!expense) throw ApiError.notFound('Expense not found');
  return expense;
};

const create = async (user, input) => {
  const {
    amount,
    category,
    description,
    paymentMethod,
    date,
    isRecurring,
    recurringFrequency,
  } = input;

  assertOwnCategory(user, category);

  const when = date ? new Date(date) : new Date();
  const frequency = recurringFrequency || DEFAULT_FREQUENCY;

  const expense = await expensesRepo.create(user._id, {
    amount,
    category,
    description: description || '',
    paymentMethod: paymentMethod || DEFAULT_PAYMENT_METHOD,
    date: when,
    isRecurring: Boolean(isRecurring),
    recurringFrequency: frequency,
    nextRunAt: isRecurring ? firstRunAfter(when, frequency) : null,
  });

  announce(user, expense, 'created');
  return expense;
};

/** Only the fields a student is allowed to change are copied across. */
const EDITABLE = [
  'amount',
  'category',
  'description',
  'paymentMethod',
  'date',
  'isRecurring',
  'recurringFrequency',
];

const update = async (id, user, body) => {
  const existing = await expensesRepo.findById(id, user._id);
  if (!existing) throw ApiError.notFound('Expense not found');

  if (body.category) assertOwnCategory(user, body.category);

  const patch = {};
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined) patch[field] = body[field];
  });

  // Keep the recurring pointer consistent with the flag.
  const willRecur =
    patch.isRecurring === undefined ? existing.isRecurring : Boolean(patch.isRecurring);

  if (willRecur) {
    const when = patch.date ? new Date(patch.date) : new Date(existing.date);
    const frequency = patch.recurringFrequency || existing.recurringFrequency;
    if (!existing.nextRunAt) patch.nextRunAt = firstRunAfter(when, frequency);
  } else {
    patch.nextRunAt = null;
  }

  const expense = await expensesRepo.update(id, user._id, patch);
  announce(user, expense, 'updated');
  return expense;
};

const remove = async (id, userId) => {
  const removed = await expensesRepo.remove(id, userId);
  if (!removed) throw ApiError.notFound('Expense not found');
  return id;
};

/* ------------------- for other modules to build on ------------------ */

/** The newest few, without the recurring catch-up the list route does. */
const listRecent = (userId, limit) => expensesRepo.list(userId, { limit });

/** Everything in a date range, for a report or an export. */
const listForRange = (userId, from, to) => expensesRepo.listForRange(userId, from, to);

/** Every expense this student has, for the data export. */
const listAllForUser = (userId) => expensesRepo.listAllForUser(userId);

/** How many expenses still use a category, before it can be deleted. */
const countByCategory = (userId, category) => expensesRepo.countByCategory(userId, category);

/** How many were logged since a moment, for the "you have not logged" nudge. */
const countCreatedSince = (userId, since) => expensesRepo.countCreatedSince(userId, since);

/** Recurring bills falling due by a date, for the bill reminder. */
const findBillsDueBy = (userId, when) => expensesRepo.findBillsDueBy(userId, when);

module.exports = {
  listRecent,
  listForRange,
  listAllForUser,
  countByCategory,
  countCreatedSince,
  findBillsDueBy,
  list,
  getById,
  create,
  update,
  remove,
};
