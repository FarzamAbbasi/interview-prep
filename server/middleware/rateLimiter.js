const rateLimit = require('express-rate-limit');

// Same JSON shape as all other errors
const sendLimitError = (req, res, next, options) =>
  res.status(options.statusCode).json({ success: false, message: options.message });

// Login, register, forgot password: 10 failed tries per 15 minutes per IP.
// Successful requests do not count, so normal users are never blocked.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many attempts. Please try again after 15 minutes',
  handler: sendLimitError,
});

// Whole API: 300 requests per 15 minutes per IP (stops scripts hammering the server)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many requests. Please slow down and try again shortly',
  handler: sendLimitError,
});

// Routes that SEND an email (register, resend verification, forgot password):
// 10 requests per hour per IP, successful or not, so nobody can spam inboxes
// or use up the Gmail sending limit.
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many emails requested. Please try again after an hour',
  handler: sendLimitError,
});

module.exports = { authLimiter, generalLimiter, emailLimiter };
