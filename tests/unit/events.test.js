/**
 * The domain event bus.
 *
 * This is what replaced two dependency cycles, so its guarantees matter more
 * than its size. Above all: a listener that throws must not reach the caller.
 * The expense is already saved by the time anything is announced, and a broken
 * alert rule turning a successful write into a 500 would be worse than the
 * cycle it replaced.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const events = require(path.join(
  __dirname, '..', '..', 'apps', 'api', 'src', 'shared', 'events'
));

const settle = () => new Promise((resolve) => setImmediate(resolve));

test.beforeEach(() => events.removeAll());
test.after(() => events.removeAll());

test('a listener hears what was emitted', async () => {
  const heard = [];
  events.on('thing.happened', (payload) => heard.push(payload));

  events.emit('thing.happened', { id: 1 });
  await settle();

  assert.deepStrictEqual(heard, [{ id: 1 }]);
});

test('every listener for a name hears it', async () => {
  const heard = [];
  events.on('thing.happened', () => heard.push('a'));
  events.on('thing.happened', () => heard.push('b'));

  events.emit('thing.happened', {});
  await settle();

  assert.deepStrictEqual(heard.sort(), ['a', 'b']);
});

test('emitting with no listeners is not an error', () => {
  assert.doesNotThrow(() => events.emit('nobody.listening', {}));
});

test('unsubscribing actually stops delivery', async () => {
  const heard = [];
  const off = events.on('thing.happened', () => heard.push(1));

  off();
  events.emit('thing.happened', {});
  await settle();

  assert.deepStrictEqual(heard, []);
  assert.strictEqual(events.listenerCount('thing.happened'), 0);
});

test('a listener that throws does not reach the caller', async () => {
  events.on('thing.happened', () => {
    throw new Error('the alert rule is broken');
  });

  // The write already succeeded. This must not turn it into a failure.
  assert.doesNotThrow(() => events.emit('thing.happened', {}));
  await settle();
});

test('a listener that rejects does not reach the caller either', async () => {
  events.on('thing.happened', async () => {
    throw new Error('the query failed');
  });

  assert.doesNotThrow(() => events.emit('thing.happened', {}));
  await settle();
});

test('one broken listener does not stop the others', async () => {
  const heard = [];
  events.on('thing.happened', () => {
    throw new Error('broken');
  });
  events.on('thing.happened', () => heard.push('still ran'));

  events.emit('thing.happened', {});
  await settle();

  assert.deepStrictEqual(heard, ['still ran']);
});

test('emitAndWait waits for an async listener to finish', async () => {
  let finished = false;
  events.on('thing.happened', async () => {
    await new Promise((r) => setTimeout(r, 20));
    finished = true;
  });

  await events.emitAndWait('thing.happened', {});

  // This is the property the goal celebration depends on: by the time the
  // response says the goal was reached, the notification is already in the tray.
  assert.strictEqual(finished, true);
});

test('emitAndWait still swallows a listener failure', async () => {
  events.on('thing.happened', async () => {
    throw new Error('notification insert failed');
  });

  await assert.doesNotReject(() => events.emitAndWait('thing.happened', {}));
});

test('emitAndWait waits for all of them, not just the first', async () => {
  const done = [];
  events.on('thing.happened', async () => {
    await new Promise((r) => setTimeout(r, 30));
    done.push('slow');
  });
  events.on('thing.happened', async () => {
    done.push('fast');
  });

  await events.emitAndWait('thing.happened', {});

  assert.strictEqual(done.length, 2, `only ${done.join(', ')} finished`);
});

test('the event names are exported so a typo cannot be a silent no-op', () => {
  assert.strictEqual(events.EXPENSE_WRITTEN, 'expense.written');
  assert.strictEqual(events.GOAL_REACHED, 'goal.reached');
});

test('notifications subscribes to both, and can unsubscribe again', () => {
  const subscriptions = require(path.join(
    __dirname, '..', '..', 'apps', 'api', 'src', 'modules',
    'notifications', 'notifications.subscriptions'
  ));

  assert.strictEqual(events.listenerCount(events.EXPENSE_WRITTEN), 0, 'starts clean');

  const off = subscriptions.register();
  assert.strictEqual(events.listenerCount(events.EXPENSE_WRITTEN), 1);
  assert.strictEqual(events.listenerCount(events.GOAL_REACHED), 1);

  off();
  assert.strictEqual(events.listenerCount(events.EXPENSE_WRITTEN), 0);
  assert.strictEqual(events.listenerCount(events.GOAL_REACHED), 0);
});
