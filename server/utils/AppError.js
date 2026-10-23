// An error we throw on purpose, with an HTTP status code.
// Example: throw new AppError('Email already registered', 409);
// Optional `code` lets the frontend react to a specific case,
// e.g. throw new AppError('Please verify your email', 403, undefined, 'EMAIL_NOT_VERIFIED');
class AppError extends Error {
  constructor(message, statusCode = 500, errors = undefined, code = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors; // optional list of field errors
    this.errorCode = code; // optional short code for the frontend
  }
}

module.exports = AppError;
