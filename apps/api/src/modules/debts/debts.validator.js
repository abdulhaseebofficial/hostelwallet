const { body, param, query } = require('express-validator');
const { idParam, amount } = require('../../shared/validation/rules');

const KINDS = ['BORROWED', 'LENT'];
/** OUTSTANDING and OVERDUE are filters over derived state, not stored values. */
const FILTER_STATUSES = ['PENDING', 'PARTIALLY_PAID', 'SETTLED', 'OVERDUE', 'OUTSTANDING'];
const SORTS = ['newest', 'oldest', 'amount', 'remaining', 'due'];

/** Shared by create and update; optional on update, required on create. */
const personName = (chain) =>
  chain.isString().trim().isLength({ min: 1, max: 80 }).withMessage('Whose name should this be under?');

const debtValidators = {
  create: [
    body('kind').isIn(KINDS).withMessage('Say whether you borrowed or lent'),
    personName(body('personName').exists({ checkFalsy: true }).bail()),
    amount('originalAmount'),
    body('personContact').optional().isString().trim().isLength({ max: 120 }),
    body('transactionDate').optional().isISO8601().toDate(),
    body('dueDate').optional({ nullable: true }).isISO8601().toDate(),
    body('category').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('note').optional().isString().trim().isLength({ max: 500 }),
  ],

  update: [
    idParam('id'),
    body('kind').optional().isIn(KINDS),
    personName(body('personName').optional()),
    body('originalAmount').optional().isFloat({ gt: 0 }).withMessage('Amount must be more than zero').toFloat(),
    body('personContact').optional().isString().trim().isLength({ max: 120 }),
    body('transactionDate').optional().isISO8601().toDate(),
    body('dueDate').optional({ nullable: true }).isISO8601().toDate(),
    body('category').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('note').optional().isString().trim().isLength({ max: 500 }),
  ],

  byId: [idParam('id')],

  /** A payment names an amount; the rest is optional colour. */
  addPayment: [
    idParam('id'),
    amount('amount'),
    body('paidOn').optional().isISO8601().toDate(),
    body('note').optional().isString().trim().isLength({ max: 200 }),
  ],

  settle: [idParam('id'), body('note').optional().isString().trim().isLength({ max: 200 })],

  /** Both ids matter: a payment is only reachable through the debt that owns it. */
  removePayment: [idParam('id'), param('paymentId').isUUID().withMessage('Invalid payment id')],

  list: [
    query('kind').optional().isIn(KINDS).withMessage('kind must be BORROWED or LENT'),
    query('status').optional().isIn(FILTER_STATUSES).withMessage('Unknown status filter'),
    query('sort').optional().isIn(SORTS).withMessage('Unknown sort order'),
    query('search').optional().isString().trim().isLength({ max: 80 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('dueFrom').optional().isISO8601(),
    query('dueTo').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
};

module.exports = debtValidators;
