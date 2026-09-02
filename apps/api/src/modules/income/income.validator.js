const { body } = require('express-validator');
const { idParam, amount } = require('../../shared/validation/rules');
const { INCOME_SOURCES } = require('../../shared/constants');

const incomeValidators = {
  create: [
    amount(),
    body('source').optional().isIn(INCOME_SOURCES).withMessage('Unknown income source'),
    body('note').optional().trim().isLength({ max: 200 }),
    body('date').optional().isISO8601().toDate(),
  ],

  update: [
    idParam('id'),
    body('amount').optional().isFloat({ gt: 0 }).toFloat(),
    body('source').optional().isIn(INCOME_SOURCES),
    body('note').optional().trim().isLength({ max: 200 }),
    body('date').optional().isISO8601().toDate(),
  ],

  byId: [idParam('id')],
};

/* -------------------------------- goals ------------------------------ */

module.exports = incomeValidators;
