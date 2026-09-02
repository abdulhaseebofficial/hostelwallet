const { body, query } = require('express-validator');
const { idParam, amount } = require('../../shared/validation/rules');
const { PAYMENT_METHODS, RECURRING_FREQUENCIES } = require('../../shared/constants');

const expenseValidators = {
  create: [
    amount(),
    body('category').trim().notEmpty().withMessage('Pick a category'),
    body('description').optional().trim().isLength({ max: 200 }),
    body('paymentMethod').optional().isIn(PAYMENT_METHODS).withMessage('Unknown payment method'),
    body('date').optional().isISO8601().withMessage('Invalid date').toDate(),
    body('isRecurring').optional().isBoolean().toBoolean(),
    body('recurringFrequency').optional().isIn(RECURRING_FREQUENCIES),
  ],

  update: [
    idParam('id'),
    body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be positive').toFloat(),
    body('category').optional().trim().notEmpty(),
    body('description').optional().trim().isLength({ max: 200 }),
    body('paymentMethod').optional().isIn(PAYMENT_METHODS),
    body('date').optional().isISO8601().toDate(),
    body('isRecurring').optional().isBoolean().toBoolean(),
    body('recurringFrequency').optional().isIn(RECURRING_FREQUENCIES),
  ],

  list: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('from').optional().isISO8601().withMessage('Invalid "from" date'),
    query('to').optional().isISO8601().withMessage('Invalid "to" date'),
    query('minAmount').optional().isFloat({ min: 0 }).toFloat(),
    query('maxAmount').optional().isFloat({ min: 0 }).toFloat(),
  ],

  byId: [idParam('id')],
};

/* ------------------------------- income ------------------------------ */

module.exports = expenseValidators;
