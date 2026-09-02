/**
 * Pure helpers for money / date maths. No DB access here so they stay easy to
 * reason about (and to unit-test).
 */

/** First millisecond of a month. `month` is 1-12. */
const startOfMonth = (year, month) => new Date(year, month - 1, 1, 0, 0, 0, 0);

/** Last millisecond of a month. */
const endOfMonth = (year, month) => new Date(year, month, 0, 23, 59, 59, 999);

/** Month/year of "now" (or of a supplied date) in 1-12 form. */
const currentPeriod = (date = new Date()) => ({
  month: date.getMonth() + 1,
  year: date.getFullYear(),
});

/** Previous month/year, wrapping across the new year. */
const previousPeriod = ({ month, year }) =>
  month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const daysBetween = (a, b) => Math.ceil((endOfDay(b) - startOfDay(a)) / (1000 * 60 * 60 * 24));

/** Round to 2 decimals without floating point noise (0.1+0.2 style). */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const percent = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);

/**
 * How much still has to be put aside, per day and per week, for a goal to be
 * funded by its deadline. Returns nulls when there is no deadline.
 */
const goalPace = (goal) => {
  const remaining = Math.max(0, round2(goal.targetAmount - goal.savedAmount));
  if (!goal.deadline) return { remaining, daysLeft: null, perDay: null, perWeek: null, isOverdue: false };

  const daysLeft = daysBetween(new Date(), new Date(goal.deadline));
  const isOverdue = daysLeft < 0 && remaining > 0;
  const safeDays = Math.max(1, daysLeft);

  return {
    remaining,
    daysLeft,
    // Rounded UP: this is the minimum that still reaches the target in time,
    // and whole rupees are what a student actually puts aside.
    perDay: remaining > 0 ? Math.ceil(remaining / safeDays) : 0,
    perWeek: remaining > 0 ? Math.ceil((remaining / safeDays) * 7) : 0,
    isOverdue,
  };
};

/**
 * Turn a list of {_id: category, total} aggregation rows into an object keyed
 * by category, plus a sorted array that is friendly for charts.
 */
const shapeCategoryTotals = (rows = []) => {
  const byCategory = {};
  let total = 0;
  rows.forEach((r) => {
    byCategory[r._id] = round2(r.total);
    total += r.total;
  });

  const breakdown = Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: percent(amount, total),
    }))
    .sort((a, b) => b.amount - a.amount);

  return { byCategory, breakdown, total: round2(total) };
};

/**
 * Traffic-light status for a budget line.
 * Spending exactly the limit is not "over" - it is nothing left, which is a
 * warning. Only genuinely exceeding the limit turns the line red.
 */
const budgetStatus = (spent, limit) => {
  if (!limit || limit <= 0) return 'none';
  const used = spent / limit;
  if (used > 1) return 'over';       // red
  if (used >= 0.8) return 'warning'; // yellow
  return 'safe';                     // green
};

/** Human readable delta between two numbers, e.g. +12.5% */
const changePercent = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0;
  return round2(((current - previous) / previous) * 100);
};

module.exports = {
  startOfMonth,
  endOfMonth,
  currentPeriod,
  previousPeriod,
  daysBetween,
  round2,
  percent,
  goalPace,
  shapeCategoryTotals,
  budgetStatus,
  changePercent,
};
