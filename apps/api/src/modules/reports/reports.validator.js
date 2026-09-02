const { query } = require('express-validator');

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

module.exports = reportValidators;
