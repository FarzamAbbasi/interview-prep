const express = require('express');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { getStats } = require('../controllers/adminStatsController');

const router = express.Router();

// ---- IPP-1001: admin dashboard numbers ----
router.get('/', protect, adminOnly, getStats);

module.exports = router;
