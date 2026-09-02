const budgetsRepo = require('../db/budgets');
const usersRepo = require('../db/users');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { currentPeriod, round2 } = require('../utils/calculations');
const { budgetProgress } = require('../services/analyticsService');

/** Resolves ?month=&year= against the current period. */
const periodFrom = (query) => {
  const now = currentPeriod();
  return {
    month: Number(query.month) || now.month,
    year: Number(query.year) || now.year,
  };
};

/** GET /api/budget - every category limit for a month, joined with real spend. */
const listBudgets = asyncHandler(async (req, res) => {
  const { month, year } = periodFrom(req.query);
  const rows = await budgetProgress(req.user._id, month, year);

  const totals = rows.reduce(
    (acc, r) => {
      acc.limit += r.limit;
      acc.spent += r.spent;
      return acc;
    },
    { limit: 0, spent: 0 }
  );

  res.json({
    success: true,
    data: {
      month,
      year,
      items: rows,
      totals: {
        limit: round2(totals.limit),
        spent: round2(totals.spent),
        remaining: round2(totals.limit - totals.spent),
        income: round2(req.user.monthlyIncome || 0),
        unallocated: round2((req.user.monthlyIncome || 0) - totals.limit),
      },
    },
  });
});

/**
 * POST /api/budget
 * Upsert semantics: setting a limit for a category that already has one for
 * that month replaces it instead of failing on the unique index.
 */
const upsertBudget = asyncHandler(async (req, res) => {
  const { category, limit } = req.body;
  const { month, year } = periodFrom({ ...req.query, ...req.body });

  if (!usersRepo.allCategories(req.user).includes(category)) {
    throw ApiError.badRequest(`"${category}" is not one of your categories`);
  }

  const budget = await budgetsRepo.upsert(req.user._id, category, limit, month, year);

  res.status(201).json({ success: true, message: `Budget set for ${category}`, data: { budget } });
});

/**
 * POST /api/budget/bulk
 * Saves a whole plan in one call - used by the "apply AI budget" button.
 */
const bulkUpsert = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw ApiError.badRequest('Send a list of budgets');

  const { month, year } = periodFrom({ ...req.query, ...req.body });
  const allowed = usersRepo.allCategories(req.user);

  const valid = items.filter((item) => allowed.includes(item.category) && Number(item.limit) >= 0);
  if (!valid.length) throw ApiError.badRequest('None of those categories are valid');

  const written = await budgetsRepo.upsertMany(req.user._id, valid, month, year);
  const rows = await budgetProgress(req.user._id, month, year);

  res.json({
    success: true,
    message: `Saved ${written} budget limit(s)`,
    data: { month, year, items: rows },
  });
});

/** PUT /api/budget/:id */
const updateBudget = asyncHandler(async (req, res) => {
  const existing = await budgetsRepo.findById(req.params.id, req.user._id);
  if (!existing) throw ApiError.notFound('Budget not found');

  const budget =
    req.body.limit === undefined
      ? existing
      : await budgetsRepo.update(req.params.id, req.user._id, req.body.limit);

  res.json({ success: true, message: 'Budget updated', data: { budget } });
});

/** DELETE /api/budget/:id */
const deleteBudget = asyncHandler(async (req, res) => {
  const removed = await budgetsRepo.remove(req.params.id, req.user._id);
  if (!removed) throw ApiError.notFound('Budget not found');
  res.json({ success: true, message: 'Budget removed', data: { id: req.params.id } });
});

module.exports = { listBudgets, upsertBudget, bulkUpsert, updateBudget, deleteBudget };
