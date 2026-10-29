const express = require('express');
const { query, param, body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { listProblems, setProblemActive, deleteProblem } = require('../controllers/problemAdminController');

const router = express.Router();
const idRule = param('id').isMongoId().withMessage('Invalid problem id');

// ---- IPP-1721: Admin -> Problems (hide / show / delete) ----
router.use(protect, adminOnly);
router.get(
  '/',
  validate([query('language').isString().matches(/^[a-z0-9-]{1,80}$/i).withMessage('Invalid language')]),
  listProblems
);
router.patch(
  '/:id',
  validate([idRule, body('isActive').isBoolean({ strict: true }).withMessage('isActive must be true or false')]),
  setProblemActive
);
router.delete('/:id', validate([idRule]), deleteProblem);

module.exports = router;
