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
const lazyModule = require('../../shared/modules/lazyModule');

// Almost every feature asks users for the current account, so requiring
// them here at load time would close a circle with each of them.
const expenses = lazyModule(() => require('../expenses/expenses.service'));
const income = lazyModule(() => require('../income/income.service'));
const goals = lazyModule(() => require('../goals/goals.service'));
const budgets = lazyModule(() => require('../budgets/budgets.service'));
const advisor = lazyModule(() => require('../advisor/advisor.service'));
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
    createdGoal = await goals.create(userId, {
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

  const inUse = await expenses.countByCategory(user._id, name);
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
  // Named apart from the modules they come from: destructuring straight into
  // `expenses` and friends would shadow the imports the calls themselves use.
  const [allExpenses, allIncome, allGoals, allBudgets, chat] = await Promise.all([
    expenses.listAllForUser(user._id),
    income.listAllForUser(user._id),
    goals.listAllForUser(user._id),
    budgets.listAllForUser(user._id),
    advisor.exportChat(user._id, EXPORT_CHAT_LIMIT),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: toPublic(user),
    expenses: allExpenses,
    incomes: allIncome,
    goals: allGoals,
    budgets: allBudgets,
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

/** Whether an email is taken, without pulling the hash. */
const findByEmail = (email) => usersRepo.findByEmail(email);

/** Creates the account itself. auth wraps this with session handling. */
const createAccount = (input) => usersRepo.create(input);

const comparePassword = (candidate, hash) => usersRepo.comparePassword(candidate, hash);

/**
 * Sets a new password, which also clears any reset token, bumps the account's
 * token version and drops every stored session.
 */
const setPassword = (userId, password) => usersRepo.setPassword(userId, password);

const createPasswordResetToken = (userId) => usersRepo.createPasswordResetToken(userId);

const findByResetToken = (hashedToken) => usersRepo.findByResetToken(hashedToken);

/**
 * Invalidates every session for an account.
 *
 * Lives here rather than with auth because it deletes the session rows AND
 * bumps this table's token_version in one transaction - splitting it across
 * two modules would split the transaction.
 */
const revokeAllSessions = (userId) => usersRepo.revokeAllSessions(userId);

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
  findByEmail,
  createAccount,
  comparePassword,
  setPassword,
  createPasswordResetToken,
  findByResetToken,
  revokeAllSessions,
  findById,
  allCategories,
};
