/**
 * Budget endpoints. Request in, JSON out; the rules are in budgets.service.
 */

const budgets = require('./budgets.service');
const asyncHandler = require('../../shared/http/asyncHandler');

/** GET /api/budget - every category limit for a month, joined with real spend. */
const listBudgets = asyncHandler(async (req, res) => {
  const data = await budgets.listForMonth(req.user, req.query);
  res.json({ success: true, data });
});

/**
 * POST /api/budget
 * Upsert semantics: setting a limit for a category that already has one for
 * that month replaces it instead of failing on the unique index.
 */
const upsertBudget = asyncHandler(async (req, res) => {
  const budget = await budgets.setLimit(req.user, req.body, req.query);
  res.status(201).json({
    success: true,
    message: `Budget set for ${budget.category}`,
    data: { budget },
  });
});

/**
 * POST /api/budget/bulk
 * Saves a whole plan in one call - used by the "apply AI budget" button.
 */
const bulkUpsert = asyncHandler(async (req, res) => {
  const { written, month, year, items } = await budgets.setPlan(req.user, req.body, req.query);
  res.json({
    success: true,
    message: `Saved ${written} budget limit(s)`,
    data: { month, year, items },
  });
});

/** PUT /api/budget/:id */
const updateBudget = asyncHandler(async (req, res) => {
  const budget = await budgets.update(req.params.id, req.user._id, req.body.limit);
  res.json({ success: true, message: 'Budget updated', data: { budget } });
});

/** DELETE /api/budget/:id */
const deleteBudget = asyncHandler(async (req, res) => {
  const id = await budgets.remove(req.params.id, req.user._id);
  res.json({ success: true, message: 'Budget removed', data: { id } });
});

module.exports = { listBudgets, upsertBudget, bulkUpsert, updateBudget, deleteBudget };
