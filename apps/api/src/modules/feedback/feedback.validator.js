const { body } = require('express-validator');
const { FEEDBACK_TYPES } = require('../../shared/constants');

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

module.exports = feedbackValidators;
