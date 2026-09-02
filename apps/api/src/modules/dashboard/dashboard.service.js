/**
 * The home screen, assembled.
 *
 * Dashboard owns no data of its own. What it decides is which numbers belong
 * on the home screen and in what shape, drawing on analytics for the month's
 * snapshot and on expenses for the recent list.
 *
 * Loading the dashboard is also the natural moment to catch recurring bills up
 * and refresh alerts, because it is the one screen a student opens every day.
 * Both are safe to re-run.
 */

const expenses = require('../expenses/expenses.service');
const advisor = require('../advisor/advisor.service');
const { buildSnapshot } = require('../analytics/analytics.service');
const {
  materializeForUser,
} = require('../../infrastructure/scheduling/recurringExpenses.job');
const { runChecksForUser } = require('../notifications/notifications.service');
const { currentPeriod, changePercent } = require('../../shared/utils/calculations');

const RECENT_EXPENSE_COUNT = 8;

const periodFrom = (query = {}) => {
  const now = currentPeriod();
  return {
    month: Number(query.month) || now.month,
    year: Number(query.year) || now.year,
  };
};

const summary = async (user, query) => {
  const period = periodFrom(query);

  await materializeForUser(user._id);

  const [snapshot, recent] = await Promise.all([
    buildSnapshot(user, period),
    expenses.listRecent(user._id, RECENT_EXPENSE_COUNT),
  ]);

  // Fire and forget: the student should not wait on the alert rules.
  runChecksForUser(user).catch((err) => console.error('[notifications]', err.message));

  return {
    period,
    monthLabel: snapshot.monthLabel,
    currency: user.currency,

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
    recentExpenses: recent.items,

    aiConfigured: advisor.isConfigured(),
  };
};

module.exports = { summary };
