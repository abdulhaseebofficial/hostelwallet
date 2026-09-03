const { body, param } = require('express-validator');
const {
  name,
  email,
  password,
  confirmPassword,
  accepted,
  CURRENCY_CODES,
} = require('../../shared/validation/rules');
const { TERMS_MESSAGE } = require('@hostelwallet/contracts/validation');

const authValidators = {
  register: [
    name(),
    email(),
    password(),
    confirmPassword(),
    accepted('acceptTerms', TERMS_MESSAGE),
    body('monthlyIncome').optional().isFloat({ min: 0 }).toFloat(),
    body('currency').optional().isIn(CURRENCY_CODES).withMessage('Unsupported currency'),
  ],

  // Login checks the shape of the address but never the password policy: the
  // rules can tighten over time, and an existing password that no longer meets
  // them must still open the account it belongs to. Only a NEW password is
  // held to the current policy.
  login: [
    email(),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  forgotPassword: [email()],

  resetPassword: [param('token').isLength({ min: 20 }).withMessage('Invalid reset link'), password()],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Enter your current password'),
    password('newPassword'),
    confirmPassword('confirmPassword', 'newPassword'),
  ],
};

/* ------------------------------ profile ------------------------------ */

module.exports = authValidators;
