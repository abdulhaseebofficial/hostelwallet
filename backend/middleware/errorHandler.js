const ApiError = require('../utils/ApiError');
const { isDevelopment } = require('../config/validateEnv');

/** 404 handler for unmatched routes. Runs before the error handler. */
const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Single place where every error becomes a JSON response.
 * Mongoose / JWT errors are translated into friendly messages; unexpected
 * errors are logged in full but reported generically in production.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  // Mongoose: bad ObjectId in a route param
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Mongo: unique index violation
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || { field: 'value' })[0];
    message =
      field === 'email'
        ? 'An account with this email already exists'
        : `Duplicate value for ${field}`;
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  const isServerError = statusCode >= 500;
  if (isServerError) {
    console.error('[error]', err.stack || err);
  }

  // Default-deny: internals are only ever revealed when NODE_ENV explicitly
  // says "development". An unset NODE_ENV must not leak stack traces.
  const debug = isDevelopment();

  res.status(statusCode).json({
    success: false,
    message: isServerError && !debug ? 'Something went wrong' : message,
    ...(details ? { errors: details } : {}),
    ...(debug && isServerError ? { stack: err.stack } : {}),
  });
};

module.exports = { notFound, errorHandler };
