const expensesRepo = require('./expenses.repository');
const usersRepo = require('../users/users.repository');
const ApiError = require('../../shared/errors/ApiError');
const asyncHandler = require('../../shared/http/asyncHandler');
const { firstRunAfter, materializeForUser } = require('../../infrastructure/scheduling/recurringExpenses.job');
const { runChecksForUser } = require('../notifications/notifications.service');

/**
 * GET /api/expenses
 * Filtering, sorting and pagination. Also returns the sum of the filtered set
 * so the UI can show "total for this filter" without a second round trip.
 */
const listExpenses = asyncHandler(async (req, res) => {
  // Catch recurring bills up first so the list is never stale.
  await materializeForUser(req.user._id);

  const { items, pagination, filteredTotal } = await expensesRepo.list(req.user._id, req.query);

  res.json({ success: true, data: { items, pagination, filteredTotal } });
});

/** GET /api/expenses/:id */
const getExpense = asyncHandler(async (req, res) => {
  const expense = await expensesRepo.findById(req.params.id, req.user._id);
  if (!expense) throw ApiError.notFound('Expense not found');
  res.json({ success: true, data: { expense } });
});

/** POST /api/expenses */
const createExpense = asyncHandler(async (req, res) => {
  const { amount, category, description, paymentMethod, date, isRecurring, recurringFrequency } = req.body;

  if (!usersRepo.allCategories(req.user).includes(category)) {
    throw ApiError.badRequest(`"${category}" is not one of your categories`);
  }

  const when = date ? new Date(date) : new Date();
  const frequency = recurringFrequency || 'monthly';

  const expense = await expensesRepo.create(req.user._id, {
    amount,
    category,
    description: description || '',
    paymentMethod: paymentMethod || 'Cash',
    date: when,
    isRecurring: Boolean(isRecurring),
    recurringFrequency: frequency,
    nextRunAt: isRecurring ? firstRunAfter(when, frequency) : null,
  });

  // A new expense can push a category over its limit, so re-run the checks.
  // Fire and forget: the student should not wait on it.
  runChecksForUser(req.user).catch((e) => console.error('[notifications]', e.message));

  res.status(201).json({ success: true, message: 'Expense added', data: { expense } });
});

/** PUT /api/expenses/:id */
const updateExpense = asyncHandler(async (req, res) => {
  const existing = await expensesRepo.findById(req.params.id, req.user._id);
  if (!existing) throw ApiError.notFound('Expense not found');

  if (req.body.category && !usersRepo.allCategories(req.user).includes(req.body.category)) {
    throw ApiError.badRequest(`"${req.body.category}" is not one of your categories`);
  }

  const patch = {};
  ['amount', 'category', 'description', 'paymentMethod', 'date', 'isRecurring', 'recurringFrequency'].forEach(
    (f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
  );

  // Keep the recurring pointer consistent with the flag.
  const willRecur = patch.isRecurring === undefined ? existing.isRecurring : Boolean(patch.isRecurring);
  if (willRecur) {
    const when = patch.date ? new Date(patch.date) : new Date(existing.date);
    const frequency = patch.recurringFrequency || existing.recurringFrequency;
    if (!existing.nextRunAt) patch.nextRunAt = firstRunAfter(when, frequency);
  } else {
    patch.nextRunAt = null;
  }

  const expense = await expensesRepo.update(req.params.id, req.user._id, patch);
  runChecksForUser(req.user).catch((e) => console.error('[notifications]', e.message));

  res.json({ success: true, message: 'Expense updated', data: { expense } });
});

/** DELETE /api/expenses/:id */
const deleteExpense = asyncHandler(async (req, res) => {
  const removed = await expensesRepo.remove(req.params.id, req.user._id);
  if (!removed) throw ApiError.notFound('Expense not found');
  res.json({ success: true, message: 'Expense deleted', data: { id: req.params.id } });
});

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense };
