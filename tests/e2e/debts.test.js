/**
 * Udhaar: the money rules, end to end.
 *
 * This is where the arithmetic is actually held. A debt is the one place in the
 * app where a rounding error is not cosmetic - payments have to add up to
 * exactly the original amount, and "settled" has to mean nothing is left. Most
 * of what follows is about that, plus the two things a shared ledger has to get
 * right: nobody may touch another student's records, and a refused payment must
 * leave no trace.
 *
 * Run with:  npm run qa:debts   (the API must be running)
 */
const { ok, section, call, report, requireApi, bailIfRateLimited } = require('./helpers');

(async () => {
  await requireApi();

  const email = `debts-${Date.now()}@example.com`;
  let r = await call('POST', '/auth/register', { acceptTerms: true,
    name: 'Debt Student', email, password: 'DebtPass123!', confirmPassword: 'DebtPass123!',
  });
  bailIfRateLimited(r);
  const token = r.data?.data?.accessToken;
  ok('an account for the debt checks', r.status === 201, `-> ${r.status}`);

  section('CREATING A RECORD');

  r = await call('POST', '/debts', {
    kind: 'BORROWED', personName: 'Ali', originalAmount: 5000,
    note: 'Mess bill emergency', personContact: '0300-1234567',
  }, token);
  const borrowedId = r.data?.data?.debt?._id;
  ok('a borrowed record is created', r.status === 201, `-> ${r.status}`);
  ok('it starts PENDING', r.data?.data?.debt?.status === 'PENDING', r.data?.data?.debt?.status);
  ok('with nothing paid', r.data?.data?.debt?.paidAmount === 0, `${r.data?.data?.debt?.paidAmount}`);
  ok('and the whole amount remaining', r.data?.data?.debt?.remainingAmount === 5000,
    `${r.data?.data?.debt?.remainingAmount}`);
  ok('a record with no due date is never overdue', r.data?.data?.debt?.isOverdue === false);
  ok('the contact is kept', r.data?.data?.debt?.personContact === '0300-1234567');

  r = await call('POST', '/debts', { kind: 'LENT', personName: 'Sara', originalAmount: 1200 }, token);
  const lentId = r.data?.data?.debt?._id;
  ok('a lent record is created', r.status === 201, `-> ${r.status}`);

  section('AMOUNTS AND FIELDS THAT MUST BE REFUSED');

  for (const [label, amount] of [['zero', 0], ['a negative', -100]]) {
    r = await call('POST', '/debts', { kind: 'LENT', personName: 'X', originalAmount: amount }, token);
    ok(`${label} amount is refused`, r.status === 400, `-> ${r.status}`);
  }
  r = await call('POST', '/debts', { kind: 'SOMETHING', personName: 'X', originalAmount: 10 }, token);
  ok('an unknown kind is refused', r.status === 400, `-> ${r.status}`);
  r = await call('POST', '/debts', { kind: 'LENT', personName: '   ', originalAmount: 10 }, token);
  ok('a blank person name is refused', r.status === 400, `-> ${r.status}`);
  r = await call('POST', '/debts', { kind: 'LENT', originalAmount: 10 }, token);
  ok('a missing person name is refused', r.status === 400, `-> ${r.status}`);
  r = await call('POST', '/debts',
    { kind: 'LENT', personName: 'X', originalAmount: 10, category: 'NotOneOfMine' }, token);
  ok('a category that is not the student’s own is refused', r.status === 400, `-> ${r.status}`);

  section('EXACT ARITHMETIC - why these columns are numeric');

  r = await call('POST', '/debts',
    { kind: 'BORROWED', personName: 'Float Test', originalAmount: 100 }, token);
  const floatId = r.data?.data?.debt?._id;
  for (const amount of [33.33, 33.33, 33.33]) {
    await call('POST', `/debts/${floatId}/payments`, { amount }, token);
  }
  r = await call('GET', `/debts/${floatId}`, undefined, token);
  // In floating point this lands on 0.010000000000005 and never settles.
  ok('three payments of 33.33 leave exactly 0.01',
    r.data?.data?.debt?.remainingAmount === 0.01, `${r.data?.data?.debt?.remainingAmount}`);
  r = await call('POST', `/debts/${floatId}/payments`, { amount: 0.01 }, token);
  ok('and the last 0.01 settles it exactly',
    r.data?.data?.debt?.status === 'SETTLED' && r.data?.data?.debt?.remainingAmount === 0,
    `${r.data?.data?.debt?.status}, remaining=${r.data?.data?.debt?.remainingAmount}`);

  section('PARTIAL PAYMENTS');

  r = await call('POST', `/debts/${borrowedId}/payments`,
    { amount: 2000, note: 'First instalment' }, token);
  ok('a partial payment is recorded', r.status === 201, `-> ${r.status}`);
  ok('the status becomes PARTIALLY_PAID', r.data?.data?.debt?.status === 'PARTIALLY_PAID',
    r.data?.data?.debt?.status);
  ok('and the remaining drops', r.data?.data?.debt?.remainingAmount === 3000,
    `${r.data?.data?.debt?.remainingAmount}`);

  r = await call('POST', `/debts/${borrowedId}/payments`, { amount: 0 }, token);
  ok('a zero payment is refused', r.status === 400, `-> ${r.status}`);
  r = await call('POST', `/debts/${borrowedId}/payments`, { amount: -500 }, token);
  ok('a negative payment is refused', r.status === 400, `-> ${r.status}`);

  section('OVERPAYMENT LEAVES NOTHING BEHIND');

  r = await call('POST', `/debts/${borrowedId}/payments`, { amount: 999999 }, token);
  ok('paying more than is left is refused', r.status === 400, `-> ${r.status}`);
  ok('and the message says how much is left', /3000/.test(r.data?.message || ''), r.data?.message);

  // The important half: the transaction rolled back, so the ledger and the
  // balance are exactly as they were.
  r = await call('GET', `/debts/${borrowedId}`, undefined, token);
  ok('the balance is unchanged', r.data?.data?.debt?.remainingAmount === 3000,
    `${r.data?.data?.debt?.remainingAmount}`);
  ok('and no payment row was written', (r.data?.data?.payments || []).length === 1,
    `${(r.data?.data?.payments || []).length} payments`);

  section('SETTLING IN FULL');

  r = await call('POST', `/debts/${borrowedId}/settle`, {}, token);
  ok('settle clears whatever is left', r.data?.data?.debt?.status === 'SETTLED',
    r.data?.data?.debt?.status);
  ok('remaining is exactly zero', r.data?.data?.debt?.remainingAmount === 0);
  r = await call('POST', `/debts/${borrowedId}/settle`, {}, token);
  ok('settling an already settled record is refused', r.status === 400, `-> ${r.status}`);

  // A settled record keeps its history rather than disappearing.
  r = await call('GET', `/debts/${borrowedId}`, undefined, token);
  ok('a settled record keeps its full ledger', (r.data?.data?.payments || []).length === 2,
    `${(r.data?.data?.payments || []).length} payments`);
  ok('and the payments add up to the original',
    (r.data?.data?.payments || []).reduce((sum, p) => sum + p.amount, 0) === 5000);

  section('CORRECTING A MISTYPED PAYMENT');

  const paymentId = r.data?.data?.payments?.[0]?._id;
  r = await call('DELETE', `/debts/${borrowedId}/payments/${paymentId}`, undefined, token);
  ok('a payment can be undone', r.status === 200, `-> ${r.status}`);
  ok('and the record reopens', r.data?.data?.debt?.status === 'PARTIALLY_PAID',
    `${r.data?.data?.debt?.status}, remaining=${r.data?.data?.debt?.remainingAmount}`);
  r = await call('DELETE', `/debts/${borrowedId}/payments/${paymentId}`, undefined, token);
  ok('undoing it twice is a 404', r.status === 404, `-> ${r.status}`);

  section('OVERDUE IS DERIVED, NOT STORED');

  const past = new Date();
  past.setDate(past.getDate() - 3);
  r = await call('POST', '/debts', {
    kind: 'LENT', personName: 'Late Bilal', originalAmount: 800, dueDate: past.toISOString(),
  }, token);
  const overdueId = r.data?.data?.debt?._id;
  ok('a past due date reads as overdue straight away', r.data?.data?.debt?.isOverdue === true);
  ok('while the stored status stays PENDING', r.data?.data?.debt?.status === 'PENDING',
    r.data?.data?.debt?.status);

  r = await call('GET', '/debts?status=OVERDUE', undefined, token);
  ok('overdue can be filtered on', (r.data?.data?.items || []).some((d) => d._id === overdueId),
    `${(r.data?.data?.items || []).length} rows`);

  const future = new Date();
  future.setDate(future.getDate() + 30);
  r = await call('POST', '/debts', {
    kind: 'LENT', personName: 'Future Usman', originalAmount: 300, dueDate: future.toISOString(),
  }, token);
  ok('a future due date is not overdue', r.data?.data?.debt?.isOverdue === false);

  section('SUMMARY');

  r = await call('GET', '/debts/summary', undefined, token);
  const s = r.data?.data;
  ok('the summary loads', r.status === 200, `-> ${r.status}`);
  // Ali: 5000 borrowed, 2000 still paid after the settle payment was undone.
  // Float Test is settled, so it contributes nothing.
  ok('payable counts only outstanding borrowed', s?.payable === 3000, `payable=${s?.payable}`);
  ok('receivable counts only outstanding lent', s?.receivable === 2300, `receivable=${s?.receivable}`);
  ok('net balance is receivable minus payable', s?.netBalance === -700, `net=${s?.netBalance}`);
  ok('overdue counts only what is late and unpaid', s?.overdue === 800, `overdue=${s?.overdue}`);
  ok('settled records are counted apart', s?.settledCount === 1, `settled=${s?.settledCount}`);
  ok('and due-soon records are listed', Array.isArray(s?.dueSoon), `${s?.dueSoon?.length} due soon`);

  section('FILTERING, SORTING AND PAGING');

  r = await call('GET', '/debts?kind=BORROWED', undefined, token);
  ok('the kind filter works', (r.data?.data?.items || []).every((d) => d.kind === 'BORROWED'),
    `${(r.data?.data?.items || []).length} rows`);
  r = await call('GET', '/debts?status=SETTLED', undefined, token);
  ok('the settled filter works', (r.data?.data?.items || []).every((d) => d.status === 'SETTLED'),
    `${(r.data?.data?.items || []).length} rows`);
  r = await call('GET', '/debts?status=OUTSTANDING', undefined, token);
  ok('the outstanding filter excludes settled',
    (r.data?.data?.items || []).every((d) => d.status !== 'SETTLED'),
    `${(r.data?.data?.items || []).length} rows`);

  // This once threw a 500: the second half of the clause pointed at the wrong
  // parameter, so a name was compared against a user id.
  r = await call('GET', '/debts?search=Sara', undefined, token);
  ok('person search finds the record', r.status === 200 && (r.data?.data?.items || []).length === 1,
    `-> ${r.status}, ${(r.data?.data?.items || []).length} rows`);
  r = await call('GET', '/debts?search=Mess%20bill', undefined, token);
  ok('search also looks at the note', (r.data?.data?.items || []).length === 1,
    `${(r.data?.data?.items || []).length} rows`);
  r = await call('GET', '/debts?search=%25', undefined, token);
  ok('a wildcard typed into search is escaped, not executed',
    r.status === 200 && (r.data?.data?.items || []).length === 0, `-> ${r.status}`);

  r = await call('GET', '/debts?sort=amount', undefined, token);
  const amounts = (r.data?.data?.items || []).map((d) => d.originalAmount);
  ok('sorting by amount is largest first',
    amounts.every((a, i) => i === 0 || amounts[i - 1] >= a), amounts.join(', '));

  r = await call('GET', '/debts?limit=2', undefined, token);
  ok('paging uses the same shape as every other list',
    r.data?.data?.pagination && 'hasNext' in r.data.data.pagination && 'pages' in r.data.data.pagination,
    JSON.stringify(r.data?.data?.pagination));
  ok('and honours the limit', (r.data?.data?.items || []).length <= 2);

  r = await call('GET', '/debts?status=NONSENSE', undefined, token);
  ok('an unknown status filter is refused', r.status === 400, `-> ${r.status}`);
  r = await call('GET', '/debts?sort=nonsense', undefined, token);
  ok('an unknown sort is refused', r.status === 400, `-> ${r.status}`);

  section('EDITING');

  r = await call('PUT', `/debts/${lentId}`, { personName: 'Sara Khan', note: 'For the trip' }, token);
  ok('a record can be edited', r.data?.data?.debt?.personName === 'Sara Khan', `-> ${r.status}`);
  r = await call('PUT', `/debts/${borrowedId}`, { originalAmount: 100 }, token);
  ok('the amount cannot be corrected below what is already paid', r.status === 400, `-> ${r.status}`);
  ok('and the message says how much that is', /2000/.test(r.data?.message || ''), r.data?.message);
  r = await call('PUT', `/debts/${borrowedId}`, { originalAmount: 2000 }, token);
  ok('correcting it down to exactly what was paid settles it',
    r.data?.data?.debt?.status === 'SETTLED', r.data?.data?.debt?.status);

  section('ONE STUDENT MUST NOT TOUCH ANOTHER’S');

  const other = await call('POST', '/auth/register', { acceptTerms: true,
    name: 'Other Student', email: `other-${Date.now()}@example.com`,
    password: 'OtherPass123!', confirmPassword: 'OtherPass123!',
  });
  const otherToken = other.data?.data?.accessToken;

  for (const [what, method, path, body] of [
    ['read', 'GET', `/debts/${lentId}`, undefined],
    ['edit', 'PUT', `/debts/${lentId}`, { note: 'hacked' }],
    ['delete', 'DELETE', `/debts/${lentId}`, undefined],
    ['pay', 'POST', `/debts/${lentId}/payments`, { amount: 1 }],
    ['settle', 'POST', `/debts/${lentId}/settle`, {}],
    ['read the ledger of', 'GET', `/debts/${lentId}/payments`, undefined],
  ]) {
    const res = await call(method, path, body, otherToken);
    ok(`another student cannot ${what} it`, res.status === 404, `-> ${res.status}`);
  }

  r = await call('GET', '/debts', undefined, otherToken);
  ok('and sees none of them in a list', (r.data?.data?.items || []).length === 0);
  r = await call('GET', '/debts/summary', undefined, otherToken);
  ok('nor in a summary', r.data?.data?.payable === 0 && r.data?.data?.receivable === 0);
  r = await call('GET', '/debts?search=Sara', undefined, otherToken);
  ok('nor through search', (r.data?.data?.items || []).length === 0);

  section('AUTHENTICATION AND BAD IDS');

  for (const [method, path] of [
    ['GET', '/debts'], ['GET', '/debts/summary'], ['POST', '/debts'],
    ['GET', `/debts/${lentId}`], ['POST', `/debts/${lentId}/payments`],
  ]) {
    const res = await call(method, path);
    ok(`${method} ${path.split('?')[0]} needs a token`, res.status === 401, `-> ${res.status}`);
  }

  r = await call('GET', '/debts/not-a-uuid', undefined, token);
  ok('a malformed id is a 400', r.status === 400, `-> ${r.status}`);
  r = await call('GET', '/debts/00000000-0000-0000-0000-000000000000', undefined, token);
  ok('a well-formed unknown id is a 404', r.status === 404, `-> ${r.status}`);
  r = await call('POST', '/debts/00000000-0000-0000-0000-000000000000/payments', { amount: 5 }, token);
  ok('paying an unknown record is a 404', r.status === 404, `-> ${r.status}`);
  r = await call('DELETE', `/debts/${lentId}/payments/not-a-uuid`, undefined, token);
  ok('a malformed payment id is a 400', r.status === 400, `-> ${r.status}`);

  section('DEBT PRINCIPAL STAYS OUT OF INCOME AND SPENDING');

  // The whole accounting decision, asserted: borrowing 5,000 and lending 1,200
  // must not have moved either dashboard figure.
  // Everything so far has been settled, so an outstanding record is created
  // here on purpose: comparing two zeroes would prove nothing about whether
  // the dashboard is really reading the same totals.
  r = await call('POST', '/debts', {
    kind: 'BORROWED',
    personName: 'Dashboard check',
    originalAmount: 777.77,
    transactionDate: new Date().toISOString(),
  }, token);
  ok('a record is left outstanding for the comparison', r.status === 201, `-> ${r.status}`);

  // Read the page's own totals first: the dashboard must repeat them exactly,
  // because the widget renders them and adds up nothing of its own.
  const pageSummary = await call('GET', '/debts/summary', undefined, token);
  const summaryPayable = pageSummary.data?.data?.payable;
  ok('the page reports the outstanding amount', summaryPayable === 777.77, `payable=${summaryPayable}`);

  r = await call('GET', '/dashboard/summary', undefined, token);
  ok('borrowing did not become income', r.data?.data?.totals?.incomeLogged === 0,
    `incomeLogged=${r.data?.data?.totals?.incomeLogged}`);
  ok('lending did not become an expense', r.data?.data?.totals?.spent === 0,
    `spent=${r.data?.data?.totals?.spent}`);
  ok('and repaying did not become one either', r.data?.data?.totals?.expenseCount === 0,
    `${r.data?.data?.totals?.expenseCount} expenses`);

  // The dashboard widget renders these figures and adds up nothing of its
  // own, so the position has to arrive with the rest of the dashboard.
  ok('the dashboard carries the debt position', r.data?.data?.debts !== undefined,
    r.data?.data?.debts === undefined ? 'no debts block' : 'present');
  ok('it agrees with the udhaar page', r.data?.data?.debts?.payable === summaryPayable,
    `dashboard=${r.data?.data?.debts?.payable} page=${summaryPayable}`);
  ok('and it carries what is falling due', Array.isArray(r.data?.data?.debts?.dueSoon),
    `dueSoon=${typeof r.data?.data?.debts?.dueSoon}`);

  section('DELETING A RECORD');

  r = await call('DELETE', `/debts/${lentId}`, undefined, token);
  ok('a record can be deleted', r.status === 200, `-> ${r.status}`);
  r = await call('GET', `/debts/${lentId}`, undefined, token);
  ok('and is gone afterwards', r.status === 404, `-> ${r.status}`);
  r = await call('GET', `/debts/${lentId}/payments`, undefined, token);
  ok('its ledger went with it', r.status === 404, `-> ${r.status}`);

  section('CLEAN UP');
  r = await call('DELETE', '/profile', { password: 'DebtPass123!' }, token);
  ok('the test account is removed', r.status === 200, `-> ${r.status}`);
  r = await call('DELETE', '/profile', { password: 'OtherPass123!' }, otherToken);
  ok('and so is the second one', r.status === 200, `-> ${r.status}`);

  report('UDHAAR');
})();
