const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authLimiter, emailLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

// Reusable rules
const emailRule = body('email')
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage('Please enter a valid email');

const passwordRule = body('password')
  .isString()
  .withMessage('Password is required')
  // bcrypt only uses the first 72 bytes, so longer passwords are refused
  .isLength({ min: 6, max: 72 })
  .withMessage('Password must be 6 to 72 characters');

const nameRule = body('name')
  .isString()
  .withMessage('Name is required')
  .trim()
  .notEmpty()
  .withMessage('Name is required')
  .isLength({ max: 50 })
  .withMessage('Name cannot be more than 50 characters');

// ---- IPP-303: registration + email verification ----
router.post(
  '/register',
  authLimiter,
  emailLimiter,
  validate([nameRule, emailRule, passwordRule]),
  register
);

router.get(
  '/verify-email/:token',
  authLimiter,
  validate([param('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid verification link')]),
  verifyEmail
);

router.post('/resend-verification', emailLimiter, validate([emailRule]), resendVerification);

// ---- IPP-304: login + session ----
router.post(
  '/login',
  authLimiter, // 10 failed logins per 15 minutes per IP
  validate([
    emailRule,
    body('password').isString().notEmpty().withMessage('Password is required'),
  ]),
  login
);

router.get('/me', protect, getMe);

// ---- IPP-305: forgot / reset password ----
router.post('/forgot-password', emailLimiter, validate([emailRule]), forgotPassword);

router.post(
  '/reset-password/:token',
  authLimiter,
  validate([
    param('token')
      .isHexadecimal()
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid reset link'),
    passwordRule,
  ]),
  resetPassword
);

module.exports = router;
