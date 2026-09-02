/**
 * Account and profile rules.
 *
 * This module owns the `users` table, so anything else that needs a student's
 * record goes through here rather than reaching for the repository - auth in
 * particular, which owns sessions but not accounts.
 *
 * The rules that live here are about what a student may change (a fixed list
 * of fields, never the private columns), what a category may be called, and
 * what has to be true before an account can be deleted.
 */

const usersRepo = require('./users.repository');
const expensesRepo = require('../expenses/expenses.repository');
const incomeRepo = require('../income/income.repository');
const goalsRepo = require('../goals/goals.repository');
const budgetsRepo = require('../budgets/budgets.repository');
const chatRepo = require('../advisor/advisor.repository');
const ApiError = require('../../shared/errors/ApiError');
const { DEFAULT_CATEGORIES, DEFAULT_GOAL_ICON } = require('../../shared/constants');

const EXPORT_CHAT_LIMIT = 1000;

/** The only profile fields a student is allowed to set directly. */
const EDITABLE = ['name', 'monthlyIncome', 'currency', 'university', 'hostelName', 'theme'];

const toPublic = usersRepo.toPublicUser;

/* ----------------------------- profile ------------------------------ */

const updateProfile = async (userId, body) => {
  const patch = {};
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined) patch[field] = body[field];
  });

  const user = await usersRepo.updateProfile(userId, patch);
  return toPublic(user);
};

/**
 * Finishes the first-run wizard: income and currency in one shot, plus an
 * optional first goal so the student lands on a dashboard with something on it.
 */
const completeOnboarding = async (userId, body) => {
  const { monthlyIncome, currency, university, hostelName, goal } = body;

  const user = await usersRepo.updateProfile(userId, {
    monthlyIncome: monthlyIncome || 0,
    currency: currency || undefined,
    university: university === undefined ? undefined : university,
    hostelName: hostelName === undefined ? undefined : hostelName,
    onboardingCompleted: true,
  });

  let createdGoal = null;
  if (goal && goal.title && goal.targetAmount) {
    createdGoal = await goalsRepo.create(userId, {
      title: goal.title,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline || null,
      icon: goal.icon || DEFAULT_GOAL_ICON,
    });
  }

  return { user: toPublic(user), goal: createdGoal };
};

/* ---------------------------- categories ---------------------------- */

const listCategories = (user) => ({
  defaults: DEFAULT_CATEGORIES,
  custom: user.customCategories,
  all: usersRepo.allCategories(user),
});

const addCategory = async (user, rawName) => {
  const name = String(rawName || '').trim();
  if (!name) throw ApiError.badRequest('Category name is required');

  // Case-insensitive, so "travel" cannot sit beside the built-in "Travel".
  const existing = usersRepo.allCategories(user).map((c) => c.toLowerCase());
  if (existing.includes(name.toLowerCase())) {
    throw ApiError.conflict('That category already exists');
  }

  const updated = await usersRepo.updateProfile(user._id, {
    customCategories: [...user.customCategories, name],
  });

  return { name, all: usersRepo.allCategories(updated) };
};

/**
 * Removing a category the student still uses would orphan those expenses, so
 * it is refused with a count rather than silently reassigning them.
 */
const removeCategory = async (user, rawName) => {
  const name = decodeURIComponent(rawName);

  if (DEFAULT_CATEGORIES.includes(name)) {
    throw ApiError.badRequest('Built-in categories cannot be removed');
  }

  const inUse = await expensesRepo.countByCategory(user._id, name);
  if (inUse > 0) {
    throw ApiError.badRequest(
      `${inUse} expense(s) still use "${name}". Move them to another category first.`
    );
  }

  const updated = await usersRepo.updateProfile(user._id, {
    customCategories: user.customCategories.filter((c) => c !== name),
  });

  return { name, all: usersRepo.allCategories(updated) };
};

/* ------------------------------ account ----------------------------- */

/** Everything this student has, for a "download all my data" request. */
const exportEverything = async (user) => {
  const [expenses, incomes, goals, budgets, chat] = await Promise.all([
    expensesRepo.listAllForUser(user._id),
    incomeRepo.listAllForUser(user._id),
    goalsRepo.list(user._id, 'all'),
    budgetsRepo.listAllForUser(user._id),
    chatRepo.listForUser(user._id, EXPORT_CHAT_LIMIT),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: toPublic(user),
    expenses,
    incomes,
    goals,
    budgets,
    aiConversation: chat,
  };
};

/**
 * Deletes the account and everything attached to it.
 *
 * The password is required so a stolen access token on its own cannot wipe an
 * account. Every child table is ON DELETE CASCADE, so removing the row takes
 * the data with it.
 */
const deleteAccount = async (userId, password) => {
  const user = await usersRepo.findById(userId, { withPassword: true });

  if (!password || !(await usersRepo.comparePassword(password, user.password))) {
    throw ApiError.badRequest('Enter your current password to confirm deletion');
  }

  await usersRepo.remove(userId);
};

/* ------------------- for other modules to build on ------------------ */

/** The account behind an email, with the password hash, for auth to check. */
const findCredentialsByEmail = (email) => usersRepo.findByEmail(email, { withPassword: true });

const findById = (userId, options) => usersRepo.findById(userId, options);

const allCategories = (user) => usersRepo.allCategories(user);

module.exports = {
  toPublic,
  updateProfile,
  completeOnboarding,
  listCategories,
  addCategory,
  removeCategory,
  exportEverything,
  deleteAccount,
  findCredentialsByEmail,
  findById,
  allCategories,
};
