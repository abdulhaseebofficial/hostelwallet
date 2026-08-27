const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { firstRunAfter, materializeForUser } = require('../services/recurringService');
const { runChecksForUser } = require('../services/notificationService');

// Characters that carry meaning inside a RegExp. User supplied search text is
// escaped against this list so a stray "(" cannot break the query.
const REGEX_SPECIALS = '.*+?^${}()|[]/\u005C';
const escapeRegex = (input) =>
  String(input)
    .split('')
    .map((ch) => (REGEX_SPECIALS.includes(ch) ? '\u005C' + ch : ch))
    .join('');

/** Builds the mongo filter from the query string. */
const buildFilter = (req) => {
  const filter = { userId: req.user._id };
  const { from, to, category, paymentMethod, minAmount, maxAmount, search, isRecurring } = req.query;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999); // make `to` inclusive
      filter.date.$lte = end;
    }
  }

  if (category) filter.category = { $in: String(category).split(',') };
  if (paymentMethod) filter.paymentMethod = { $in: String(paymentMethod).split(',') };

  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = Number(minAmount);
    if (maxAmount) filter.amount.$lte = Number(maxAmount);
  }

  if (isRecurring === 'true') filter.isRecurring = true;

  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [{ description: new RegExp(safe, 'i') }, { category: new RegExp(safe, 'i') }];
  }

  return filter;
};

/**
 * GET /api/expenses
 * Filtering, sorting and pagination. Also returns the sum of the filtered set
 * so the UI can show "total for this filter" without a second round trip.
 */
const listExpenses = asyncHandler(async (req, res) => {
  // Catch recurring bills up first so the list is never stale.
  await materializeForUser(req.user._id);

  const filter = buildFilter(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const sortField = ['date', 'amount', 'category', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'date';
  const sortOrder = req.query.order === 'asc' ? 1 : -1;

  const [items, total, sumRows] = await Promise.all([
    Expense.find(filter)
      .sort({ [sortField]: sortOrder, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      filteredTotal: sumRows.length ? Math.round(sumRows[0].total * 100) / 100 : 0,
    },
  });
});

/** GET /api/expenses/:id */
const getExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
  if (!expense) throw ApiError.notFound('Expense not found');
  res.json({ success: true, data: { expense } });
});

/** POST /api/expenses */
const createExpense = asyncHandler(async (req, res) => {
  const { amount, category, description, paymentMethod, date, isRecurring, recurringFrequency } = req.body;

  if (!req.user.allCategories().includes(category)) {
    throw ApiError.badRequest(`"${category}" is not one of your categories`);
  }

  const when = date ? new Date(date) : new Date();

  const expense = await Expense.create({
    userId: req.user._id,
    amount,
    category,
    description: description || '',
    paymentMethod: paymentMethod || 'Cash',
    date: when,
    isRecurring: Boolean(isRecurring),
    recurringFrequency: recurringFrequency || 'monthly',
    nextRunAt: isRecurring ? firstRunAfter(when, recurringFrequency || 'monthly') : undefined,
  });

  // A new expense can push a category over its limit, so re-run the checks.
  // Fire and forget: the student should not wait on it.
  runChecksForUser(req.user).catch((e) => console.error('[notifications]', e.message));

  res.status(201).json({ success: true, message: 'Expense added', data: { expense } });
});

/** PUT /api/expenses/:id */
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
  if (!expense) throw ApiError.notFound('Expense not found');

  if (req.body.category && !req.user.allCategories().includes(req.body.category)) {
    throw ApiError.badRequest(`"${req.body.category}" is not one of your categories`);
  }

  const fields = [
    'amount',
    'category',
    'description',
    'paymentMethod',
    'date',
    'isRecurring',
    'recurringFrequency',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) expense[f] = req.body[f];
  });

  // Keep the recurring pointer consistent with the flag.
  if (expense.isRecurring && !expense.nextRunAt) {
    expense.nextRunAt = firstRunAfter(expense.date, expense.recurringFrequency);
  }
  if (!expense.isRecurring) expense.nextRunAt = undefined;

  await expense.save();
  runChecksForUser(req.user).catch((e) => console.error('[notifications]', e.message));

  res.json({ success: true, message: 'Expense updated', data: { expense } });
});

/** DELETE /api/expenses/:id */
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!expense) throw ApiError.notFound('Expense not found');
  res.json({ success: true, message: 'Expense deleted', data: { id: req.params.id } });
});

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense };
