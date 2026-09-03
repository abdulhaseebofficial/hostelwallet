/**
 * Which categories a student may use.
 *
 * Pure, and load-bearing: expenses and budgets both refuse a write whose
 * category is not in this list, so a change here silently changes what the API
 * accepts. Ordering matters too - the web app renders charts in this order.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { allCategories, isOwnCategory, DEFAULT_CATEGORIES } = require(path.join(
  __dirname, '..', '..', 'apps', 'api', 'src', 'shared', 'categories'
));

test('a user with no custom categories gets exactly the defaults', () => {
  assert.deepStrictEqual(allCategories({ customCategories: [] }), DEFAULT_CATEGORIES);
});

test('custom categories come after the defaults, in the order they were added', () => {
  const result = allCategories({ customCategories: ['Gym', 'Laundry'] });

  assert.deepStrictEqual(result.slice(0, DEFAULT_CATEGORIES.length), DEFAULT_CATEGORIES);
  assert.deepStrictEqual(result.slice(-2), ['Gym', 'Laundry']);
  assert.strictEqual(result.length, DEFAULT_CATEGORIES.length + 2);
});

test('a missing customCategories is treated as none, not as a crash', () => {
  // The three call sites pass whatever the auth middleware loaded, so this has
  // to survive a user object that predates the column or came back partial.
  assert.deepStrictEqual(allCategories({}), DEFAULT_CATEGORIES);
  assert.deepStrictEqual(allCategories({ customCategories: null }), DEFAULT_CATEGORIES);
  assert.deepStrictEqual(allCategories({ customCategories: undefined }), DEFAULT_CATEGORIES);
  assert.deepStrictEqual(allCategories(null), DEFAULT_CATEGORIES);
  assert.deepStrictEqual(allCategories(undefined), DEFAULT_CATEGORIES);
});

test('the defaults are not mutated by building a list', () => {
  const before = [...DEFAULT_CATEGORIES];
  const result = allCategories({ customCategories: ['Gym'] });
  result.push('Injected');

  assert.deepStrictEqual(DEFAULT_CATEGORIES, before, 'the shared array must not be shared by reference');
});

test('duplicates are kept rather than quietly merged', () => {
  // A custom category clashing with a built-in one is refused when it is
  // created, so one showing up here means something upstream is wrong and
  // hiding it would hide the bug.
  const result = allCategories({ customCategories: ['Travel'] });
  assert.strictEqual(result.filter((c) => c === 'Travel').length, 2);
});

test('isOwnCategory accepts a default and a custom one', () => {
  const user = { customCategories: ['Gym'] };
  assert.strictEqual(isOwnCategory(user, 'Mess/Food'), true);
  assert.strictEqual(isOwnCategory(user, 'Gym'), true);
});

test('isOwnCategory rejects anything else', () => {
  const user = { customCategories: ['Gym'] };
  assert.strictEqual(isOwnCategory(user, 'NotMine'), false);
  assert.strictEqual(isOwnCategory(user, ''), false);
  assert.strictEqual(isOwnCategory(user, null), false);
  assert.strictEqual(isOwnCategory(user, undefined), false);
});

test('isOwnCategory is case and whitespace sensitive', () => {
  const user = { customCategories: [] };
  // The API stores what the student typed, so a near-match is not a match -
  // otherwise "travel" and "Travel" would become two categories on a chart.
  assert.strictEqual(isOwnCategory(user, 'travel'), false);
  assert.strictEqual(isOwnCategory(user, 'Travel '), false);
  assert.strictEqual(isOwnCategory(user, 'Travel'), true);
});
