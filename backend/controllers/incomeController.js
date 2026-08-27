const Income = require('../models/Income');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { round2, startOfMonth, endOfMonth, currentPeriod } = require('../utils/calculations');

/** GET /api/income - optional ?month=&year= or ?from=&to= */
const listIncome = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  const { month, year, from, to, source } = req.query;

  if (month && year) {
    filter.date = { $gte: startOfMonth(Number(year), Number(month)), $lte: endOfMonth(Number(year), Number(month)) };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  if (source) filter.source = source;

  const [items, sumRows] = await Promise.all([
    Income.find(filter).sort({ date: -1 }).lean(),
    Income.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  res.json({
    success: true,
    data: { items, total: sumRows.length ? round2(sumRows[0].total) : 0 },
  });
});

/** GET /api/income/summary - this month's income vs expense at a glance. */
const incomeSummary = asyncHandler(async (req, res) => {
  const { month, year } = currentPeriod();
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);

  const bySource = await Income.aggregate([
    { $match: { userId: req.user._id, date: { $gte: from, $lte: to } } },
    { $group: { _id: '$source', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ]);

  const total = bySource.reduce((sum, r) => sum + r.total, 0);

  res.json({
    success: true,
    data: {
      month,
      year,
      total: round2(total),
      plannedIncome: round2(req.user.monthlyIncome || 0),
      bySource: bySource.map((r) => ({ source: r._id, amount: round2(r.total) })),
    },
  });
});

/** POST /api/income */
const createIncome = asyncHandler(async (req, res) => {
  const { amount, source, note, date } = req.body;

  const income = await Income.create({
    userId: req.user._id,
    amount,
    source: source || 'Pocket Money',
    note: note || '',
    date: date ? new Date(date) : new Date(),
  });

  res.status(201).json({ success: true, message: 'Income added', data: { income } });
});

/** PUT /api/income/:id */
const updateIncome = asyncHandler(async (req, res) => {
  const income = await Income.findOne({ _id: req.params.id, userId: req.user._id });
  if (!income) throw ApiError.notFound('Income entry not found');

  ['amount', 'source', 'note', 'date'].forEach((f) => {
    if (req.body[f] !== undefined) income[f] = req.body[f];
  });

  await income.save();
  res.json({ success: true, message: 'Income updated', data: { income } });
});

/** DELETE /api/income/:id */
const deleteIncome = asyncHandler(async (req, res) => {
  const income = await Income.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!income) throw ApiError.notFound('Income entry not found');
  res.json({ success: true, message: 'Income deleted', data: { id: req.params.id } });
});

module.exports = { listIncome, incomeSummary, createIncome, updateIncome, deleteIncome };
