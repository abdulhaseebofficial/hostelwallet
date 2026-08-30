const incomeRepo = require('../db/income');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { round2, startOfMonth, endOfMonth, currentPeriod } = require('../utils/calculations');

/** GET /api/income - optional ?month=&year= or ?from=&to= */
const listIncome = asyncHandler(async (req, res) => {
  const { items, total } = await incomeRepo.list(req.user._id, req.query);
  res.json({ success: true, data: { items, total } });
});

/** GET /api/income/summary - this month's income vs expense at a glance. */
const incomeSummary = asyncHandler(async (req, res) => {
  const { month, year } = currentPeriod();
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);

  const bySource = await incomeRepo.totalsBySource(req.user._id, from, to);
  const total = bySource.reduce((sum, r) => sum + r.total, 0);

  res.json({
    success: true,
    data: {
      month,
      year,
      total: round2(total),
      plannedIncome: round2(req.user.monthlyIncome || 0),
      bySource: bySource.map((r) => ({ source: r.source, amount: round2(r.total) })),
    },
  });
});

/** POST /api/income */
const createIncome = asyncHandler(async (req, res) => {
  const { amount, source, note, date } = req.body;

  const income = await incomeRepo.create(req.user._id, {
    amount,
    source: source || 'Pocket Money',
    note: note || '',
    date: date ? new Date(date) : new Date(),
  });

  res.status(201).json({ success: true, message: 'Income added', data: { income } });
});

/** PUT /api/income/:id */
const updateIncome = asyncHandler(async (req, res) => {
  const existing = await incomeRepo.findById(req.params.id, req.user._id);
  if (!existing) throw ApiError.notFound('Income entry not found');

  const patch = {};
  ['amount', 'source', 'note', 'date'].forEach((f) => {
    if (req.body[f] !== undefined) patch[f] = req.body[f];
  });

  const income = await incomeRepo.update(req.params.id, req.user._id, patch);
  res.json({ success: true, message: 'Income updated', data: { income } });
});

/** DELETE /api/income/:id */
const deleteIncome = asyncHandler(async (req, res) => {
  const removed = await incomeRepo.remove(req.params.id, req.user._id);
  if (!removed) throw ApiError.notFound('Income entry not found');
  res.json({ success: true, message: 'Income deleted', data: { id: req.params.id } });
});

module.exports = { listIncome, incomeSummary, createIncome, updateIncome, deleteIncome };
