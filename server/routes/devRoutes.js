/**
 * DEVELOPMENT ONLY test routes for the security middleware (IPP-302).
 * Mounted at /api/dev only when NODE_ENV=development (see app.js).
 * Safe to delete once auth routes are done.
 */
const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { paidOnly } = require('../middleware/paid');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { sendSuccess } = require('../utils/apiResponse');

const router = express.Router();

router.get('/protected', protect, (req, res) =>
  sendSuccess(res, { name: req.user.name, role: req.user.role }, 'You are logged in')
);

router.get('/admin', protect, adminOnly, (req, res) => sendSuccess(res, null, 'Welcome, admin'));

router.get('/paid', protect, paidOnly, (req, res) => sendSuccess(res, null, 'You have full access'));

router.post(
  '/validate',
  validate([
    body('email').trim().isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ]),
  (req, res) => sendSuccess(res, { email: req.body.email }, 'Validation passed')
);

// Always "fails" (401) so every call counts toward the limit: the 11th call gets 429
router.post('/limited', authLimiter, (req, res) =>
  res.status(401).json({ success: false, message: 'Wrong password (test)' })
);

router.get('/crash', () => {
  throw new Error('Test crash: this is how a server error looks');
});

module.exports = router;
