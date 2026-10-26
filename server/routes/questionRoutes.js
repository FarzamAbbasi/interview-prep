const express = require('express');
const { query, param } = require('express-validator');
const validate = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const { getQuestions, getTags, getQuestionById } = require('../controllers/questionController');

const router = express.Router();

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1 to 50'),
  query('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('difficulty must be easy, medium or hard'),
  query('search').optional().isString().isLength({ max: 100 }).withMessage('search can be up to 100 characters'),
  query('tag').optional().isString().isLength({ max: 30 }).withMessage('tag can be up to 30 characters'),
  query('language').optional().isString().isLength({ max: 50 }).withMessage('Invalid language'),
  query('topic').optional().isString().isLength({ max: 60 }).withMessage('Invalid topic'), // IPP-404
];

// ---- IPP-403: public question browsing (login optional: paid users see all answers) ----
router.get('/', optionalAuth, validate(listRules), getQuestions);
router.get(
  '/tags',
  optionalAuth, // IPP-1501: unpaid users only get tags of free questions
  validate([query('language').optional().isString().isLength({ max: 50 }), query('topic').optional().isString().isLength({ max: 60 })]),
  getTags
);
router.get('/:id', optionalAuth, validate([param('id').isMongoId().withMessage('Invalid question id')]), getQuestionById);

module.exports = router;
