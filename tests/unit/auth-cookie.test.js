/**
 * The refresh cookie's attributes.
 *
 * This cookie is the session. If it is readable by JavaScript, travels over
 * plain HTTP, or is attached to requests from other people's sites, then every
 * other authentication control in the app is decoration. These tests pin the
 * four attributes that decide that, in both environments, so a change to them
 * has to be deliberate.
 *
 * The production expectation here is the audit's conclusion, written down: the
 * SPA and the API are served from one origin (vercel.json routes /api to the
 * backend service and everything else to the frontend, and the client calls the
 * relative path /api), so the cookie has no cross-site hop to survive and Lax
 * is both sufficient and stricter.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const TOKENS = path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules', 'auth', 'auth.tokens');

/** Loads the module fresh under a given environment. */
const withEnv = (env, fn) => {
  const saved = { NODE_ENV: process.env.NODE_ENV, COOKIE_SAMESITE: process.env.COOKIE_SAMESITE };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  delete require.cache[require.resolve(TOKENS)];
  try {
    return fn(require(TOKENS));
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[require.resolve(TOKENS)];
  }
};

const prodCookie = (extra = {}) =>
  withEnv({ NODE_ENV: 'production', COOKIE_SAMESITE: undefined, ...extra }, (t) =>
    t.refreshCookieOptions()
  );

test('production: the cookie is unreadable by JavaScript', () => {
  assert.strictEqual(prodCookie().httpOnly, true);
});

test('production: the cookie never travels over plain HTTP', () => {
  assert.strictEqual(prodCookie().secure, true);
});

test('production: the cookie is Lax, not None', () => {
  // The regression this file exists for. It was None, on the reasoning that
  // "'none' lets Vercel talk to Render" - a split deployment this repo no
  // longer uses. None attaches the cookie to cross-site requests; Lax does not.
  assert.strictEqual(prodCookie().sameSite, 'lax');
});

test('production: the cookie is scoped to the routes that rotate it', () => {
  assert.strictEqual(prodCookie().path, '/api/auth');
});

test('production: the full configuration, exactly', () => {
  assert.deepStrictEqual(prodCookie(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
});

test('development: Secure is off, because local development is not HTTPS', () => {
  const cookie = withEnv({ NODE_ENV: 'development', COOKIE_SAMESITE: undefined }, (t) =>
    t.refreshCookieOptions()
  );
  assert.strictEqual(cookie.secure, false);
  assert.strictEqual(cookie.httpOnly, true, 'httpOnly must not be relaxed for convenience');
  assert.strictEqual(cookie.sameSite, 'lax');
});

test('a split deployment can still opt in to None', () => {
  // The setting has a real use - an API on its own domain - so it stays
  // available. It is now a decision someone makes, not the default.
  assert.strictEqual(prodCookie({ COOKIE_SAMESITE: 'none' }).sameSite, 'none');
});

test('the opt-in is case and whitespace tolerant', () => {
  assert.strictEqual(prodCookie({ COOKIE_SAMESITE: '  None ' }).sameSite, 'none');
});

test('an unrecognised value falls back to the safe setting, not the weak one', () => {
  // A typo must never silently produce a cross-site cookie.
  for (const bad of ['none;', 'lax!', 'true', '', 'sameorigin']) {
    assert.strictEqual(prodCookie({ COOKIE_SAMESITE: bad }).sameSite, 'lax', `for ${JSON.stringify(bad)}`);
  }
});

test('logout clears the cookie with the same attributes it was set with', () => {
  // A browser only discards a cookie when the clearing options match the ones
  // it was stored under. A mismatch leaves a live refresh token in the browser
  // after the student thinks they signed out.
  const t = withEnv({ NODE_ENV: 'production', COOKIE_SAMESITE: undefined }, (m) => m);
  const set = t.refreshCookieOptions();
  const cleared = { ...t.refreshCookieOptions(), maxAge: undefined };

  for (const key of ['httpOnly', 'secure', 'sameSite', 'path']) {
    assert.strictEqual(cleared[key], set[key], `${key} differs between set and clear`);
  }
});
