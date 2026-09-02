/**
 * End-to-end API checks: every resource, the auth edges, and the
 * authorisation boundary between two students.
 *
 * Run with:  npm run qa
 */
const { ok, section, heading, call, report, requireApi, bailIfRateLimited, currentCookie } = require('./helpers');

(async () => {
  await requireApi();

  section('AUTH');
  let r = await call('POST', '/auth/login', { email: 'demo@hostelwallet.app', password: 'demo1234' });
  bailIfRateLimited(r);
  ok('login with the demo account', r.status === 200 && !!r.data?.data?.accessToken, `-> ${r.status}`);
  let token = r.data?.data?.accessToken;
  const me = r.data?.data?.user;
  ok('login returns the user', !!me?.email, me?.email);

  r = await call('POST', '/auth/login', { email: 'demo@hostelwallet.app', password: 'wrong-password' });
  ok('wrong password is rejected', r.status === 401, `-> ${r.status}`);

  r = await call('POST', '/auth/login', { email: 'not-an-email', password: 'x' });
  ok('malformed email is rejected', r.status === 400, `-> ${r.status}`);

  r = await call('GET', '/auth/me', undefined, token);
  ok('GET /auth/me with a token', r.status === 200, `-> ${r.status}`);

  r = await call('GET', '/auth/me');
  ok('GET /auth/me without a token is 401', r.status === 401, `-> ${r.status}`);

  r = await call('GET', '/auth/me', undefined, token + 'tampered');
  ok('a tampered token is rejected', r.status === 401, `-> ${r.status}`);

  section('SESSION ROTATION');
  // The refresh cookie is rotated on every use. The jar holds the newest one,
  // so the login cookie captured here is deliberately the superseded one.
  const staleCookie = currentCookie();
  r = await call('POST', '/auth/refresh');
  ok('refresh mints a new access token', r.status === 200 && !!r.data?.data?.accessToken, `-> ${r.status}`);
  const rotatedCookie = currentCookie();
  ok('and rotates the cookie', rotatedCookie !== staleCookie, 'cookie changed');

  // Replaying the superseded token is what a stolen cookie looks like, so the
  // server drops every session for the account rather than serving it.
  r = await call('POST', '/auth/refresh', undefined, undefined, { cookie: staleCookie });
  ok('a replayed refresh token is rejected', r.status === 401, `-> ${r.status}`);
  r = await call('POST', '/auth/refresh', undefined, undefined, { cookie: rotatedCookie });
  ok('and the replay revoked the live session too', r.status === 401, `-> ${r.status}`);

  // Sign back in so the rest of the suite has a working session.
  r = await call('POST', '/auth/login', { email: 'demo@hostelwallet.app', password: 'demo1234' });
  ok('signing back in works', r.status === 200, `-> ${r.status}`);
  token = r.data?.data?.accessToken;

  section('DASHBOARD');
  r = await call('GET', '/dashboard/summary', undefined, token);
  const dash = r.data?.data;
  ok('dashboard summary loads', r.status === 200 && !!dash, `-> ${r.status}`);
  ok('has totals', !!dash?.totals && typeof dash.totals.spent === 'number', `spent=${dash?.totals?.spent}`);
  ok('has a category breakdown', Array.isArray(dash?.categoryBreakdown) && dash.categoryBreakdown.length > 0,
    `${dash?.categoryBreakdown?.length} categories`);
  ok('has a daily trend', Array.isArray(dash?.trend) && dash.trend.length > 0, `${dash?.trend?.length} days`);
  ok('remaining = income - spent', dash && Math.abs((dash.totals.income - dash.totals.spent) - dash.totals.remaining) < 0.01,
    `${dash?.totals?.income} - ${dash?.totals?.spent} = ${dash?.totals?.remaining}`);

  section('EXPENSES — full CRUD');
  r = await call('GET', '/expenses?limit=5', undefined, token);
  ok('list expenses', r.status === 200 && Array.isArray(r.data?.data?.items), `${r.data?.data?.pagination?.total} total`);
  const firstPageIds = (r.data?.data?.items || []).map((e) => e._id);

  r = await call('POST', '/expenses', { amount: 250, category: 'Mess/Food', description: 'QA test lunch', paymentMethod: 'Cash', date: new Date().toISOString() }, token);
  ok('create an expense', r.status === 201, `-> ${r.status}`);
  const expenseId = r.data?.data?.expense?._id;

  r = await call('PUT', `/expenses/${expenseId}`, { amount: 275, description: 'QA test lunch (edited)' }, token);
  ok('update an expense', r.status === 200 && r.data?.data?.expense?.amount === 275, `amount=${r.data?.data?.expense?.amount}`);

  r = await call('POST', '/expenses', { amount: -50, category: 'Mess/Food' }, token);
  ok('a negative amount is rejected', r.status === 400, `-> ${r.status}`);

  r = await call('POST', '/expenses', { amount: 100 }, token);
  ok('a missing category is rejected', r.status === 400, `-> ${r.status}`);

  r = await call('GET', '/expenses?search=QA%20test&limit=10', undefined, token);
  ok('search finds it', r.status === 200 && r.data.data.items.some((e) => e._id === expenseId), `${r.data?.data?.items?.length} hits`);

  r = await call('GET', '/expenses?category=Mess%2FFood&limit=50', undefined, token);
  ok('category filter works', r.status === 200 && r.data.data.items.every((e) => e.category === 'Mess/Food'),
    `${r.data?.data?.items?.length} rows, all Mess/Food`);

  r = await call('GET', '/expenses?minAmount=100000&limit=5', undefined, token);
  ok('an impossible filter returns nothing', r.status === 200 && r.data.data.items.length === 0, `${r.data?.data?.items?.length} rows`);

  // Both pages in the same breath: creating a row between the two calls shifts
  // the window and makes an overlap look like a pagination bug.
  const pg1 = await call('GET', '/expenses?page=1&limit=5&sortBy=date&order=desc', undefined, token);
  const pg2 = await call('GET', '/expenses?page=2&limit=5&sortBy=date&order=desc', undefined, token);
  const idsA = (pg1.data?.data?.items || []).map((e) => e._id);
  const idsB = (pg2.data?.data?.items || []).map((e) => e._id);
  ok('page 2 does not repeat page 1', idsB.length > 0 && !idsB.some((id) => idsA.includes(id)),
    `${idsA.length} + ${idsB.length} rows, ${idsB.filter((id) => idsA.includes(id)).length} overlap`);

  section('INCOME');
  r = await call('GET', '/income', undefined, token);
  ok('list income', r.status === 200 && Array.isArray(r.data?.data?.items), `${r.data?.data?.items?.length} rows`);
  r = await call('POST', '/income', { amount: 5000, source: 'Pocket Money', note: 'QA test', date: new Date().toISOString() }, token);
  ok('add income', r.status === 201, `-> ${r.status}`);
  const incomeId = r.data?.data?.income?._id;

  section('GOALS');
  r = await call('POST', '/goals', { title: 'QA Goal', targetAmount: 10000, icon: '🎯' }, token);
  ok('create a goal', r.status === 201, `-> ${r.status}`);
  const goalId = r.data?.data?.goal?._id;
  r = await call('PATCH', `/goals/${goalId}/add`, { amount: 2500 }, token);
  ok('contribute to a goal', r.status === 200 && r.data?.data?.goal?.savedAmount === 2500, `saved=${r.data?.data?.goal?.savedAmount}`);
  r = await call('PATCH', `/goals/${goalId}/add`, { amount: -500 }, token);
  ok('withdraw from a goal', r.status === 200 && r.data?.data?.goal?.savedAmount === 2000, `saved=${r.data?.data?.goal?.savedAmount}`);
  r = await call('PATCH', `/goals/${goalId}/add`, { amount: 0 }, token);
  ok('a zero contribution is rejected', r.status === 400, `-> ${r.status}`);

  section('BUDGET');
  const now = new Date();
  r = await call('POST', '/budget', { category: 'Travel', limit: 3000, month: now.getMonth() + 1, year: now.getFullYear() }, token);
  ok('set a budget limit', r.status === 200 || r.status === 201, `-> ${r.status}`);
  r = await call('GET', `/budget?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, undefined, token);
  ok('list budgets', r.status === 200 && Array.isArray(r.data?.data?.items), `${r.data?.data?.items?.length} rows`);
  ok('budget totals present', typeof r.data?.data?.totals?.limit === 'number', `limit=${r.data?.data?.totals?.limit}`);
  r = await call('POST', '/budget', { category: 'Travel', limit: -100 }, token);
  ok('a negative limit is rejected', r.status === 400, `-> ${r.status}`);

  section('REPORTS');
  r = await call('GET', `/reports/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, undefined, token);
  ok('monthly report', r.status === 200 && !!r.data?.data?.totals, `-> ${r.status}`);
  ok('report has a comparison', !!r.data?.data?.comparison, `vs ${r.data?.data?.comparison?.previousLabel}`);
  r = await call('GET', `/reports/export?format=csv&month=${now.getMonth() + 1}&year=${now.getFullYear()}`, undefined, token);
  ok('CSV export', r.status === 200 && r.data.byteLength > 50, `${r.data.byteLength} bytes`);
  r = await call('GET', `/reports/export?format=pdf&month=${now.getMonth() + 1}&year=${now.getFullYear()}`, undefined, token);
  const pdfHead = r.data.byteLength ? Buffer.from(r.data.slice(0, 5)).toString() : '';
  ok('PDF export is a real PDF', r.status === 200 && pdfHead.startsWith('%PDF'), `${r.data.byteLength} bytes, starts "${pdfHead}"`);

  section('AI ADVISOR (no API key — fallback must answer)');
  r = await call('GET', '/ai/status', undefined, token);
  ok('advisor status', r.status === 200, `configured=${r.data?.data?.configured}`);
  r = await call('GET', '/ai/tip', undefined, token);
  ok('tip of the day', r.status === 200 && !!r.data?.data?.tip, `${String(r.data?.data?.tip?.message || '').slice(0, 45)}...`);
  r = await call('POST', '/ai/advice', { tipCount: 4 }, token);
  ok('advice', r.status === 200 && Array.isArray(r.data?.data?.tips) && r.data.data.tips.length > 0,
    `${(r.data?.data?.tips || []).length} tips`);

  // This endpoint reached for a method that stopped existing when the data
  // layer moved to Postgres, and nothing noticed because nothing asked.
  r = await call('POST', '/ai/suggest-budget', {}, token);
  ok('suggest a budget', r.status === 200, `-> ${r.status}`);
  ok('the plan covers categories', Array.isArray(r.data?.data?.categories),
    `${(r.data?.data?.categories || []).length} rows`);
  ok('the plan reports what it allocated', typeof r.data?.data?.allocated === 'number',
    `allocated=${r.data?.data?.allocated}`);

  r = await call('GET', '/ai/weekly-summary', undefined, token);
  ok('weekly summary', r.status === 200 && !!r.data?.data?.summary, `-> ${r.status}`);

  r = await call('GET', '/ai/chat/history', undefined, token);
  ok('chat history loads', r.status === 200 && Array.isArray(r.data?.data?.messages),
    `${(r.data?.data?.messages || []).length} messages`);

  section('NOTIFICATIONS');
  r = await call('GET', '/notifications', undefined, token);
  ok('list notifications', r.status === 200 && Array.isArray(r.data?.data?.items), `${r.data?.data?.items?.length} items, ${r.data?.data?.unreadCount} unread`);
  r = await call('PATCH', '/notifications/read-all', undefined, token);
  ok('mark all read', r.status === 200, `-> ${r.status}`);

  section('FEEDBACK');
  r = await call('POST', '/feedback', { type: 'Bug', rating: 4, message: 'QA automated check of the feedback route.', page: '/dashboard' }, token);
  ok('submit feedback', r.status === 201, `-> ${r.status}`);
  r = await call('POST', '/feedback', { message: 'hi' }, token);
  ok('a too-short message is rejected', r.status === 400, `-> ${r.status}`);
  r = await call('GET', '/feedback/mine', undefined, token);
  ok('my feedback lists', r.status === 200 && r.data.data.items.length > 0, `${r.data?.data?.items?.length} items`);

  section('PROFILE & SETTINGS');
  r = await call('GET', '/profile/categories', undefined, token);
  ok('list categories', r.status === 200, `${(r.data?.data?.all || []).length} total`);
  r = await call('POST', '/profile/categories', { name: 'QA Category' }, token);
  ok('add a custom category', r.status === 200 || r.status === 201, `-> ${r.status}`);
  r = await call('DELETE', '/profile/categories/QA%20Category', undefined, token);
  ok('remove a custom category', r.status === 200, `-> ${r.status}`);
  r = await call('PUT', '/profile', { name: me?.name, monthlyIncome: 28000 }, token);
  ok('update the profile', r.status === 200, `-> ${r.status}`);
  r = await call('GET', '/profile/export', undefined, token);
  ok('export all data', r.status === 200, `-> ${r.status}`);

  section('AUTHORISATION — one student must not see another\'s data');
  const other = `qa${Date.now()}@example.com`;
  r = await call('POST', '/auth/register', { name: 'QA Second', email: other, password: 'testpass123', confirmPassword: 'testpass123' }, undefined);
  ok('register a second account', r.status === 201, `-> ${r.status}`);
  const token2 = r.data?.data?.accessToken;
  r = await call('POST', '/auth/register', { name: 'Dup', email: other, password: 'testpass123', confirmPassword: 'testpass123' });
  ok('a duplicate email is rejected', r.status === 400 || r.status === 409, `-> ${r.status}`);
  r = await call('POST', '/auth/register', { name: 'Weak', email: `w${Date.now()}@example.com`, password: 'short', confirmPassword: 'short' });
  ok('a weak password is rejected', r.status === 400, `-> ${r.status}`);

  r = await call('GET', `/expenses/${expenseId}`, undefined, token2);
  ok("cannot read another student's expense", r.status === 404 || r.status === 403, `-> ${r.status}`);
  r = await call('PUT', `/expenses/${expenseId}`, { amount: 1 }, token2);
  ok("cannot edit another student's expense", r.status === 404 || r.status === 403, `-> ${r.status}`);
  r = await call('DELETE', `/goals/${goalId}`, undefined, token2);
  ok("cannot delete another student's goal", r.status === 404 || r.status === 403, `-> ${r.status}`);
  r = await call('GET', '/expenses', undefined, token2);
  ok('a new account starts empty', r.status === 200 && r.data.data.items.length === 0, `${r.data?.data?.items?.length} rows`);

  section('CLEANUP');
  r = await call('DELETE', `/expenses/${expenseId}`, undefined, token);
  ok('delete the test expense', r.status === 200, `-> ${r.status}`);
  r = await call('DELETE', `/income/${incomeId}`, undefined, token);
  ok('delete the test income', r.status === 200, `-> ${r.status}`);
  r = await call('DELETE', `/goals/${goalId}`, undefined, token);
  ok('delete the test goal', r.status === 200, `-> ${r.status}`);

  report();
})().catch((e) => {
  console.error('\nThe suite crashed:', e.message);
  process.exit(1);
});
