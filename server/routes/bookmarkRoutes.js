const express = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { paidOnly } = require('../middleware/paid');
const { toggleBookmark, getBookmarks } = require('../controllers/bookmarkController');

const router = express.Router();

// ---- IPP-502: bookmarks are a paid feature ----
router.use(protect, paidOnly);

router.get('/', getBookmarks);
router.post('/:questionId', validate([param('questionId').isMongoId().withMessage('Invalid question id')]), toggleBookmark);

module.exports = router;
