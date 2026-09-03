/**
 * Row shaping, and the one place in this codebase where something other than a
 * bound parameter is concatenated into SQL.
 *
 * `buildSet` puts the column NAME into the statement text. Every caller today
 * passes a literal object with hard-coded names, so no request data reaches
 * that position - but nothing structural said so until the guard these tests
 * cover. `buildSet(req.body)` is a believable shortcut for whoever writes the
 * next endpoint, and it would be an injection rather than a bug.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { toApi, toApiList, buildSet, isUuid } = require(
  path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'infrastructure', 'database', 'rows')
);

/* ------------------------------ buildSet ---------------------------- */

test('builds a SET fragment with numbered placeholders', () => {
  const { fragment, values, next } = buildSet({ name: 'Ali', monthly_income: 25000 });
  assert.strictEqual(fragment, 'name = $1, monthly_income = $2');
  assert.deepStrictEqual(values, ['Ali', 25000]);
  assert.strictEqual(next, 3);
});

test('skips undefined so a partial update touches only what was sent', () => {
  const { fragment, values } = buildSet({ name: 'Ali', note: undefined, theme: 'dark' });
  assert.strictEqual(fragment, 'name = $1, theme = $2');
  assert.deepStrictEqual(values, ['Ali', 'dark']);
});

test('null is a value, not an absence', () => {
  // Clearing a due date means writing NULL, which is different from not
  // mentioning the column at all.
  const { fragment, values } = buildSet({ due_date: null });
  assert.strictEqual(fragment, 'due_date = $1');
  assert.deepStrictEqual(values, [null]);
});

test('can start numbering after placeholders already in use', () => {
  const { fragment, next } = buildSet({ amount: 5 }, 4);
  assert.strictEqual(fragment, 'amount = $4');
  assert.strictEqual(next, 5);
});

test('refuses a key that is not a bare column name', () => {
  // Each of these would otherwise be written into the statement verbatim.
  const attacks = [
    'amount = 1, user_id',              // smuggling a second assignment
    'amount"; DROP TABLE users; --',    // statement break
    'amount) WHERE (1=1',               // clause break
    'users.amount',                     // qualified name
    '',                                 // empty
    ' amount',                          // leading space
    '1amount',                          // leading digit
  ];

  for (const key of attacks) {
    assert.throws(
      () => buildSet({ [key]: 'x' }),
      /is not a column name/,
      `buildSet accepted ${JSON.stringify(key)}`
    );
  }
});

test('a rejected key stops the statement rather than being dropped quietly', () => {
  // Silently skipping it would write a partial update the caller believes was
  // complete, which is a worse failure than an error.
  assert.throws(() => buildSet({ name: 'Ali', 'x = 1, y': 'z' }), /is not a column name/);
});

test('ordinary column names still pass', () => {
  for (const key of ['a', 'amount', 'user_id', 'paid_amount', '_private', 'col2']) {
    assert.doesNotThrow(() => buildSet({ [key]: 1 }), `rejected ${key}`);
  }
});

/* ------------------------------- toApi ------------------------------ */

test('maps snake_case to camelCase and id to _id', () => {
  assert.deepStrictEqual(toApi({ id: 'u1', monthly_income: 500 }), { _id: 'u1', monthlyIncome: 500 });
});

test('omit drops columns that must never leave the server', () => {
  const row = { id: 'u1', email: 'a@b.c', password: 'hash', reset_password_token: 't' };
  const out = toApi(row, ['password', 'reset_password_token']);
  assert.deepStrictEqual(out, { _id: 'u1', email: 'a@b.c' });
  assert.ok(!('password' in out) && !('resetPasswordToken' in out));
});

test('a missing row maps to null, not an empty object', () => {
  assert.strictEqual(toApi(null), null);
  assert.strictEqual(toApi(undefined), null);
});

test('toApiList maps every row and honours omit', () => {
  const out = toApiList([{ id: '1', password: 'h' }, { id: '2', password: 'h' }], ['password']);
  assert.deepStrictEqual(out, [{ _id: '1' }, { _id: '2' }]);
});

/* ------------------------------- isUuid ----------------------------- */

test('accepts a real uuid in either case', () => {
  assert.ok(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301'));
  assert.ok(isUuid('3F2504E0-4F89-11D3-9A0C-0305E82C3301'));
});

test('rejects anything Postgres would raise 22P02 on', () => {
  // A malformed id must become "not found", never a 500 that names the column.
  for (const bad of ['', 'abc', '123', "' OR 1=1 --", '3f2504e0-4f89-11d3-9a0c', null, undefined, 42, {}]) {
    assert.strictEqual(isUuid(bad), false, `accepted ${JSON.stringify(bad)}`);
  }
});
