const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const {
  getSetup,
  startRound,
  saveItem,
  answerItem,
  rateItem,
  recheckItem,
  finishRound,
  getRound,
  getHistory,
  deleteRound,
  clearHistory,
} = require('../controllers/interviewController');

const router = express.Router();

// ---- IPP-1724: Interview Mode (every route needs a logged-in user) ----
router.use(protect);

const roundId = param('roundId').isMongoId().withMessage('Invalid round id');

// Fixed paths ('/setup', '/history') must stay above '/:roundId'
router.get('/setup', getSetup);

router.post(
  '/start',
  validate([
    body('language').isString().withMessage('Choose a language').trim().notEmpty().withMessage('Choose a language'),
    body('level').isIn(['junior', 'mid', 'senior']).withMessage('Level must be junior, mid or senior'),
  ]),
  startRound
);

router.get(
  '/history',
  validate([query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more')]),
  getHistory
);
router.delete('/history', clearHistory);

router.get('/:roundId', validate([roundId]), getRound);

router.patch(
  '/:roundId/items/:index',
  validate([
    roundId,
    param('index').isInt({ min: 0, max: 9 }).withMessage('Invalid question number'),
    body('rating')
      .optional()
      .isIn(['knew', 'partly', 'didnt', 'skipped'])
      .withMessage('Rate your answer: knew, partly, didnt or skipped'),
    body('code')
      .optional()
      .isString()
      .withMessage('code must be text')
      .isLength({ max: 20000 })
      .withMessage('code can be up to 20,000 characters'),
    body('passed').optional().isInt({ min: 0, max: 1000 }).withMessage('passed must be a number of tests').toInt(),
  ]),
  saveItem
);

// IPP-1730: typed Q&A answer -> AI check -> points (interview daily count; 20 per 5 min per IP like practice)
router.post(
  '/:roundId/items/:index/answer',
  aiLimiter,
  validate([
    roundId,
    param('index').isInt({ min: 0, max: 9 }).withMessage('Invalid question number'),
    body('answer')
      .isString()
      .withMessage('Write your answer first')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Write a bit more (at least one sentence) before checking')
      .isLength({ max: 2000 })
      .withMessage('Your answer can be up to 2,000 characters'),
  ]),
  answerItem
);

// IPP-1730: rate an answer the AI could not check, on the report (finished round)
router.patch(
  '/:roundId/items/:index/rate',
  validate([
    roundId,
    param('index').isInt({ min: 0, max: 9 }).withMessage('Invalid question number'),
    body('rating').isIn(['knew', 'partly', 'didnt']).withMessage('Rate your answer: knew, partly or didnt'),
  ]),
  rateItem
);

// IPP-1730: "Check with AI again" for a pending answer (finished round)
router.post(
  '/:roundId/items/:index/recheck',
  aiLimiter,
  validate([roundId, param('index').isInt({ min: 0, max: 9 }).withMessage('Invalid question number')]),
  recheckItem
);

router.post('/:roundId/finish', validate([roundId]), finishRound);

router.delete('/:roundId', validate([roundId]), deleteRound);

module.exports = router;
