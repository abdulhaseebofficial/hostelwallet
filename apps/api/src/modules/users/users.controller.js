const usersRepo = require('./users.repository');
const expensesRepo = require('../expenses/expenses.repository');
const incomeRepo = require('../income/income.repository');
const goalsRepo = require('../goals/goals.repository');
const budgetsRepo = require('../budgets/budgets.repository');
const chatRepo = require('../advisor/advisor.repository');
const ApiError = require('../../shared/errors/ApiError');
const asyncHandler = require('../../shared/http/asyncHandler');
const { DEFAULT_CATEGORIES, DEFAULT_GOAL_ICON } = require('../../shared/constants');
const { REFRESH_COOKIE, refreshCookieOptions } = require('../auth/auth.tokens');

/** PUT /api/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'monthlyIncome', 'currency', 'university', 'hostelName', 'theme'];
  const patch = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  });

  const user = await usersRepo.updateProfile(req.user._id, patch);
  res.json({ success: true, message: 'Profile updated', data: { user: usersRepo.toPublicUser(user) } });
});

/**
 * POST /api/profile/onboarding
 * Finishes the first-run wizard: income + currency in one shot, optional first goal.
 */
const completeOnboarding = asyncHandler(async (req, res) => {
  const { monthlyIncome, currency, university, hostelName, goal } = req.body;

  const user = await usersRepo.updateProfile(req.user._id, {
    monthlyIncome: monthlyIncome || 0,
    currency: currency || undefined,
    university: university === undefined ? undefined : university,
    hostelName: hostelName === undefined ? undefined : hostelName,
    onboardingCompleted: true,
  });

  let createdGoal = null;
  if (goal && goal.title && goal.targetAmount) {
    createdGoal = await goalsRepo.create(req.user._id, {
      title: goal.title,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline || null,
      icon: goal.icon || DEFAULT_GOAL_ICON,
    });
  }

  res.json({
    success: true,
    message: 'You are all set!',
    data: { user: usersRepo.toPublicUser(user), goal: createdGoal },
  });
});

/** GET /api/profile/categories - default + custom categories for this user. */
const getCategories = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      defaults: DEFAULT_CATEGORIES,
      custom: req.user.customCategories,
      all: usersRepo.allCategories(req.user),
    },
  });
});

/** POST /api/profile/categories - add a custom category. */
const addCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Category name is required');

  const existing = usersRepo.allCategories(req.user).map((c) => c.toLowerCase());
  if (existing.includes(name.toLowerCase())) throw ApiError.conflict('That category already exists');

  const user = await usersRepo.updateProfile(req.user._id, {
    customCategories: [...req.user.customCategories, name],
  });

  res.status(201).json({
    success: true,
    message: `Added "${name}"`,
    data: { all: usersRepo.allCategories(user) },
  });
});

/** DELETE /api/profile/categories/:name - remove a custom category. */
const deleteCategory = asyncHandler(async (req, res) => {
  const name = decodeURIComponent(req.params.name);

  if (DEFAULT_CATEGORIES.includes(name)) {
    throw ApiError.badRequest('Built-in categories cannot be removed');
  }

  const inUse = await expensesRepo.countByCategory(req.user._id, name);
  if (inUse > 0) {
    throw ApiError.badRequest(
      `${inUse} expense(s) still use "${name}". Move them to another category first.`
    );
  }

  const user = await usersRepo.updateProfile(req.user._id, {
    customCategories: req.user.customCategories.filter((c) => c !== name),
  });

  res.json({
    success: true,
    message: `Removed "${name}"`,
    data: { all: usersRepo.allCategories(user) },
  });
});

/**
 * GET /api/profile/export
 * Full data export (GDPR-style "download everything I have").
 */
const exportData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [expenses, incomes, goals, budgets, chat] = await Promise.all([
    expensesRepo.listAllForUser(userId),
    incomeRepo.listAllForUser(userId),
    goalsRepo.list(userId, 'all'),
    budgetsRepo.listAllForUser(userId),
    chatRepo.listForUser(userId, 1000),
  ]);

  res.setHeader('Content-Disposition', 'attachment; filename="hostelwallet-data.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    profile: usersRepo.toPublicUser(req.user),
    expenses,
    incomes,
    goals,
    budgets,
    aiConversation: chat,
  });
});

/**
 * DELETE /api/profile
 * Deletes the account and everything attached to it. Requires the password so
 * a stolen access token alone cannot wipe an account.
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await usersRepo.findById(req.user._id, { withPassword: true });
  const { password } = req.body;

  if (!password || !(await usersRepo.comparePassword(password, user.password))) {
    throw ApiError.badRequest('Enter your current password to confirm deletion');
  }

  // Every child table is ON DELETE CASCADE, so this takes the data with it.
  await usersRepo.remove(req.user._id);

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ success: true, message: 'Your account and all data have been deleted' });
});

module.exports = {
  updateProfile,
  completeOnboarding,
  getCategories,
  addCategory,
  deleteCategory,
  exportData,
  deleteAccount,
};
