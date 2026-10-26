const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { setDone } = require('../controllers/progressController');

const router = express.Router();

// ---- IPP-1601: mark a question as done (any logged-in user) ----
router.put(
  '/:questionId',
  protect,
  validate([
    param('questionId').isMongoId().withMessage('Invalid question id'),
    body('done').isBoolean({ strict: true }).withMessage('done must be true or false'),
  ]),
  setDone
);

module.exports = router;
