const User = require('../models/User');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const Goal = require('../models/Goal');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');
const ChatMessage = require('../models/ChatMessage');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { DEFAULT_CATEGORIES } = require('../config/constants');
const { REFRESH_COOKIE, refreshCookieOptions } = require('../utils/generateToken');

/** PUT /api/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'monthlyIncome', 'currency', 'university', 'hostelName', 'theme'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  });

  await req.user.save();
  res.json({ success: true, message: 'Profile updated', data: { user: req.user.toJSON() } });
});

/**
 * POST /api/profile/onboarding
 * Finishes the first-run wizard: income + currency in one shot, optional first goal.
 */
const completeOnboarding = asyncHandler(async (req, res) => {
  const { monthlyIncome, currency, university, hostelName, goal } = req.body;

  req.user.monthlyIncome = monthlyIncome || 0;
  if (currency) req.user.currency = currency;
  if (university !== undefined) req.user.university = university;
  if (hostelName !== undefined) req.user.hostelName = hostelName;
  req.user.onboardingCompleted = true;
  await req.user.save();

  let createdGoal = null;
  if (goal && goal.title && goal.targetAmount) {
    createdGoal = await Goal.create({
      userId: req.user._id,
      title: goal.title,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline || undefined,
      icon: goal.icon || '\uD83C\uDFAF',
    });
  }

  res.json({
    success: true,
    message: 'You are all set!',
    data: { user: req.user.toJSON(), goal: createdGoal },
  });
});

/** GET /api/profile/categories - default + custom categories for this user. */
const getCategories = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      defaults: DEFAULT_CATEGORIES,
      custom: req.user.customCategories,
      all: req.user.allCategories(),
    },
  });
});

/** POST /api/profile/categories - add a custom category. */
const addCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Category name is required');

  const existing = req.user.allCategories().map((c) => c.toLowerCase());
  if (existing.includes(name.toLowerCase())) throw ApiError.conflict('That category already exists');

  req.user.customCategories.push(name);
  await req.user.save();

  res.status(201).json({
    success: true,
    message: `Added "${name}"`,
    data: { all: req.user.allCategories() },
  });
});

/** DELETE /api/profile/categories/:name - remove a custom category. */
const deleteCategory = asyncHandler(async (req, res) => {
  const name = decodeURIComponent(req.params.name);

  if (DEFAULT_CATEGORIES.includes(name)) {
    throw ApiError.badRequest('Built-in categories cannot be removed');
  }

  const inUse = await Expense.countDocuments({ userId: req.user._id, category: name });
  if (inUse > 0) {
    throw ApiError.badRequest(
      `${inUse} expense(s) still use "${name}". Move them to another category first.`
    );
  }

  req.user.customCategories = req.user.customCategories.filter((c) => c !== name);
  await req.user.save();

  res.json({ success: true, message: `Removed "${name}"`, data: { all: req.user.allCategories() } });
});

/**
 * GET /api/profile/export
 * Full data export (GDPR-style "download everything I have").
 */
const exportData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [expenses, incomes, goals, budgets, chat] = await Promise.all([
    Expense.find({ userId }).sort({ date: -1 }).lean(),
    Income.find({ userId }).sort({ date: -1 }).lean(),
    Goal.find({ userId }).lean(),
    Budget.find({ userId }).lean(),
    ChatMessage.find({ userId }).sort({ createdAt: 1 }).lean(),
  ]);

  res.setHeader('Content-Disposition', 'attachment; filename="hostelwallet-data.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    profile: req.user.toJSON(),
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
  const user = await User.findById(req.user._id).select('+password');
  const { password } = req.body;

  if (!password || !(await user.comparePassword(password))) {
    throw ApiError.badRequest('Enter your current password to confirm deletion');
  }

  const userId = req.user._id;
  await Promise.all([
    Expense.deleteMany({ userId }),
    Income.deleteMany({ userId }),
    Goal.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    ChatMessage.deleteMany({ userId }),
  ]);
  await User.findByIdAndDelete(userId);

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
