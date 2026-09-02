const { body } = require('express-validator');
const { password, CURRENCY_CODES } = require('../../shared/validation/rules');

const profileValidators = {
  update: [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 60 }),
    body('monthlyIncome').optional().isFloat({ min: 0 }).withMessage('Income cannot be negative').toFloat(),
    body('currency').optional().isIn(CURRENCY_CODES).withMessage('Unsupported currency'),
    body('university').optional().trim().isLength({ max: 100 }),
    body('hostelName').optional().trim().isLength({ max: 100 }),
    body('theme').optional().isIn(['light', 'dark', 'system']),
  ],

  onboarding: [
    body('monthlyIncome').isFloat({ min: 0 }).withMessage('Enter your monthly pocket money').toFloat(),
    body('currency').optional().isIn(CURRENCY_CODES),
    body('goal.title').optional().trim().isLength({ max: 80 }),
    body('goal.targetAmount').optional().isFloat({ gt: 0 }).toFloat(),
  ],

  addCategory: [body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 40 })],

  deleteAccount: [body('password').notEmpty().withMessage('Password is required to delete your account')],
};

/* ------------------------------ expenses ----------------------------- */

module.exports = profileValidators;
