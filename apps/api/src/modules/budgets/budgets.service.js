/**
 * Budget rules.
 *
 * A budget is a limit for one category in one month. The rules here are about
 * which categories a student may budget for, how a repeated limit replaces the
 * old one instead of failing, and what the month adds up to against income.
 *
 * Reading a budget always goes through analytics, because a limit on its own
 * says nothing - it is only useful next to what has actually been spent.
 */

const budgetsRepo = require('./budgets.repository');
const users = require('../users/users.service');
const ApiError = require('../../shared/errors/ApiError');
const { currentPeriod, round2 } = require('../../shared/utils/calculations');
const { budgetProgress } = require('../analytics/analytics.service');

/** Resolves ?month=&year= against the current period. */
const periodFrom = (source = {}) => {
  const now = currentPeriod();
  return {
    month: Number(source.month) || now.month,
    year: Number(source.year) || now.year,
  };
};

const assertOwnCategory = (user, category) => {
  if (!users.allCategories(user).includes(category)) {
    throw ApiError.badRequest(`"${category}" is not one of your categories`);
  }
};

/** Every category limit for a month, joined with real spend, plus the totals. */
const listForMonth = async (user, query) => {
  const { month, year } = periodFrom(query);
  const items = await budgetProgress(user._id, month, year);

  const totals = items.reduce(
    (acc, row) => {
      acc.limit += row.limit;
      acc.spent += row.spent;
      return acc;
    },
    { limit: 0, spent: 0 }
  );

  const income = user.monthlyIncome || 0;

  return {
    month,
    year,
    items,
    totals: {
      limit: round2(totals.limit),
      spent: round2(totals.spent),
      remaining: round2(totals.limit - totals.spent),
      income: round2(income),
      unallocated: round2(income - totals.limit),
    },
  };
};

/**
 * Upsert semantics: setting a limit for a category that already has one for
 * that month replaces it instead of failing on the unique index.
 */
const setLimit = async (user, body, query) => {
  const { category, limit } = body;
  const { month, year } = periodFrom({ ...query, ...body });

  assertOwnCategory(user, category);

  return budgetsRepo.upsert(user._id, category, limit, month, year);
};

/**
 * Saves a whole plan in one call - used by the "apply AI budget" button.
 * Unknown categories and negative limits are dropped rather than failing the
 * batch, so one bad row from a suggestion does not lose the rest.
 */
const setPlan = async (user, body, query) => {
  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Send a list of budgets');
  }

  const { month, year } = periodFrom({ ...query, ...body });
  const allowed = users.allCategories(user);

  const valid = items.filter(
    (item) => allowed.includes(item.category) && Number(item.limit) >= 0
  );
  if (!valid.length) throw ApiError.badRequest('None of those categories are valid');

  const written = await budgetsRepo.upsertMany(user._id, valid, month, year);
  const rows = await budgetProgress(user._id, month, year);

  return { written, month, year, items: rows };
};

const update = async (id, userId, limit) => {
  const existing = await budgetsRepo.findById(id, userId);
  if (!existing) throw ApiError.notFound('Budget not found');

  // A request that names no limit is a no-op rather than an error.
  if (limit === undefined) return existing;
  return budgetsRepo.update(id, userId, limit);
};

const remove = async (id, userId) => {
  const removed = await budgetsRepo.remove(id, userId);
  if (!removed) throw ApiError.notFound('Budget not found');
  return id;
};

/* ------------------- for other modules to build on ------------------ */

/** The raw limits for a month. analytics joins these with real spend. */
const listForPeriod = (userId, month, year) => budgetsRepo.listForPeriod(userId, month, year);

/** Every limit this student has ever set, for the data export. */
const listAllForUser = (userId) => budgetsRepo.listAllForUser(userId);

module.exports = {
  listForPeriod,
  listAllForUser,
  listForMonth,
  setLimit,
  setPlan,
  update,
  remove,
};
