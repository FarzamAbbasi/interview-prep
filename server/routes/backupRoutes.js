const express = require('express');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { exportBackup, importBackup } = require('../controllers/backupController');

const router = express.Router();

// ---- IPP-1005: backup export / import (admin) ----
router.use(protect, adminOnly);
router.get('/export', exportBackup);
router.post('/import', importBackup);

module.exports = router;
