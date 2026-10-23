const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { startQuiz, submitQuiz, getHistory, getAttempt } = require('../controllers/quizController');

const router = express.Router();

// Every quiz route needs a logged-in user (guests are asked to register)
router.use(protect);

// ---- IPP-501: quiz engine ----
router.post(
  '/start',
  validate([
    body('language').isString().withMessage('Choose a language').trim().notEmpty().withMessage('Choose a language'),
    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard', 'mixed'])
      .withMessage('Difficulty must be easy, medium, hard or mixed'),
    body('topic').optional({ values: 'falsy' }).isString().isLength({ max: 60 }).withMessage('Invalid topic'),
  ]),
  startQuiz
);

router.post(
  '/:attemptId/submit',
  validate([
    param('attemptId').isMongoId().withMessage('Invalid quiz id'),
    body('answers').isArray({ max: 50 }).withMessage('answers must be a list'),
    body('answers.*.question').isMongoId().withMessage('Each answer needs a question id'),
    body('answers.*.selectedOption')
      .optional({ values: 'null' })
      .isInt({ min: 0, max: 3 })
      .withMessage('selectedOption must be 0 to 3 or null')
      .toInt(),
  ]),
  submitQuiz
);

// ---- IPP-502: history + result page ----
router.get(
  '/history',
  validate([query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more')]),
  getHistory
);
router.get('/:attemptId', validate([param('attemptId').isMongoId().withMessage('Invalid quiz id')]), getAttempt);

module.exports = router;
