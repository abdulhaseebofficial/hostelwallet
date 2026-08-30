/**
 * express-validator chains, grouped by resource.
 * Every chain is paired with the `validate` middleware in the route files,
 * which turns any failures into a single 400 with a per-field error list.
 */

const { body, param, query } = require('express-validator');
const {
  PAYMENT_METHODS,
  INCOME_SOURCES,
  RECURRING_FREQUENCIES,
  CURRENCIES,
  FEEDBACK_TYPES,
} = require('../config/constants');

const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

// Ids are Postgres uuids. Anything else is rejected here rather than reaching
// a query, where a malformed uuid would raise 22P02 and read as a 500.
const idParam = (name) => param(name).isUUID().withMessage('Invalid id');

const password = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be 8-72 characters')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain a letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number');

const amount = (field = 'amount') =>
  body(field)
    .exists({ checkFalsy: true })
    .withMessage('Amount is required')
    .bail()
    .isFloat({ gt: 0, max: 100000000 })
    .withMessage('Amount must be a positive number')
    .toFloat();

/* ------------------------------- auth -------------------------------- */

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

const goalValidators = {
  create: [
    body('title').trim().notEmpty().withMessage('Give your goal a name').isLength({ max: 80 }),
    body('targetAmount').isFloat({ gt: 0 }).withMessage('Target must be greater than 0').toFloat(),
    body('savedAmount').optional().isFloat({ min: 0 }).toFloat(),
    body('deadline').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid deadline'),
    body('icon').optional().isLength({ max: 8 }),
    body('note').optional().trim().isLength({ max: 200 }),
  ],

  update: [
    idParam('id'),
    body('title').optional().trim().notEmpty().isLength({ max: 80 }),
    body('targetAmount').optional().isFloat({ gt: 0 }).toFloat(),
    body('deadline').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('icon').optional().isLength({ max: 8 }),
    body('note').optional().trim().isLength({ max: 200 }),
  ],

  contribute: [
    idParam('id'),
    body('amount')
      .exists()
      .withMessage('Enter an amount')
      .bail()
      .isFloat()
      .withMessage('Amount must be a number')
      .toFloat()
      .custom((v) => v !== 0)
      .withMessage('Amount cannot be zero'),
    body('note').optional().trim().isLength({ max: 200 }),
  ],

  byId: [idParam('id')],
};

/* ------------------------------- budget ------------------------------ */

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

const aiValidators = {
  chat: [
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Type a question first')
      .isLength({ max: 1000 })
      .withMessage('Keep your question under 1000 characters'),
  ],

  advice: [
    body('tipCount').optional().isInt({ min: 3, max: 5 }).toInt(),
    body('month').optional().isInt({ min: 1, max: 12 }).toInt(),
    body('year').optional().isInt({ min: 2000, max: 2200 }).toInt(),
  ],
};

/* ------------------------------- reports ----------------------------- */

const reportValidators = {
  monthly: [
    query('month').optional().isInt({ min: 1, max: 12 }).toInt(),
    query('year').optional().isInt({ min: 2000, max: 2200 }).toInt(),
  ],

  export: [
    query('format').optional().isIn(['csv', 'pdf']).withMessage('Format must be csv or pdf'),
    query('month').optional().isInt({ min: 1, max: 12 }).toInt(),
    query('year').optional().isInt({ min: 2000, max: 2200 }).toInt(),
  ],
};

/* ------------------------------- feedback ---------------------------- */

const feedbackValidators = {
  create: [
    body('message')
      .exists({ checkFalsy: true })
      .withMessage('Tell us what is on your mind')
      .bail()
      .isString()
      .trim()
      .isLength({ min: 5, max: 2000 })
      .withMessage('Feedback must be 5-2000 characters'),
    body('type').optional().isIn(FEEDBACK_TYPES).withMessage('Unknown feedback type'),
    body('rating').optional({ nullable: true }).isInt({ min: 1, max: 5 }).toInt(),
    body('page').optional().isString().trim().isLength({ max: 120 }),
  ],
};

module.exports = {
  authValidators,
  profileValidators,
  expenseValidators,
  incomeValidators,
  goalValidators,
  budgetValidators,
  aiValidators,
  reportValidators,
  feedbackValidators,
};
