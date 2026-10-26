const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { listUsers, getUserDetails, setPaidAccess, setBlocked } = require('../controllers/userAdminController');

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

// ---- IPP-1703: one user's study progress + quiz performance ----
router.get('/:id/details', validate([idRule]), getUserDetails);

// ---- IPP-502 / IPP-1704: manual paid access (all languages, some languages or none) ----
router.put(
  '/:id/access',
  validate([
    idRule,
    body('access').optional().isIn(['all', 'some', 'none']).withMessage('access must be all, some or none'),
    body('isPaid')
      .if(body('access').not().exists())
      .isBoolean({ strict: true })
      .withMessage('Send access (all, some or none)'),
    body('languages')
      .if(body('access').equals('some'))
      .isArray({ min: 1, max: 100 })
      .withMessage('Pick at least one language'),
    body('languages.*').optional().isMongoId().withMessage('Invalid language id'),
  ]),
  setPaidAccess
);

// ---- IPP-1004: block / unblock ----
router.put(
  '/:id/block',
  validate([idRule, body('isBlocked').isBoolean({ strict: true }).withMessage('isBlocked must be true or false')]),
  setBlocked
);

module.exports = router;
