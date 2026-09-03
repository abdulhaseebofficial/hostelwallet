/**
 * What notifications does when something happens elsewhere.
 *
 * The only place that knows an alert follows a write. expenses and goals
 * announce; this decides what, if anything, that means for the bell.
 *
 * Registered once at start-up by src/app.js. Importing this module has no
 * effect on its own, so a test can require it without subscribing.
 */

const events = require('../../shared/events');
const { runChecksForUser, push } = require('./notifications.service');

/**
 * A written expense can push a category over its limit, so the rules re-run.
 *
 * Every alert carries a dedupe key, so this is safe to run on every write: a
 * limit already warned about this month raises nothing new.
 */
const onExpenseWritten = async ({ user }) => {
  await runChecksForUser(user);
};

/** Clearing a debt is worth saying so, once. */
const onDebtSettled = async ({ user, debt }) => {
  const who = debt.kind === 'BORROWED' ? `paid ${debt.personName} back` : `got your money back from ${debt.personName}`;
  await push(user._id, {
    type: 'info',
    title: 'Udhaar settled',
    message: `You ${who} - ${user.currency} ${debt.originalAmount} is square. Nice.`,
    meta: { debtId: debt._id, kind: debt.kind },
    // One per record, ever.
    dedupeKey: `debt-settled:${debt._id}`,
  });
};

/** A goal crossing its target is worth saying so, once. */
const onGoalReached = async ({ user, goal }) => {
  await push(user._id, {
    type: 'goal_completed',
    title: `Goal reached: ${goal.title}`,
    message: `You saved the full ${user.currency} ${goal.targetAmount}. That is real discipline. Time to set the next one!`,
    meta: { goalId: goal._id },
    // One per goal, ever - re-reaching a goal after a withdrawal says nothing new.
    dedupeKey: `goal-done:${goal._id}`,
  });
};

/**
 * Subscribes to the events this module cares about.
 *
 * Returns a function that unsubscribes everything, which is how a test can
 * register, assert, and leave the bus as it found it.
 */
const register = () => {
  const off = [
    events.on(events.EXPENSE_WRITTEN, onExpenseWritten),
    events.on(events.GOAL_REACHED, onGoalReached),
    events.on(events.DEBT_SETTLED, onDebtSettled),
  ];
  return () => off.forEach((remove) => remove());
};

// register() is the whole surface: the handlers are what it wires up, and
// the behaviour they produce is asserted end-to-end rather than in isolation.
module.exports = { register };
