/**
 * What a logged URL is allowed to say.
 *
 * Access logs are read by people who are not the account holder, and a
 * password-reset token in one is a live account-takeover credential that
 * outlives its own thirty-minute window.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { safeUrl } = require(
  path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'shared', 'http', 'safeUrl')
);

test('a reset token never reaches the log', () => {
  const token = 'a'.repeat(64);
  const logged = safeUrl(`/api/auth/reset-password/${token}`);
  assert.ok(!logged.includes(token), 'the token survived');
  assert.strictEqual(logged, '/api/auth/reset-password/<redacted>');
});

test('a token in a query string is redacted too', () => {
  assert.strictEqual(safeUrl('/api/thing?token=abc123'), '/api/thing?token=<redacted>');
  assert.strictEqual(safeUrl('/api/thing?access_token=abc123&page=2'),
    '/api/thing?access_token=<redacted>&page=2');
});

test('ordinary URLs are left exactly as they are', () => {
  for (const url of ['/api/expenses?page=2&limit=20', '/api/debts/1234/payments', '/api/health']) {
    assert.strictEqual(safeUrl(url), url);
  }
});

test('the rest of the URL still survives redaction', () => {
  assert.strictEqual(safeUrl('/api/auth/reset-password/xyz?next=/dashboard'),
    '/api/auth/reset-password/<redacted>?next=/dashboard');
});

test('it never throws on odd input', () => {
  for (const value of [null, undefined, '', 42, {}]) {
    assert.doesNotThrow(() => safeUrl(value));
  }
});
