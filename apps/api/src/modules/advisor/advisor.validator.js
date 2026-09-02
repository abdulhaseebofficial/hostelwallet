const { body } = require('express-validator');

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

module.exports = aiValidators;
