/**
 * Which categories a student may use.
 *
 * A pure question about a user object: the built-in list plus whatever they
 * have added. No database, no I/O, nothing to await.
 *
 * It lived on the users repository, which meant expenses, budgets and the
 * advisor all had to depend on the whole users module to ask it - three
 * dependency cycles bought with one function that reads a property. It belongs
 * here, where anything can ask without taking on a module.
 */

const { DEFAULT_CATEGORIES } = require('./constants');

/**
 * Every category this user can pick from: the defaults first, then their own,
 * in the order they were added. Duplicates are not filtered - a custom
 * category that clashes with a built-in one is refused when it is created, so
 * one appearing here would be a bug worth seeing rather than hiding.
 */
const allCategories = (user) => [
  ...DEFAULT_CATEGORIES,
  ...((user && user.customCategories) || []),
];

/** Whether a name is one this user may file an expense or a budget under. */
const isOwnCategory = (user, category) => allCategories(user).includes(category);

module.exports = { allCategories, isOwnCategory, DEFAULT_CATEGORIES };
