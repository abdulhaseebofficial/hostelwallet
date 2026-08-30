/**
 * notificationService — creates the in-app alerts shown in the bell menu.
 *
 * Every alert carries a `dedupeKey` and the table has a unique index on
 * (user_id, dedupe_key), so re-running the checks is safe: a duplicate insert
 * is swallowed instead of spamming the student with the same warning.
 */

const notificationsRepo = require('../db/notifications');
const expensesRepo = require('../db/expenses');
const goalsRepo = require('../db/goals');
const { budgetProgress } = require('./analyticsService');
const { currentPeriod, daysBetween } = require('../utils/calculations');

const periodKey = ({ month, year }) => `${year}-${String(month).padStart(2, '0')}`;
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * Insert one notification, ignoring duplicates.
 *
 * The ON CONFLICT in the repository does the swallowing, so a duplicate comes
 * back as null rather than as an error to catch.
 */
const push = async (userId, { type, title, message, meta = {}, dedupeKey }) =>
  notificationsRepo.push(userId, { type, title, message, meta, dedupeKey });

/** Warn once per category per month when a budget crosses 80% and 100%. */
const checkOverspending = async (user) => {
  const period = currentPeriod();
  const rows = await budgetProgress(user._id, period.month, period.year);
  const created = [];

  for (const row of rows) {
    if (row.status === 'over') {
      const n = await push(user._id, {
        type: 'overspend',
        title: `Over budget: ${row.category}`,
        message: `You have spent ${user.currency} ${row.spent} against a ${user.currency} ${row.limit} limit for ${row.category} this month. That is ${row.usedPercent}% of the limit.`,
        meta: { category: row.category, spent: row.spent, limit: row.limit },
        dedupeKey: `overspend:${row.category}:${periodKey(period)}`,
      });
      if (n) created.push(n);
    } else if (row.status === 'warning') {
      const n = await push(user._id, {
        type: 'overspend',
        title: `${row.category} is at ${row.usedPercent}%`,
        message: `Only ${user.currency} ${row.remaining} left in your ${row.category} budget this month. Slow down a little to stay inside it.`,
        meta: { category: row.category, spent: row.spent, limit: row.limit },
        dedupeKey: `budget-warning:${row.category}:${periodKey(period)}`,
      });
      if (n) created.push(n);
    }
  }

  return created;
};

/** Remind about goals whose deadline is within a week (and overdue ones). */
const checkGoalDeadlines = async (user) => {
  const goals = await goalsRepo.findDueSoon(user._id, 7);

  const created = [];
  for (const goal of goals) {
    const daysLeft = daysBetween(new Date(), new Date(goal.deadline));
    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    const overdue = daysLeft < 0;

    const n = await push(user._id, {
      type: 'goal_deadline',
      title: overdue ? `Goal overdue: ${goal.title}` : `${goal.title} is due in ${daysLeft} day(s)`,
      message: overdue
        ? `The deadline for "${goal.title}" has passed and ${user.currency} ${remaining} is still short. Push the deadline out or top it up.`
        : `You still need ${user.currency} ${remaining} for "${goal.title}". That is about ${user.currency} ${Math.ceil(remaining / Math.max(1, daysLeft))} a day.`,
      meta: { goalId: goal._id, remaining, daysLeft },
      dedupeKey: `goal:${goal._id}:${dayKey()}`,
    });
    if (n) created.push(n);
  }

  return created;
};

/** Nudge the student if nothing has been logged for two days. */
const checkLogReminder = async (user) => {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const recent = await expensesRepo.countCreatedSince(user._id, twoDaysAgo);
  if (recent > 0) return [];

  const n = await push(user._id, {
    type: 'log_reminder',
    title: 'Log your expenses',
    message: 'Nothing logged for two days. Add today’s spends while you still remember them, even the small ones.',
    dedupeKey: `log-reminder:${dayKey()}`,
  });

  return n ? [n] : [];
};

/** Flag recurring bills falling due in the next three days. */
const checkBillsDue = async (user) => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);

  const bills = await expensesRepo.findBillsDueBy(user._id, soon);

  const created = [];
  for (const bill of bills) {
    const n = await push(user._id, {
      type: 'bill_due',
      title: `${bill.category} bill coming up`,
      message: `${bill.description || bill.category} of ${user.currency} ${bill.amount} is due on ${new Date(
        bill.nextRunAt
      ).toDateString()}. Keep that aside.`,
      meta: { expenseId: bill._id, amount: bill.amount },
      dedupeKey: `bill:${bill._id}:${new Date(bill.nextRunAt).toISOString().slice(0, 10)}`,
    });
    if (n) created.push(n);
  }

  return created;
};

/** Run every check for one user. Called on dashboard load and by the cron job. */
const runChecksForUser = async (user) => {
  const results = await Promise.allSettled([
    checkOverspending(user),
    checkGoalDeadlines(user),
    checkLogReminder(user),
    checkBillsDue(user),
  ]);

  results
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('[notifications] check failed:', r.reason && r.reason.message));

  return results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
};

module.exports = {
  push,
  checkOverspending,
  checkGoalDeadlines,
  checkLogReminder,
  checkBillsDue,
  runChecksForUser,
};
