/**
 * Udhaar: what a student borrowed, and what they lent.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It creates no expense and no income. Borrowing 5,000 is cash arriving that
 * has to go back out again - it is not earnings, and recording it as income
 * would have the dashboard congratulate a student on money they owe. Lending is
 * the mirror: money leaving that is still theirs, not spending. Repaying is
 * neither, or a student would appear to have spent the same 5,000 twice.
 *
 * So the dashboard's income and spend stay about what was actually earned and
 * actually consumed, and a debt position is reported separately. Anything else
 * would need an accounting model this app does not have.
 *
 * BALANCES ARE NEVER TAKEN FROM A REQUEST
 *
 * `remaining` and `status` are derived - in SQL, from the ledger - on every
 * read. A client can say what it likes about what is left; it will be ignored.
 */

const debtsRepo = require('./debts.repository');
const ApiError = require('../../shared/errors/ApiError');
const events = require('../../shared/events');
const { isOwnCategory } = require('../../shared/categories');
const { round2 } = require('../../shared/utils/calculations');

/** How far ahead "due soon" looks, for the summary and for reminders. */
const DUE_SOON_DAYS = 7;

/** Only these may be edited; money moves through payments, never through a patch. */
const EDITABLE = [
  'kind',
  'personName',
  'personContact',
  'originalAmount',
  'transactionDate',
  'dueDate',
  'category',
  'note',
];

/**
 * A category is optional, but if one is given it has to be one of the
 * student's own - the same rule expenses follow, so the two agree about what a
 * category is.
 */
const assertCategory = (user, category) => {
  if (category === undefined || category === null || category === '') return;
  if (!isOwnCategory(user, category)) {
    throw ApiError.badRequest(`"${category}" is not one of your categories`);
  }
};

/* ------------------------------ reading ----------------------------- */

const list = (userId, filters) => debtsRepo.list(userId, filters);

/** One debt with its ledger, which is the only way the details screen is useful. */
const getById = async (id, userId) => {
  const debt = await debtsRepo.findById(id, userId);
  if (!debt) throw ApiError.notFound('Debt record not found');

  const payments = await debtsRepo.payments(id, userId);
  return { debt, payments };
};

const paymentsFor = async (id, userId) => {
  const debt = await debtsRepo.findById(id, userId);
  if (!debt) throw ApiError.notFound('Debt record not found');
  return debtsRepo.payments(id, userId);
};

/* ------------------------------ writing ----------------------------- */

const create = async (user, input) => {
  assertCategory(user, input.category);

  return debtsRepo.create(user._id, {
    kind: input.kind,
    personName: String(input.personName).trim(),
    personContact: input.personContact,
    originalAmount: input.originalAmount,
    transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    category: input.category || null,
    note: input.note,
  });
};

/**
 * Edits a record. The amount may be corrected, but never below what has already
 * been paid against it - that would leave a debt owing less than nothing, and
 * the ledger is the thing that is true.
 */
const update = async (id, user, body) => {
  const existing = await debtsRepo.findById(id, user._id);
  if (!existing) throw ApiError.notFound('Debt record not found');

  if (body.category !== undefined) assertCategory(user, body.category);

  const patch = {};
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined) patch[field] = body[field];
  });

  if (patch.originalAmount !== undefined && Number(patch.originalAmount) < existing.paidAmount) {
    throw ApiError.badRequest(
      `Already paid ${existing.paidAmount}, so the amount cannot be corrected below that`
    );
  }

  if (patch.personName !== undefined) patch.personName = String(patch.personName).trim();
  if (patch.transactionDate !== undefined) patch.transactionDate = new Date(patch.transactionDate);
  if (patch.dueDate !== undefined) patch.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;

  const debt = await debtsRepo.update(id, user._id, patch);
  if (!debt) throw ApiError.notFound('Debt record not found');
  return debt;
};

/**
 * Deletes a record and its ledger.
 *
 * Settled records are never removed automatically - "I paid Ali back in March"
 * is worth keeping - but a student may still delete one they entered by
 * mistake, and that is their call to make.
 */
const remove = async (id, userId) => {
  const removed = await debtsRepo.remove(id, userId);
  if (!removed) throw ApiError.notFound('Debt record not found');
  return id;
};

/* ----------------------------- payments ----------------------------- */

/** Announces a settlement, once, the first time a debt is cleared. */
const announceIfSettled = async (user, result) => {
  if (result.debt.status === 'SETTLED' && !result.wasSettled) {
    await events.emitAndWait(events.DEBT_SETTLED, { user, debt: result.debt });
  }
};

const addPayment = async (id, user, { amount, paidOn, note }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw ApiError.badRequest('A payment has to be more than zero');
  }

  const result = await debtsRepo.addPayment(id, user._id, { amount: value, paidOn, note });

  if (result.reason === 'NOT_FOUND') throw ApiError.notFound('Debt record not found');
  if (result.reason === 'OVERPAY') {
    throw ApiError.badRequest(
      `That is more than is left. Only ${round2(result.remaining)} remains on this record.`
    );
  }

  await announceIfSettled(user, result);
  return { debt: result.debt, payment: result.payment, justSettled: result.debt.status === 'SETTLED' && !result.wasSettled };
};

/**
 * Clears whatever is left in one payment.
 *
 * Convenience rather than a separate concept: it works out the remaining
 * balance and records an ordinary payment for it, so the ledger reads the same
 * as if the student had typed the figure themselves.
 */
const settle = async (id, user, note) => {
  const debt = await debtsRepo.findById(id, user._id);
  if (!debt) throw ApiError.notFound('Debt record not found');
  if (debt.remainingAmount <= 0) throw ApiError.badRequest('This record is already settled');

  return addPayment(id, user, {
    amount: debt.remainingAmount,
    paidOn: new Date(),
    note: note || 'Settled in full',
  });
};

/** Removes a mistyped payment and puts the balance back. */
const removePayment = async (debtId, paymentId, userId) => {
  const result = await debtsRepo.removePayment(debtId, paymentId, userId);

  if (result.reason === 'NOT_FOUND') throw ApiError.notFound('Debt record not found');
  if (result.reason === 'PAYMENT_NOT_FOUND') throw ApiError.notFound('Payment not found');

  return result.debt;
};

/* ------------------------------ summary ----------------------------- */

/**
 * The student's position.
 *
 * netBalance = receivable - payable, so a positive number means more is owed to
 * them than by them. Only outstanding amounts count; a settled debt is history.
 */
const summary = async (userId) => {
  const [totals, dueSoon] = await Promise.all([
    debtsRepo.summary(userId),
    debtsRepo.dueWithin(userId, DUE_SOON_DAYS),
  ]);

  return {
    payable: round2(totals.payable),
    receivable: round2(totals.receivable),
    netBalance: round2(totals.receivable - totals.payable),
    overdue: round2(totals.overdue),
    outstandingCount: totals.outstandingCount,
    settledCount: totals.settledCount,
    overdueCount: totals.overdueCount,
    dueSoon,
    dueSoonDays: DUE_SOON_DAYS,
  };
};

module.exports = {
  list,
  getById,
  paymentsFor,
  create,
  update,
  remove,
  addPayment,
  settle,
  removePayment,
  summary,
};
