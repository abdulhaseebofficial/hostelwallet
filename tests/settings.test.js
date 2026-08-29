/**
 * Settings QA, option by option. Everything destructive runs against a
 * throwaway account, so seeded data survives.
 *
 * Run with:  npm run qa
 */
const { ok, section, heading, call, report, requireApi, bailIfRateLimited, currentCookie } = require('./helpers');

(async () => {
  await requireApi();

  // A throwaway account carries every test, destructive ones included.
  const email = `settings${Date.now()}@example.com`;
  let r = await call('POST', '/auth/register', { name: 'Settings QA', email, password: 'testpass123', confirmPassword: 'testpass123' });
  bailIfRateLimited(r);
  let token = r.data?.data?.accessToken;
  ok('set up a throwaway account', r.status === 201 && !!token, email);

  heading('CARD 1 — PROFILE');

  section('Full name');
  r = await call('PUT', '/profile', { name: 'Renamed Student' }, token);
  ok('a valid name saves', r.status === 200 && r.data?.data?.user?.name === 'Renamed Student', r.data?.data?.user?.name);
  r = await call('GET', '/auth/me', undefined, token);
  ok('and it persists after a reload', r.data?.data?.user?.name === 'Renamed Student', r.data?.data?.user?.name);
  r = await call('PUT', '/profile', { name: '' }, token);
  ok('an empty name is rejected', r.status === 400, `-> ${r.status}`);
  r = await call('PUT', '/profile', { name: 'x'.repeat(61) }, token);
  ok('a 61-character name is rejected', r.status === 400, `-> ${r.status}`);

  section('Monthly pocket money');
  r = await call('PUT', '/profile', { monthlyIncome: 32000 }, token);
  ok('a valid income saves', r.status === 200 && r.data?.data?.user?.monthlyIncome === 32000, String(r.data?.data?.user?.monthlyIncome));
  r = await call('PUT', '/profile', { monthlyIncome: -500 }, token);
  ok('a negative income is rejected', r.status === 400, `-> ${r.status}`);
  r = await call('PUT', '/profile', { monthlyIncome: 'abc' }, token);
  ok('a non-numeric income is rejected', r.status === 400, `-> ${r.status}`);
  r = await call('PUT', '/profile', { monthlyIncome: 0 }, token);
  ok('zero income is allowed (a student may have none)', r.status === 200, `-> ${r.status}`);
  await call('PUT', '/profile', { monthlyIncome: 32000 }, token);

  section('Currency');
  const meta = (await call('GET', '/meta')).data?.data;
  const codes = (meta?.currencies || []).map((c) => c.code);
  let allCurrenciesOk = true;
  for (const code of codes) {
    const res = await call('PUT', '/profile', { currency: code }, token);
    if (res.status !== 200 || res.data?.data?.user?.currency !== code) allCurrenciesOk = false;
  }
  ok(`all ${codes.length} currencies are accepted`, allCurrenciesOk, codes.join(', '));
  r = await call('PUT', '/profile', { currency: 'XYZ' }, token);
  ok('an unsupported currency is rejected', r.status === 400, `-> ${r.status}`);
  await call('PUT', '/profile', { currency: 'PKR' }, token);

  section('University and Hostel name (both optional)');
  r = await call('PUT', '/profile', { university: '', hostelName: '' }, token);
  ok('both may be left empty', r.status === 200, `-> ${r.status}`);
  r = await call('PUT', '/profile', { university: 'NUST', hostelName: 'Block C' }, token);
  ok('both save', r.status === 200 && r.data?.data?.user?.university === 'NUST', `${r.data?.data?.user?.university} / ${r.data?.data?.user?.hostelName}`);
  r = await call('PUT', '/profile', { university: 'x'.repeat(101) }, token);
  ok('a 101-character university is rejected', r.status === 400, `-> ${r.status}`);

  heading('CARD 2 — APPEARANCE (theme)');
  for (const theme of ['light', 'dark', 'system']) {
    r = await call('PUT', '/profile', { theme }, token);
    ok(`theme "${theme}" saves`, r.status === 200 && r.data?.data?.user?.theme === theme, r.data?.data?.user?.theme);
  }
  r = await call('PUT', '/profile', { theme: 'neon' }, token);
  ok('an unknown theme is rejected', r.status === 400, `-> ${r.status}`);

  heading('CARD 3 — CATEGORIES');
  r = await call('GET', '/profile/categories', undefined, token);
  const builtIn = r.data?.data?.defaults || r.data?.data?.all || [];
  ok('the built-in list loads', r.status === 200 && builtIn.length >= 9, `${builtIn.length} categories`);

  r = await call('POST', '/profile/categories', { name: 'Gym' }, token);
  ok('add a custom category', r.status === 200 || r.status === 201, `-> ${r.status}`);
  r = await call('GET', '/profile/categories', undefined, token);
  ok('it appears in the list', (r.data?.data?.all || []).includes('Gym'), `${(r.data?.data?.all || []).length} total`);

  r = await call('POST', '/profile/categories', { name: 'Gym' }, token);
  ok('a duplicate is rejected', r.status >= 400, `-> ${r.status}`);
  r = await call('POST', '/profile/categories', { name: 'Mess/Food' }, token);
  ok('clashing with a built-in name is rejected', r.status >= 400, `-> ${r.status}`);
  r = await call('POST', '/profile/categories', { name: '   ' }, token);
  ok('a blank name is rejected', r.status === 400, `-> ${r.status}`);
  r = await call('POST', '/profile/categories', { name: 'y'.repeat(41) }, token);
  ok('a 41-character name is rejected', r.status === 400, `-> ${r.status}`);

  // An unused custom category comes straight out.
  r = await call('DELETE', '/profile/categories/Gym', undefined, token);
  ok('an unused custom category is removed', r.status === 200, `-> ${r.status}`);

  // One that is in use must NOT be, or its expenses would be orphaned.
  await call('POST', '/profile/categories', { name: 'Gym' }, token);
  await call('POST', '/expenses', { amount: 500, category: 'Gym', description: 'QA gym fee' }, token);
  r = await call('DELETE', '/profile/categories/Gym', undefined, token);
  ok('a category still in use is refused', r.status === 400, `-> ${r.status}`);
  ok('and the refusal says how many expenses use it', /\d+ expense/.test(r.data?.message || ''), r.data?.message);

  r = await call('DELETE', '/profile/categories/Mess%2FFood', undefined, token);
  ok('a built-in category cannot be removed', r.status >= 400, `-> ${r.status}`);

  heading('CARD 4 — SECURITY AND DATA');

  section('Export my data');
  r = await call('GET', '/profile/export', undefined, token);
  const dump = r.data?.data || r.data;
  const dumpStr = JSON.stringify(dump || '');
  ok('export returns something', r.status === 200 && dumpStr.length > 50, `${dumpStr.length} chars`);
  ok('the export contains the expenses', /QA gym fee/.test(dumpStr), 'test expense found in the dump');
  ok('the export does NOT contain the password hash', !/\$2[aby]\$/.test(dumpStr), 'no bcrypt hash leaked');

  section('Change password');
  r = await call('PUT', '/auth/change-password', { currentPassword: 'wrong-one', newPassword: 'newpass456' }, token);
  ok('a wrong current password is rejected', r.status === 401 || r.status === 400, `-> ${r.status}`);
  r = await call('PUT', '/auth/change-password', { currentPassword: 'testpass123', newPassword: 'short' }, token);
  ok('a weak new password is rejected', r.status === 400, `-> ${r.status}`);
  // Captured before the change: changing the password revokes every session and
  // then issues a fresh one, so the jar moves on to a valid cookie immediately.
  // Replaying the captured one is the only way to prove the old one is dead.
  const cookieBefore = currentCookie();
  r = await call('PUT', '/auth/change-password', { currentPassword: 'testpass123', newPassword: 'newpass456' }, token);
  ok('a valid change succeeds', r.status === 200, `-> ${r.status}`);

  r = await call('POST', '/auth/refresh', undefined, undefined, { cookie: cookieBefore });
  ok('the refresh token from before the change is revoked', r.status === 401, `-> ${r.status}`);

  r = await call('POST', '/auth/refresh', undefined);
  ok('the session that changed it stays signed in', r.status === 200, `-> ${r.status}`);

  // The access token is stateless and lives out JWT_ACCESS_EXPIRES, which is
  // why other devices drop within that window rather than instantly.
  r = await call('GET', '/auth/me', undefined, token);
  ok('the old access token lasts out its window (by design)', r.status === 200, `-> ${r.status}`);

  r = await call('POST', '/auth/login', { email, password: 'testpass123' });
  ok('the old password stops working', r.status === 401, `-> ${r.status}`);
  r = await call('POST', '/auth/login', { email, password: 'newpass456' });
  ok('the new password works', r.status === 200, `-> ${r.status}`);
  const freshToken = r.data?.data?.accessToken;

  section('Delete account');
  r = await call('DELETE', '/profile', { password: 'wrong-password' }, freshToken);
  ok('a wrong password will not delete the account', r.status === 401 || r.status === 400, `-> ${r.status}`);
  r = await call('GET', '/auth/me', undefined, freshToken);
  ok('the account is still there after the failed attempt', r.status === 200, `-> ${r.status}`);
  r = await call('DELETE', '/profile', { password: 'newpass456' }, freshToken);
  ok('the right password deletes the account', r.status === 200, `-> ${r.status}`);
  r = await call('POST', '/auth/login', { email, password: 'newpass456' });
  // 429 is the auth rate limiter, which this suite trips by design after many
  // login attempts. Either way the sign-in did not succeed, which is the point.
  ok('the deleted account can no longer sign in', r.status === 401 || r.status === 429,
    `-> ${r.status}${r.status === 429 ? ' (rate limited — brute-force guard is live)' : ''}`);

  report();
})().catch((e) => {
  console.error('\nThe suite crashed:', e.message);
  process.exit(1);
});
