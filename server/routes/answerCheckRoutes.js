const express = require('express');
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { aiLimiter } = require('../middleware/rateLimiter');
const { getStatus, check, getAdminStats, updateLimits } = require('../controllers/answerCheckController');
const { MAX_ANSWER_CHARS } = require('../utils/aiProvider');
const { MAX_LIMIT } = require('../utils/answerCheckLimits');

// ---- IPP-1728: AI answer check (logged in) -> /api/answer-check ----
const router = express.Router();
router.use(protect);

const sourceRule = (where) => where('source').optional().isIn(['questions', 'interview']).withMessage('Invalid source');
router.get('/status', validate([sourceRule(query)]), getStatus);
router.post(
  '/',
  aiLimiter,
  validate([
    body('question').isMongoId().withMessage('Invalid question id'),
    body('answer')
      .isString()
      .withMessage('Write your answer first')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Write a bit more (at least one sentence) before checking')
      .isLength({ max: MAX_ANSWER_CHARS })
      .withMessage(`Your answer can be up to ${MAX_ANSWER_CHARS} characters`),
    sourceRule(body),
  ]),
  check
);

// ---- Admin -> /api/admin/answer-check ----
const adminRouter = express.Router();
adminRouter.use(protect, adminOnly);

const limitRule = (field) =>
  body(field).isInt({ min: 0, max: MAX_LIMIT }).withMessage(`${field} must be a number from 0 to ${MAX_LIMIT}`).toInt();

adminRouter.get('/', getAdminStats);
adminRouter.patch(
  '/',
  validate([limitRule('practice.free'), limitRule('practice.paid'), limitRule('interview.free'), limitRule('interview.paid')]),
  updateLimits
);

module.exports = { router, adminRouter };
