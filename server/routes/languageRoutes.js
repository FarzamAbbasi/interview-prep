const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const {
  getLanguages,
  getLanguageBySlug,
  createLanguage,
  updateLanguage,
  deleteLanguage,
} = require('../controllers/languageController');

const router = express.Router();

const idRule = param('id').isMongoId().withMessage('Invalid language id');

// For create: name is required. For update: every field is optional.
const languageRules = (isUpdate) => [
  (isUpdate ? body('name').optional() : body('name'))
    .isString()
    .withMessage('Name is required')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 50 })
    .withMessage('Name cannot be more than 50 characters'),
  body('slug')
    .optional()
    .isString()
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug can only have small letters, numbers and dashes (e.g. c-plus-plus)'),
  body('icon').optional().isString().trim().isLength({ max: 50 }).withMessage('Icon cannot be more than 50 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),
  body('isActive').optional().isBoolean({ strict: true }).withMessage('isActive must be true or false'),
  // IPP-404: [{ "name": "OOP" }, { "name": "Web & Security", "slug": "web-security" }] (order = display order)
  body('topics').optional().isArray({ max: 30 }).withMessage('Topics must be a list (up to 30)'),
  body('topics.*.name')
    .isString()
    .withMessage('Each topic needs a name')
    .trim()
    .notEmpty()
    .withMessage('Each topic needs a name')
    .isLength({ max: 50 })
    .withMessage('Topic name cannot be more than 50 characters'),
  body('topics.*.slug')
    .optional()
    .isString()
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Topic slug can only have small letters, numbers and dashes'),
];

// ---- Public (admins also see inactive languages) ----
router.get('/', optionalAuth, getLanguages);
router.get('/:slug', optionalAuth, getLanguageBySlug);

// ---- Admin ----
router.post('/', protect, adminOnly, validate(languageRules(false)), createLanguage);
router.put('/:id', protect, adminOnly, validate([idRule, ...languageRules(true)]), updateLanguage);
router.delete('/:id', protect, adminOnly, validate([idRule]), deleteLanguage);

module.exports = router;
