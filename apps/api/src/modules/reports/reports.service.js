/**
 * Report rules.
 *
 * Works out what a month means - totals, movement against last month, budget
 * adherence, the biggest single expense - and hands back plain data. Turning
 * that data into a spreadsheet or a PDF is presentation and stays in the
 * controller, so this file has nothing to say about HTTP.
 */

const income = require('../income/income.service');
const expenses = require('../expenses/expenses.service');
const analytics = require('../analytics/analytics.service');
const { buildSnapshot, MONTH_NAMES } = analytics;
const {
  currentPeriod,
  previousPeriod,
  startOfMonth,
  endOfMonth,
  round2,
  changePercent,
} = require('../../shared/utils/calculations');

const periodFrom = (query = {}) => {
  const now = currentPeriod();
  return {
    month: Number(query.month) || now.month,
    year: Number(query.year) || now.year,
  };
};

/** Category-by-category movement between two months, biggest spend first. */
const compareCategories = (snapshot, previous) => {
  const categories = new Set([
    ...Object.keys(snapshot.byCategory),
    ...Object.keys(previous.byCategory),
  ]);

  return [...categories]
    .map((category) => {
      const current = snapshot.byCategory[category] || 0;
      const before = previous.byCategory[category] || 0;
      return {
        category,
        current,
        previous: before,
        change: round2(current - before),
        changePercent: changePercent(current, before),
      };
    })
    .sort((a, b) => b.current - a.current);
};

/**
 * The full month in one payload: totals, category breakdown, this-vs-last
 * comparison, budget adherence and the biggest single expense.
 */
const monthly = async (user, query) => {
  const period = periodFrom(query);
  const prev = previousPeriod(period);
  const from = startOfMonth(period.year, period.month);
  const to = endOfMonth(period.year, period.month);

  const [snapshot, prevSnapshot, biggest, incomeRows] = await Promise.all([
    buildSnapshot(user, period),
    buildSnapshot(user, prev),
    analytics.topExpenses(user._id, from, to, 1),
    income.totalsBySource(user._id, from, to),
  ]);

  return {
    period,
    monthLabel: snapshot.monthLabel,
    currency: user.currency,

    totals: {
      income: snapshot.income,
      spent: snapshot.totalSpent,
      saved: snapshot.remaining,
      savingsRate:
        snapshot.income > 0 ? Math.round((snapshot.remaining / snapshot.income) * 100) : 0,
      dailyAverage: snapshot.dailyAverage,
      transactionCount: snapshot.expenseCount,
    },

    breakdown: snapshot.breakdown,
    trend: snapshot.trend,
    highestCategory: snapshot.breakdown[0] || null,
    biggestExpense: biggest[0] || null,
    incomeBySource: incomeRows.map((row) => ({ source: row.source, amount: round2(row.total) })),

    comparison: {
      previousLabel: prevSnapshot.monthLabel,
      previousSpent: prevSnapshot.totalSpent,
      change: round2(snapshot.totalSpent - prevSnapshot.totalSpent),
      changePercent: changePercent(snapshot.totalSpent, prevSnapshot.totalSpent),
      categories: compareCategories(snapshot, prevSnapshot),
    },

    budgets: snapshot.budgets,
    overBudget: snapshot.budgets.filter((b) => b.status === 'over'),
    goals: snapshot.goals,
  };
};

/**
 * Everything an export needs: the month's snapshot, every transaction in it,
 * and the filename stem both formats use.
 */
const exportData = async (user, query) => {
  const period = periodFrom(query);
  const from = startOfMonth(period.year, period.month);
  const to = endOfMonth(period.year, period.month);

  const [snapshot, rows] = await Promise.all([
    buildSnapshot(user, period),
    expenses.listForRange(user._id, from, to),
  ]);

  return {
    period,
    snapshot,
    expenses: rows,
    label: `${MONTH_NAMES[period.month - 1]}-${period.year}`,
  };
};

module.exports = { monthly, exportData };
