const { body, param } = require('express-validator');
const { password, CURRENCY_CODES } = require('../../shared/validation/rules');

const authValidators = {
  register: [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 60 }),
    body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
    password(),
    body('confirmPassword')
      .custom((value, { req }) => value === undefined || value === req.body.password)
      .withMessage('Passwords do not match'),
    body('monthlyIncome').optional().isFloat({ min: 0 }).toFloat(),
    body('currency').optional().isIn(CURRENCY_CODES).withMessage('Unsupported currency'),
  ],

  login: [
    body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  forgotPassword: [body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail()],

  resetPassword: [param('token').isLength({ min: 20 }).withMessage('Invalid reset link'), password()],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Enter your current password'),
    password('newPassword'),
  ],
};

/* ------------------------------ profile ------------------------------ */

module.exports = authValidators;
