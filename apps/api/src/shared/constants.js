/**
 * App-wide constants.
 *
 * The vocabulary the web app also needs - categories, payment methods,
 * currencies, notification and feedback types - lives in
 * @hostelwallet/contracts so the two cannot drift. It is re-exported here so
 * nothing inside the API has to know where it came from.
 *
 * What stays is what only the API decides.
 */

const contracts = require('@hostelwallet/contracts');

const {
  PAYMENT_METHODS,
  INCOME_SOURCES,
  RECURRING_FREQUENCIES,
  CURRENCIES,
  NOTIFICATION_TYPES,
  FEEDBACK_TYPES,
  DEVELOPER,
} = contracts;

/** Named DEFAULT_CATEGORIES here because a student can add their own. */
const DEFAULT_CATEGORIES = contracts.CATEGORIES;

/** The emoji a goal gets when the student does not pick one. */
// A sensible starting split used when the AI is unavailable (percent of income).
const FALLBACK_BUDGET_SPLIT = {
  'Mess/Food': 0.28,
  'Rent/Hostel Fee': 0.28,
  'Books & Stationery': 0.07,
  Travel: 0.07,
  'Mobile/Internet': 0.05,
  Entertainment: 0.08,
  Health: 0.04,
  'Personal Care': 0.05,
  Misc: 0.08,
};

const DEFAULT_GOAL_ICON = '🎯';

module.exports = {
  DEFAULT_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  RECURRING_FREQUENCIES,
  CURRENCIES,
  NOTIFICATION_TYPES,
  FALLBACK_BUDGET_SPLIT,
  DEVELOPER,
  DEFAULT_GOAL_ICON,
  FEEDBACK_TYPES,
};
