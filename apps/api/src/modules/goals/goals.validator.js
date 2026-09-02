const { body } = require('express-validator');
const { idParam, amount } = require('../../shared/validation/rules');

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

module.exports = goalValidators;
