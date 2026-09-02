/**
 * Savings goal rules.
 *
 * Everything the feature decides rather than stores lives here: what a goal
 * looks like once its pace is worked out, whether a deadline is acceptable,
 * what a contribution is allowed to do, and when reaching a goal is worth
 * telling the student about.
 *
 * The controller above this only turns requests into calls and results into
 * JSON; the repository below only reads and writes rows.
 */

const goalsRepo = require('./goals.repository');
const ApiError = require('../../shared/errors/ApiError');
const { goalPace, round2 } = require('../../shared/utils/calculations');
const { push } = require('../notifications/notifications.service');
const { DEFAULT_GOAL_ICON } = require('../../shared/constants');

/** Adds the derived pace fields the UI needs on top of the stored row. */
const decorate = (goal) => ({
  ...goal,
  progress: goal.targetAmount
    ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
    : 0,
  ...goalPace(goal),
});

/** Every goal for a student, decorated, with the totals the list header shows. */
const list = async (userId, status) => {
  const goals = await goalsRepo.list(userId, status);
  const items = goals.map(decorate);

  const totals = items.reduce(
    (acc, g) => {
      acc.targeted += g.targetAmount;
      acc.saved += g.savedAmount;
      return acc;
    },
    { targeted: 0, saved: 0 }
  );

  return {
    items,
    summary: {
      count: items.length,
      active: items.filter((g) => !g.isCompleted).length,
      completed: items.filter((g) => g.isCompleted).length,
      totalTargeted: round2(totals.targeted),
      totalSaved: round2(totals.saved),
    },
  };
};

const getById = async (id, userId) => {
  const goal = await goalsRepo.findById(id, userId);
  if (!goal) throw ApiError.notFound('Goal not found');
  return decorate(goal);
};

const create = async (userId, input) => {
  const { title, targetAmount, savedAmount, deadline, icon, note } = input;

  // Comparing against the start of today, not now, so a deadline of "today"
  // is still accepted for the rest of the day.
  if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
    throw ApiError.badRequest('The deadline cannot be in the past');
  }

  const goal = await goalsRepo.create(userId, {
    title,
    targetAmount,
    savedAmount: savedAmount || 0,
    deadline: deadline || null,
    icon: icon || DEFAULT_GOAL_ICON,
    note: note || '',
  });

  return decorate(goal);
};

/** Only the fields a student is allowed to change are copied across. */
const EDITABLE = ['title', 'targetAmount', 'deadline', 'icon', 'note'];

const update = async (id, userId, body) => {
  const existing = await goalsRepo.findById(id, userId);
  if (!existing) throw ApiError.notFound('Goal not found');

  const patch = {};
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined) patch[field] = body[field];
  });

  const goal = await goalsRepo.update(id, userId, patch);
  return decorate(goal);
};

/**
 * Add to a goal, or take money back out with a negative amount.
 *
 * Returns `justCompleted` so the UI can celebrate, and raises the notification
 * here rather than in the controller - reaching a goal is a fact about the
 * goal, not about the request that happened to cause it.
 */
const contribute = async (user, id, rawAmount, note) => {
  const amount = Number(rawAmount);
  if (!amount || Number.isNaN(amount)) throw ApiError.badRequest('Enter an amount');

  const { goal, wasCompleted, overdrawn } = await goalsRepo.contribute(
    id,
    user._id,
    amount,
    note || ''
  );

  if (overdrawn) {
    throw ApiError.badRequest('You cannot withdraw more than you have saved in this goal');
  }
  if (!goal) throw ApiError.notFound('Goal not found');

  const justCompleted = !wasCompleted && goal.isCompleted;
  if (justCompleted) {
    await push(user._id, {
      type: 'goal_completed',
      title: `Goal reached: ${goal.title}`,
      message: `You saved the full ${user.currency} ${goal.targetAmount}. That is real discipline. Time to set the next one!`,
      meta: { goalId: goal._id },
      dedupeKey: `goal-done:${goal._id}`,
    });
  }

  return { goal: decorate(goal), justCompleted, withdrawn: amount < 0 };
};

const remove = async (id, userId) => {
  const removed = await goalsRepo.remove(id, userId);
  if (!removed) throw ApiError.notFound('Goal not found');
  return id;
};

/* ------------------- for other modules to build on ------------------ */

/** The nearest open goals, for the dashboard strip. */
const listOpen = (userId, limit) => goalsRepo.listOpen(userId, limit);

/** Goals whose deadline falls inside `days`, for the alert rules. */
const listDueSoon = (userId, days) => goalsRepo.findDueSoon(userId, days);

/** Every goal, undecorated, for the data export. */
const listAllForUser = (userId) => goalsRepo.list(userId, 'all');

module.exports = {
  listOpen,
  listDueSoon,
  listAllForUser,
  list,
  getById,
  create,
  update,
  contribute,
  remove,
  decorate,
};
