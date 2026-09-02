/**
 * analyticsService — every aggregation the app needs, in one place.
 *
 * The dashboard, the reports page, the notification generator and the AI
 * advisor all consume the same `snapshot` object, so a number shown on screen
 * is always the same number the AI reasoned about.
 *
 * The SQL itself lives in db/analytics.js; what is left here is the shaping,
 * the zero-filling and the derived figures.
 */

const analytics = require('./analytics.repository');
const budgetsRepo = require('../budgets/budgets.repository');
const goalsRepo = require('../goals/goals.repository');
const {
  startOfMonth,
  endOfMonth,
  currentPeriod,
  previousPeriod,
  round2,
  shapeCategoryTotals,
  budgetStatus,
  daysBetween,
} = require('../../shared/utils/calculations');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The server's own UTC offset in minutes, e.g. 330 for +05:30.
 *
 * Everything in utils/calculations.js does its date arithmetic in the server's
 * local timezone (startOfMonth, endOfMonth, day numbers). Grouping the trend by
 * the same offset makes the database count days exactly the way this process
 * does, so the zero-filled series never drifts by a day. Set the TZ environment
 * variable on the host to control which timezone that is (Vercel defaults UTC).
 */
const serverOffsetMinutes = () => -new Date().getTimezoneOffset();

/** Total expenses grouped by category for a date range. */
const categoryTotals = async (userId, from, to) =>
  shapeCategoryTotals(await analytics.categoryTotals(userId, from, to));

/** Total expenses for a date range. */
const totalSpent = async (userId, from, to) => round2(await analytics.totalSpent(userId, from, to));

/** Total logged income for a date range. */
const totalIncome = async (userId, from, to) =>
  round2(await analytics.totalIncome(userId, from, to));

/**
 * Day-by-day spend for a range, with zero-filled gaps so the line chart does
 * not jump over days with no spending.
 */
const dailyTrend = async (userId, from, to) => {
  const rows = await analytics.dailyTotals(userId, from, to, serverOffsetMinutes());

  const byDay = Object.fromEntries(rows.map((r) => [r._id, round2(r.total)]));
  const out = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate()
    ).padStart(2, '0')}`;
    out.push({ date: key, day: cursor.getDate(), amount: byDay[key] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/** Budgets for a month, each joined with what has actually been spent. */
const budgetProgress = async (userId, month, year) => {
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);
  const [budgets, { byCategory }] = await Promise.all([
    budgetsRepo.listForPeriod(userId, month, year),
    categoryTotals(userId, from, to),
  ]);

  return budgets
    .map((b) => {
      const spent = byCategory[b.category] || 0;
      return {
        _id: b._id,
        category: b.category,
        limit: round2(b.limit),
        spent,
        remaining: round2(b.limit - spent),
        usedPercent: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0,
        status: budgetStatus(spent, b.limit),
        month: b.month,
        year: b.year,
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);
};

/**
 * The canonical monthly picture of one student's money.
 *
 * Income rule: `monthlyIncome` on the profile is the *planned* pocket money.
 * The income table holds what actually arrived. If anything was logged this
 * month we trust the logged figure, otherwise we fall back to the plan. Both
 * values are returned so the UI can show either.
 */
const buildSnapshot = async (user, period = currentPeriod()) => {
  const { month, year } = period;
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);

  const prev = previousPeriod({ month, year });
  const prevFrom = startOfMonth(prev.year, prev.month);
  const prevTo = endOfMonth(prev.year, prev.month);

  const [spent, loggedIncome, cats, trend, budgets, goals, previousMonthSpent, expenseCount] =
    await Promise.all([
      totalSpent(user._id, from, to),
      totalIncome(user._id, from, to),
      categoryTotals(user._id, from, to),
      dailyTrend(user._id, from, to),
      budgetProgress(user._id, month, year),
      goalsRepo.listOpen(user._id, 5),
      totalSpent(user._id, prevFrom, prevTo),
      analytics.countExpenses(user._id, from, to),
    ]);

  const plannedIncome = round2(user.monthlyIncome || 0);
  const income = loggedIncome > 0 ? loggedIncome : plannedIncome;

  const now = new Date();
  const isCurrentMonth = now >= from && now <= to;
  const daysElapsed = isCurrentMonth ? now.getDate() : to.getDate();
  const daysLeftInMonth = isCurrentMonth ? Math.max(0, daysBetween(now, to) - 1) : 0;

  return {
    month,
    year,
    monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
    from,
    to,

    income,
    plannedIncome,
    incomeLogged: loggedIncome,

    totalSpent: spent,
    remaining: round2(income - spent),
    spentPercent: income > 0 ? Math.round((spent / income) * 100) : 0,

    breakdown: cats.breakdown,
    byCategory: cats.byCategory,
    topCategory: cats.breakdown.length ? cats.breakdown[0].category : null,

    trend,
    budgets,
    goals: goals.map((g) => ({
      _id: g._id,
      title: g.title,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      deadline: g.deadline,
      progress: g.targetAmount ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0,
    })),

    previousMonthSpent,
    dailyAverage: daysElapsed > 0 ? round2(spent / daysElapsed) : 0,
    safeDailySpend: daysLeftInMonth > 0 ? round2(Math.max(0, income - spent) / daysLeftInMonth) : 0,
    daysElapsed,
    daysLeftInMonth,
    expenseCount,
  };
};

/** Snapshot of the last 7 days, used by the weekly AI summary. */
const buildWeeklySnapshot = async (user) => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);

  const [spent, cats, trend] = await Promise.all([
    totalSpent(user._id, from, to),
    categoryTotals(user._id, from, to),
    dailyTrend(user._id, from, to),
  ]);

  return {
    monthLabel: `the last 7 days (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)})`,
    income: round2(user.monthlyIncome || 0),
    totalSpent: spent,
    remaining: round2((user.monthlyIncome || 0) - spent),
    breakdown: cats.breakdown,
    byCategory: cats.byCategory,
    topCategory: cats.breakdown.length ? cats.breakdown[0].category : null,
    trend,
    budgets: [],
    goals: [],
    daysLeftInMonth: 7,
    dailyAverage: round2(spent / 7),
  };
};

module.exports = {
  MONTH_NAMES,
  categoryTotals,
  totalSpent,
  totalIncome,
  dailyTrend,
  budgetProgress,
  buildSnapshot,
  buildWeeklySnapshot,
};
