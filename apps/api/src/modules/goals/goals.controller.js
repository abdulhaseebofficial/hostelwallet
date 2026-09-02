const goalsRepo = require('./goals.repository');
const ApiError = require('../../shared/errors/ApiError');
const asyncHandler = require('../../shared/http/asyncHandler');
const { goalPace, round2 } = require('../../shared/utils/calculations');
const { push } = require('../notifications/notifications.service');
const { DEFAULT_GOAL_ICON } = require('../../shared/constants');

/** Adds the derived pace fields the UI needs on top of the stored row. */
const decorate = (goal) => ({
  ...goal,
  progress: goal.targetAmount ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0,
  ...goalPace(goal),
});

/** GET /api/goals - ?status=active|completed|all (default all) */
const listGoals = asyncHandler(async (req, res) => {
  const goals = await goalsRepo.list(req.user._id, req.query.status);

  const decorated = goals.map(decorate);
  const totals = decorated.reduce(
    (acc, g) => {
      acc.targeted += g.targetAmount;
      acc.saved += g.savedAmount;
      return acc;
    },
    { targeted: 0, saved: 0 }
  );

  res.json({
    success: true,
    data: {
      items: decorated,
      summary: {
        count: decorated.length,
        active: decorated.filter((g) => !g.isCompleted).length,
        completed: decorated.filter((g) => g.isCompleted).length,
        totalTargeted: round2(totals.targeted),
        totalSaved: round2(totals.saved),
      },
    },
  });
});

/** GET /api/goals/:id */
const getGoal = asyncHandler(async (req, res) => {
  const goal = await goalsRepo.findById(req.params.id, req.user._id);
  if (!goal) throw ApiError.notFound('Goal not found');
  res.json({ success: true, data: { goal: decorate(goal) } });
});

/** POST /api/goals */
const createGoal = asyncHandler(async (req, res) => {
  const { title, targetAmount, savedAmount, deadline, icon, note } = req.body;

  if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
    throw ApiError.badRequest('The deadline cannot be in the past');
  }

  const goal = await goalsRepo.create(req.user._id, {
    title,
    targetAmount,
    savedAmount: savedAmount || 0,
    deadline: deadline || null,
    icon: icon || DEFAULT_GOAL_ICON,
    note: note || '',
  });

  res.status(201).json({ success: true, message: 'Goal created', data: { goal: decorate(goal) } });
});

/** PUT /api/goals/:id */
const updateGoal = asyncHandler(async (req, res) => {
  const existing = await goalsRepo.findById(req.params.id, req.user._id);
  if (!existing) throw ApiError.notFound('Goal not found');

  const patch = {};
  ['title', 'targetAmount', 'deadline', 'icon', 'note'].forEach((f) => {
    if (req.body[f] !== undefined) patch[f] = req.body[f];
  });

  const goal = await goalsRepo.update(req.params.id, req.user._id, patch);
  res.json({ success: true, message: 'Goal updated', data: { goal: decorate(goal) } });
});

/**
 * PATCH /api/goals/:id/add
 * One endpoint for both directions: a negative amount is a withdrawal.
 */
const contribute = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || Number.isNaN(amount)) throw ApiError.badRequest('Enter an amount');

  const { goal, wasCompleted, overdrawn } = await goalsRepo.contribute(
    req.params.id,
    req.user._id,
    amount,
    req.body.note || ''
  );

  if (overdrawn) {
    throw ApiError.badRequest('You cannot withdraw more than you have saved in this goal');
  }
  if (!goal) throw ApiError.notFound('Goal not found');

  // Celebrate the first time a goal is reached.
  const justCompleted = !wasCompleted && goal.isCompleted;
  if (justCompleted) {
    await push(req.user._id, {
      type: 'goal_completed',
      title: `Goal reached: ${goal.title}`,
      message: `You saved the full ${req.user.currency} ${goal.targetAmount}. That is real discipline. Time to set the next one!`,
      meta: { goalId: goal._id },
      dedupeKey: `goal-done:${goal._id}`,
    });
  }

  res.json({
    success: true,
    message: amount >= 0 ? `Added to "${goal.title}"` : `Withdrawn from "${goal.title}"`,
    data: { goal: decorate(goal), justCompleted },
  });
});

/** DELETE /api/goals/:id */
const deleteGoal = asyncHandler(async (req, res) => {
  const removed = await goalsRepo.remove(req.params.id, req.user._id);
  if (!removed) throw ApiError.notFound('Goal not found');
  res.json({ success: true, message: 'Goal deleted', data: { id: req.params.id } });
});

module.exports = { listGoals, getGoal, createGoal, updateGoal, contribute, deleteGoal };
