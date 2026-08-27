const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Collects express-validator results and turns them into a single 400 with a
 * field-by-field error list the frontend can map onto its form inputs.
 */
const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({ field: e.path || e.param, message: e.msg }));
  return next(ApiError.badRequest('Validation failed', errors));
};

module.exports = validate;
