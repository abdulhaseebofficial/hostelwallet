const Goal = require('../models/Goal');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { goalPace, round2 } = require('../utils/calculations');
const { push } = require('../services/notificationService');

/** Adds the derived pace fields the UI needs on top of the stored document. */
const decorate = (goal) => {
  const plain = goal.toObject ? goal.toObject() : goal;
  return {
    ...plain,
    progress: plain.targetAmount ? Math.min(100, Math.round((plain.savedAmount / plain.targetAmount) * 100)) : 0,
    ...goalPace(plain),
  };
};

/** GET /api/goals - ?status=active|completed|all (default all) */
const listGoals = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.status === 'active') filter.isCompleted = false;
  if (req.query.status === 'completed') filter.isCompleted = true;

  const goals = await Goal.find(filter).sort({ isCompleted: 1, deadline: 1, createdAt: -1 });

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
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw ApiError.notFound('Goal not found');
  res.json({ success: true, data: { goal: decorate(goal) } });
});

/** POST /api/goals */
const createGoal = asyncHandler(async (req, res) => {
  const { title, targetAmount, savedAmount, deadline, icon, note } = req.body;

  if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
    throw ApiError.badRequest('The deadline cannot be in the past');
  }

  const goal = await Goal.create({
    userId: req.user._id,
    title,
    targetAmount,
    savedAmount: savedAmount || 0,
    deadline: deadline || undefined,
    icon: icon || '\uD83C\uDFAF',
    note: note || '',
  });

  res.status(201).json({ success: true, message: 'Goal created', data: { goal: decorate(goal) } });
});

/** PUT /api/goals/:id */
const updateGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw ApiError.notFound('Goal not found');

  ['title', 'targetAmount', 'deadline', 'icon', 'note'].forEach((f) => {
    if (req.body[f] !== undefined) goal[f] = req.body[f];
  });

  await goal.save();
  res.json({ success: true, message: 'Goal updated', data: { goal: decorate(goal) } });
});

/**
 * PATCH /api/goals/:id/add
 * One endpoint for both directions: a negative amount is a withdrawal.
 */
const contribute = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || Number.isNaN(amount)) throw ApiError.badRequest('Enter an amount');

  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw ApiError.notFound('Goal not found');

  const next = round2(goal.savedAmount + amount);
  if (next < 0) throw ApiError.badRequest('You cannot withdraw more than you have saved in this goal');

  const wasCompleted = goal.isCompleted;
  goal.savedAmount = next;
  goal.contributions.push({ amount, date: new Date(), note: req.body.note || '' });
  await goal.save();

  // Celebrate the first time a goal is reached.
  if (!wasCompleted && goal.isCompleted) {
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
    data: { goal: decorate(goal), justCompleted: !wasCompleted && goal.isCompleted },
  });
});

/** DELETE /api/goals/:id */
const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw ApiError.notFound('Goal not found');
  res.json({ success: true, message: 'Goal deleted', data: { id: req.params.id } });
});

module.exports = { listGoals, getGoal, createGoal, updateGoal, contribute, deleteGoal };
