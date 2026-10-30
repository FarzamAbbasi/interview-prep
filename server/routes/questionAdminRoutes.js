const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionAdminController');

const router = express.Router();

// Every route here is admin only
router.use(protect, adminOnly);

const idRule = param('id').isMongoId().withMessage('Invalid question id');

// For create, language/type/question/answer are required; for update, all are optional.
// MCQ-specific rules (4 options, correctOption) are checked in the controller.
const questionRules = (isUpdate) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('language')).isMongoId().withMessage('Choose a language'),
    ...(isUpdate ? [] : [body('type').isIn(['qa', 'mcq']).withMessage('Type must be "qa" or "mcq"')]),
    body('topic').optional().isString().trim().isLength({ max: 60 }).withMessage('Invalid topic'),
    req(body('question'))
      .isString()
      .withMessage('Question text is required')
      .trim()
      .notEmpty()
      .withMessage('Question text is required')
      .isLength({ max: 2000 })
      .withMessage('Question cannot be more than 2000 characters'),
    req(body('answer'))
      .isString()
      .withMessage('Answer / explanation is required')
      .trim()
      .notEmpty()
      .withMessage('Answer / explanation is required')
      .isLength({ max: 10000 })
      .withMessage('Answer cannot be more than 10000 characters'),
    body('options').optional().isArray().withMessage('Options must be a list'),
    body('options.*').optional().isString().isLength({ max: 500 }).withMessage('Each option can be up to 500 characters'),
    body('correctOption').optional().isInt({ min: 0, max: 3 }).withMessage('Choose the correct option (0 to 3)').toInt(),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Difficulty must be easy, medium or hard'),
    body('tags').optional().isArray({ max: 10 }).withMessage('Up to 10 tags'),
    body('tags.*').optional().isString().trim().isLength({ min: 1, max: 30 }).withMessage('Each tag can be 1 to 30 characters'),
    // IPP-1732: "Asked at" companies; a question with companies is never free
    body('companies').optional().isArray({ max: 10 }).withMessage('Up to 10 companies'),
    body('companies.*').optional().isString().trim().isLength({ min: 1, max: 60 }).withMessage('Each company can be 1 to 60 characters'),
    body('codeSnippet').optional().isString().isLength({ max: 5000 }).withMessage('Code snippet cannot be more than 5000 characters'),
    body('isFree').optional().isBoolean({ strict: true }).withMessage('isFree must be true or false'),
    body('isActive').optional().isBoolean({ strict: true }).withMessage('isActive must be true or false'),
  ];
};

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1 to 100'),
    query('type').optional().isIn(['qa', 'mcq']).withMessage('type must be qa or mcq'),
    query('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('difficulty must be easy, medium or hard'),
    query('isFree').optional().isIn(['true', 'false']).withMessage('isFree must be true or false'),
    query('isActive').optional().isIn(['true', 'false']).withMessage('isActive must be true or false'),
    query('search').optional().isString().isLength({ max: 100 }),
    query('topic').optional().isString().isLength({ max: 60 }),
  ]),
  listQuestions
);
router.get('/:id', validate([idRule]), getQuestion);
router.post('/', validate(questionRules(false)), createQuestion);
router.put('/:id', validate([idRule, ...questionRules(true)]), updateQuestion);
router.delete('/:id', validate([idRule]), deleteQuestion);

module.exports = router;
