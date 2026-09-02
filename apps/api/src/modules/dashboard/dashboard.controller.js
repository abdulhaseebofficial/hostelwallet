const expensesRepo = require('../expenses/expenses.repository');
const asyncHandler = require('../../shared/http/asyncHandler');
const { buildSnapshot } = require('../analytics/analytics.service');
const { materializeForUser } = require('../../infrastructure/scheduling/recurringExpenses.job');
const { runChecksForUser } = require('../notifications/notifications.service');
const { currentPeriod, changePercent } = require('../../shared/utils/calculations');
const aiService = require('../advisor/advisor.service');

/**
 * GET /api/dashboard/summary
 * One call returns everything the home screen renders: headline numbers, the
 * pie chart data, the trend line, recent transactions and active goals.
 */
const getSummary = asyncHandler(async (req, res) => {
  const period = {
    month: Number(req.query.month) || currentPeriod().month,
    year: Number(req.query.year) || currentPeriod().year,
  };

  // Dashboard load is the natural moment to catch recurring bills up and
  // refresh alerts. Both are safe to re-run.
  await materializeForUser(req.user._id);

  const [snapshot, recent] = await Promise.all([
    buildSnapshot(req.user, period),
    expensesRepo.list(req.user._id, { limit: 8 }),
  ]);
  const recentExpenses = recent.items;

  runChecksForUser(req.user).catch((e) => console.error('[notifications]', e.message));

  res.json({
    success: true,
    data: {
      period,
      monthLabel: snapshot.monthLabel,
      currency: req.user.currency,

      // Headline cards
      totals: {
        income: snapshot.income,
        plannedIncome: snapshot.plannedIncome,
        incomeLogged: snapshot.incomeLogged,
        spent: snapshot.totalSpent,
        remaining: snapshot.remaining,
        spentPercent: snapshot.spentPercent,
        dailyAverage: snapshot.dailyAverage,
        safeDailySpend: snapshot.safeDailySpend,
        daysLeftInMonth: snapshot.daysLeftInMonth,
        expenseCount: snapshot.expenseCount,
      },

      // Charts
      categoryBreakdown: snapshot.breakdown,
      trend: snapshot.trend,

      // Comparison with last month
      comparison: {
        previousMonthSpent: snapshot.previousMonthSpent,
        changePercent: changePercent(snapshot.totalSpent, snapshot.previousMonthSpent),
      },

      budgets: snapshot.budgets,
      goals: snapshot.goals,
      recentExpenses,

      aiConfigured: aiService.isConfigured(),
    },
  });
});

module.exports = { getSummary };
