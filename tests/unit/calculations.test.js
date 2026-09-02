/**
 * The money and date helpers.
 *
 * These are pure, they are the arithmetic behind every number on screen, and
 * nothing else in the suite pins them down: the end-to-end checks would still
 * pass if a total were rounded the wrong way, as long as it were rounded the
 * wrong way consistently.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const calc = require(path.join(
  __dirname, '..', '..', 'apps', 'api', 'src', 'shared', 'utils', 'calculations'
));

test('round2 keeps two decimals and returns a number', () => {
  assert.strictEqual(calc.round2(10.005), 10.01);
  assert.strictEqual(calc.round2(2.344), 2.34);
  assert.strictEqual(calc.round2(7), 7);
  assert.strictEqual(typeof calc.round2('12.5'), 'number');
  // Documented, not endorsed: round2 does not defend against a missing value,
  // so every caller has to have summed a real number first.
  assert.ok(Number.isNaN(calc.round2(undefined)));
});

test('startOfMonth and endOfMonth cover the whole month', () => {
  const from = calc.startOfMonth(2026, 2); // February, a short month
  const to = calc.endOfMonth(2026, 2);

  assert.strictEqual(from.getFullYear(), 2026);
  assert.strictEqual(from.getMonth(), 1, 'month is 1-based on the way in');
  assert.strictEqual(from.getDate(), 1);
  assert.strictEqual(from.getHours(), 0);

  assert.strictEqual(to.getMonth(), 1, 'the end must not spill into March');
  assert.strictEqual(to.getDate(), 28);
  assert.strictEqual(to.getHours(), 23);
});

test('endOfMonth handles a leap year', () => {
  assert.strictEqual(calc.endOfMonth(2028, 2).getDate(), 29);
});

test('previousPeriod steps back across the year boundary', () => {
  assert.deepStrictEqual(calc.previousPeriod({ month: 1, year: 2026 }), { month: 12, year: 2025 });
  assert.deepStrictEqual(calc.previousPeriod({ month: 7, year: 2026 }), { month: 6, year: 2026 });
});

test('changePercent reports growth, and copes with a zero baseline', () => {
  assert.strictEqual(calc.changePercent(150, 100), 50);
  assert.strictEqual(calc.changePercent(50, 100), -50);
  assert.strictEqual(calc.changePercent(100, 100), 0);
  // Spending after a month of nothing is not an infinite increase.
  assert.strictEqual(Number.isFinite(calc.changePercent(100, 0)), true);
});

test('budgetStatus names the traffic light', () => {
  assert.strictEqual(calc.budgetStatus(0, 1000), 'safe');
  assert.strictEqual(calc.budgetStatus(700, 1000), 'safe');
  assert.strictEqual(calc.budgetStatus(800, 1000), 'warning', 'amber starts at 80%');
  assert.strictEqual(calc.budgetStatus(1000, 1000), 'warning', 'exactly on the limit is not over');
  assert.strictEqual(calc.budgetStatus(1001, 1000), 'over');
  // A limit of zero cannot be divided by, so it is its own state.
  assert.strictEqual(calc.budgetStatus(10, 0), 'none');
});

test('goalPace works out what to put aside, rounded up', () => {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 10);

  const pace = calc.goalPace({ targetAmount: 1000, savedAmount: 250, deadline });

  assert.strictEqual(pace.remaining, 750);
  assert.strictEqual(pace.isOverdue, false);

  // The property that actually matters: saving perDay for the days left has
  // to reach the target. Rounding up is what guarantees it, and rounding down
  // anywhere in here would leave the student short on the last day.
  assert.ok(
    pace.perDay * pace.daysLeft >= pace.remaining,
    `${pace.perDay} a day for ${pace.daysLeft} days falls short of ${pace.remaining}`
  );
  assert.ok(
    pace.perWeek * (pace.daysLeft / 7) >= pace.remaining - pace.perWeek,
    'the weekly figure should be in the same ballpark'
  );
});

test('goalPace reports no pace when there is no deadline', () => {
  const pace = calc.goalPace({ targetAmount: 500, savedAmount: 100 });
  assert.strictEqual(pace.remaining, 400);
  assert.strictEqual(pace.daysLeft, null);
  assert.strictEqual(pace.perDay, null);
  assert.strictEqual(pace.isOverdue, false);
});

test('goalPace flags an overdue goal, but not a finished one', () => {
  const past = new Date();
  past.setDate(past.getDate() - 5);

  assert.strictEqual(
    calc.goalPace({ targetAmount: 1000, savedAmount: 200, deadline: past }).isOverdue,
    true
  );
  assert.strictEqual(
    calc.goalPace({ targetAmount: 1000, savedAmount: 1000, deadline: past }).isOverdue,
    false,
    'a goal that was reached is not overdue, whatever the date says'
  );
});

test('goalPace never asks for a negative amount', () => {
  const pace = calc.goalPace({ targetAmount: 100, savedAmount: 250 });
  assert.strictEqual(pace.remaining, 0);
});

test('shapeCategoryTotals sorts by size and shares add up', () => {
  const { breakdown, byCategory } = calc.shapeCategoryTotals([
    { _id: 'Travel', total: 250, count: 2 },
    { _id: 'Mess/Food', total: 750, count: 9 },
  ]);

  assert.strictEqual(breakdown[0].category, 'Mess/Food', 'biggest first');
  assert.strictEqual(byCategory['Travel'], 250);
  const shares = breakdown.reduce((sum, row) => sum + row.percent, 0);
  assert.ok(Math.abs(shares - 100) <= 1, `shares should total ~100, got ${shares}`);
});

test('shapeCategoryTotals copes with no spending at all', () => {
  const { breakdown, byCategory } = calc.shapeCategoryTotals([]);
  assert.deepStrictEqual(breakdown, []);
  assert.deepStrictEqual(byCategory, {});
});
