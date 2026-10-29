const express = require('express');
const { query, param, body } = require('express-validator');
const validate = require('../middleware/validate');
const { optionalAuth, protect } = require('../middleware/auth');
const { getProblems, getProblem, submitProblem } = require('../controllers/problemController');

const router = express.Router();

const slugRule = (field, where) =>
  where(field)
    .isString()
    .matches(/^[a-z0-9-]{1,80}$/i)
    .withMessage(`Invalid ${field}`);

// ---- IPP-1715: coding problems (login optional: unlocked languages show everything) ----
router.get('/', optionalAuth, validate([slugRule('language', query)]), getProblems);
router.get('/:language/:slug', optionalAuth, validate([slugRule('language', param), slugRule('slug', param)]), getProblem);

// ---- IPP-1718: save a Submit result (logged in) ----
router.post(
  '/:language/:slug/submit',
  protect,
  validate([
    slugRule('language', param),
    slugRule('slug', param),
    body('passed').isBoolean({ strict: true }).withMessage('passed must be true or false'),
    body('code').isString().withMessage('code must be text').isLength({ max: 20000 }).withMessage('code can be up to 20,000 characters'),
  ]),
  submitProblem
);

module.exports = router;
