const AppError = require('../utils/AppError');

// Any /api route that does not exist
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// One place that turns every error into the same JSON shape:
// { success: false, message, errors? }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.errors && err.name === 'AppError' ? err.errors : undefined;

  // Bad MongoDB id, e.g. /questions/abc
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  }

  // Duplicate unique field, e.g. email already exists
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'Value';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || 'Validation failed';
  }

  // JWT problems
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid login session. Please log in again';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again';
  }

  // Broken JSON in request body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  }

  const isServerError = statusCode >= 500;
  if (isServerError) console.error('[error]', err);

  const body = { success: false, message };
  if (err.name === 'AppError' && err.errorCode) body.code = err.errorCode;
  if (errors) body.errors = errors;

  if (isServerError && process.env.NODE_ENV === 'production') {
    body.message = 'Something went wrong. Please try again later';
  } else if (isServerError) {
    body.stack = err.stack; // only in development, to help debugging
  }

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
