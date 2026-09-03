/**
 * Domain events.
 *
 * WHY THIS EXISTS
 *
 * Writing an expense refreshes the alerts, and the alert rules read expenses.
 * Reaching a goal raises a notification, and the deadline rule reads goals.
 * Wired as direct calls, that is two circular dependencies: expenses and goals
 * had to know about notifications, and notifications had to know about them.
 *
 * Here, expenses and goals announce what happened and stop caring. Only
 * notifications knows that an alert follows a write, which is the module whose
 * job that actually is. The dependency runs one way: notifications reads
 * expenses and goals, and neither reads it back.
 *
 * WHAT THIS IS NOT
 *
 * In-process, and deliberately so. It is not a queue, it survives nothing, and
 * it delivers to this instance only.
 *
 * That is not a step down, because it is exactly what the code did before: the
 * alert refresh was already a fire-and-forget call inside the same request. A
 * process that dies mid-request lost the alert then and loses it now. Nothing
 * about the guarantees has changed - only who knows about whom.
 *
 * If alerts ever have to survive a crash or reach another instance, the answer
 * is a transactional outbox (write the event in the same transaction as the
 * row, drain it separately), not a bigger emitter. That is a real change with
 * different timing, so it should be a decision, not a side effect of this one.
 *
 * THE CONTRACTS
 *
 *   'expense.written'   { user, expense, action }
 *       user     the full user record, as the alert rules need currency,
 *                monthly income and custom categories
 *       expense  the row as it now stands, after the write
 *       action   'created' | 'updated'
 *       Emitted after the row is committed. Fire and forget: the student is
 *       not made to wait for an alert that is not part of their answer.
 *
 *   'debt.settled'      { user, debt }
 *       user     the full user record
 *       debt     the record as it now stands, nothing left owing
 *       Emitted after the payment that cleared it is committed, and only the
 *       first time. Awaited, so the notification is in the tray by the time the
 *       response says it was settled.
 *
 *   'goal.reached'      { user, goal }
 *       user     the full user record
 *       goal     the goal as it now stands, funded
 *       Emitted after the contribution is committed, and only the first time a
 *       goal crosses its target. Awaited, because it was awaited before this
 *       existed: the notification is in the tray by the time the response
 *       carrying `justCompleted` reaches the browser.
 */

/** name -> listeners */
const listeners = new Map();

/**
 * Registers a listener. Returns a function that removes it again, which is
 * what lets a test subscribe without leaking into the next one.
 */
const on = (name, listener) => {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(listener);
  return () => listeners.get(name).delete(listener);
};

/**
 * Announces something that happened, without waiting.
 *
 * A listener that throws is logged and otherwise ignored. That is the whole
 * point: the expense is already saved, and a failing alert rule must not turn
 * a successful write into an error the student sees.
 */
const emit = (name, payload) => {
  for (const listener of listeners.get(name) || []) {
    Promise.resolve()
      .then(() => listener(payload))
      .catch((err) => console.error(`[events] ${name} listener failed:`, err.message));
  }
};

/**
 * Announces something and waits for every listener to finish.
 *
 * For the one case that was awaited before: a completed goal has to be in the
 * tray before the response says so. Failures are still swallowed per listener,
 * so a broken alert cannot fail the write that caused it.
 */
const emitAndWait = async (name, payload) => {
  const running = [...(listeners.get(name) || [])].map((listener) =>
    Promise.resolve()
      .then(() => listener(payload))
      .catch((err) => console.error(`[events] ${name} listener failed:`, err.message))
  );
  await Promise.all(running);
};

/** Every listener for a name. Used by tests to assert the wiring exists. */
const listenerCount = (name) => (listeners.get(name) || new Set()).size;

/** Drops every listener. Tests only - nothing in the app should need this. */
const removeAll = () => listeners.clear();

module.exports = {
  on,
  emit,
  emitAndWait,
  listenerCount,
  removeAll,

  // The event names, so a typo is a missing export rather than a silent no-op.
  EXPENSE_WRITTEN: 'expense.written',
  GOAL_REACHED: 'goal.reached',
  DEBT_SETTLED: 'debt.settled',
};
