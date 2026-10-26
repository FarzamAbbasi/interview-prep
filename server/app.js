const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Render sits behind a proxy; this lets rate limiting see the real user IP.
// Check on live: GET /api/health shows "ip" = your own IP. Render (Cloudflare + proxy) needs TRUST_PROXY=3.
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
// JSON bodies: 1 MB normally, 10 MB only for backup import (a file with many questions)
const smallJson = express.json({ limit: '1mb' });
const largeJson = express.json({ limit: '10mb' });
app.use((req, res, next) => (req.path.startsWith('/api/admin/backup') ? largeJson : smallJson)(req, res, next));

app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running', data: { ip: req.ip } });
});

// ---- API routes (added ticket by ticket) ----
app.use('/api/auth', require('./routes/authRoutes')); // IPP-303 / 304 / 305
app.use('/api/languages', require('./routes/languageRoutes')); // IPP-401
app.use('/api/questions', require('./routes/questionRoutes')); // IPP-403
app.use('/api/admin/questions', require('./routes/questionAdminRoutes')); // IPP-402 / 403
app.use('/api/quiz', require('./routes/quizRoutes')); // IPP-501 / 502
app.use('/api/bookmarks', require('./routes/bookmarkRoutes')); // IPP-502
app.use('/api/admin/users', require('./routes/userAdminRoutes')); // IPP-502 / 1004
app.use('/api/admin/stats', require('./routes/adminStatsRoutes')); // IPP-1001
app.use('/api/admin/backup', require('./routes/backupRoutes')); // IPP-1005
app.use('/api/progress', require('./routes/progressRoutes')); // IPP-1601

if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', require('./routes/devRoutes')); // IPP-302 test routes
}

// Must stay last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
