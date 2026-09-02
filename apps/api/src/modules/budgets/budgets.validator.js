const { body } = require('express-validator');
const { idParam } = require('../../shared/validation/rules');

const budgetValidators = {
  upsert: [
    body('category').trim().notEmpty().withMessage('Pick a category'),
    body('limit').isFloat({ min: 0 }).withMessage('Limit cannot be negative').toFloat(),
    body('month').optional().isInt({ min: 1, max: 12 }).toInt(),
    body('year').optional().isInt({ min: 2000, max: 2200 }).toInt(),
  ],

  bulk: [
    body('items').isArray({ min: 1 }).withMessage('Send at least one budget line'),
    body('items.*.category').trim().notEmpty().withMessage('Every line needs a category'),
    body('items.*.limit').isFloat({ min: 0 }).withMessage('Every limit must be 0 or more').toFloat(),
    body('month').optional().isInt({ min: 1, max: 12 }).toInt(),
    body('year').optional().isInt({ min: 2000, max: 2200 }).toInt(),
  ],

  update: [idParam('id'), body('limit').isFloat({ min: 0 }).withMessage('Limit cannot be negative').toFloat()],

  byId: [idParam('id')],
};

/* --------------------------------- ai -------------------------------- */

module.exports = budgetValidators;
