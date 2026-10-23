const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { listUsers, setPaidAccess, setBlocked } = require('../controllers/userAdminController');

const router = express.Router();

router.use(protect, adminOnly);

const idRule = param('id').isMongoId().withMessage('Invalid user id');

// ---- IPP-1004: user list ----
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1 to 100'),
    query('search').optional().isString().isLength({ max: 100 }).withMessage('search can be up to 100 characters'),
    query('filter')
      .optional()
      .isIn(['paid', 'free', 'blocked', 'unverified', 'admin'])
      .withMessage('filter must be paid, free, blocked, unverified or admin'),
  ]),
  listUsers
);

// ---- IPP-502: manual paid access ----
router.put(
  '/:id/access',
  validate([idRule, body('isPaid').isBoolean({ strict: true }).withMessage('isPaid must be true or false')]),
  setPaidAccess
);

// ---- IPP-1004: block / unblock ----
router.put(
  '/:id/block',
  validate([idRule, body('isBlocked').isBoolean({ strict: true }).withMessage('isBlocked must be true or false')]),
  setBlocked
);

module.exports = router;
