/**
 * Who we are willing to sign in with a Google token.
 *
 * The signature check belongs to google-auth-library and needs a token Google
 * actually signed, which a test cannot produce. What a test can and should
 * cover is the half that carries the security decision: given a payload whose
 * signature is already trusted, do we accept it?
 *
 * The rule that matters most is email_verified. Signing in with Google can open
 * an existing account that has the same email address - which is only sound if
 * Google has confirmed the person owns that address. Without that check,
 * putting somebody else's address on a Google account would be enough to reach
 * their financial records.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const google = require(
  path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'infrastructure', 'auth', 'google')
);

/** A payload as Google sends it, which individual tests then break. */
const payload = (overrides = {}) => ({
  iss: 'https://accounts.google.com',
  sub: '1234567890',
  email: 'student@example.com',
  email_verified: true,
  name: 'Abdul Haseeb',
  ...overrides,
});

/* --------------------------- what is accepted ------------------------ */

test('accepts an ordinary verified Google account', () => {
  const result = google.checkClaims(payload());
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.profile, {
    googleId: '1234567890',
    email: 'student@example.com',
    name: 'Abdul Haseeb',
  });
});

test('accepts either spelling of the issuer', () => {
  assert.strictEqual(google.checkClaims(payload({ iss: 'accounts.google.com' })).ok, true);
  assert.strictEqual(google.checkClaims(payload({ iss: 'https://accounts.google.com' })).ok, true);
});

test('identity comes from the subject claim, not the email', () => {
  // A person can change the email on their Google account. `sub` is the only
  // identifier Google promises stays put, so it is what the account is keyed on.
  const result = google.checkClaims(payload({ email: 'moved@example.com' }));
  assert.strictEqual(result.profile.googleId, '1234567890');
});

test('a missing name is not a reason to refuse', () => {
  const result = google.checkClaims(payload({ name: undefined }));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.profile.name, '');
});

/* --------------------------- what is refused ------------------------- */

test('refuses an unverified email address', () => {
  const result = google.checkClaims(payload({ email_verified: false }));
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /has not verified/i);
});

test('refuses a missing email_verified claim', () => {
  assert.strictEqual(google.checkClaims(payload({ email_verified: undefined })).ok, false);
});

test('refuses the STRING "true", which is not the same as true', () => {
  // Google has sent this claim as a string in the past. A truthiness check
  // would accept "true" - and would also accept "false", because a non-empty
  // string is truthy. Both must be refused by a strict comparison.
  assert.strictEqual(google.checkClaims(payload({ email_verified: 'true' })).ok, false);
  assert.strictEqual(google.checkClaims(payload({ email_verified: 'false' })).ok, false);
});

test('refuses a token from another issuer', () => {
  for (const iss of ['https://evil.example', 'accounts.google.com.evil.example', '', undefined]) {
    const result = google.checkClaims(payload({ iss }));
    assert.strictEqual(result.ok, false, `accepted issuer ${JSON.stringify(iss)}`);
  }
});

test('refuses a token with no subject', () => {
  assert.strictEqual(google.checkClaims(payload({ sub: undefined })).ok, false);
  assert.strictEqual(google.checkClaims(payload({ sub: '' })).ok, false);
});

test('refuses a token with no email', () => {
  assert.strictEqual(google.checkClaims(payload({ email: undefined })).ok, false);
});

test('refuses an empty payload', () => {
  assert.strictEqual(google.checkClaims(null).ok, false);
  assert.strictEqual(google.checkClaims(undefined).ok, false);
});

/* ------------------------- the feature switch ------------------------ */

test('the feature is off when no client id is configured', async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    assert.strictEqual(google.isConfigured(), false);
    assert.strictEqual(google.clientId(), undefined);

    // And the verifier refuses rather than reaching for Google.
    const result = await google.verify('anything');
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /not configured/i);
  } finally {
    if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = saved;
  }
});

test('whitespace does not count as configuration', () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = '   ';
  try {
    assert.strictEqual(google.isConfigured(), false);
  } finally {
    if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = saved;
  }
});

test('a token that is not a string is refused before Google is called', async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
  try {
    for (const value of [undefined, null, '', 42, {}]) {
      const result = await google.verify(value);
      assert.strictEqual(result.ok, false, `accepted ${JSON.stringify(value)}`);
    }
  } finally {
    if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = saved;
  }
});
