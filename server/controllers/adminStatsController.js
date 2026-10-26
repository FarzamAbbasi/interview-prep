const User = require('../models/User');
const Language = require('../models/Language');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const { sendSuccess } = require('../utils/apiResponse');
const { getLastFullBackup } = require('../utils/backupLog');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/admin/stats   (IPP-1001, admin)
 * Counts for the admin dashboard, plus the latest sign-ups and the last full backup (IPP-1008).
 */
async function getStats(req, res) {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const users = { role: 'user' };

  const [
    totalUsers,
    paidUsers,
    unverifiedUsers,
    blockedUsers,
    newUsersThisWeek,
    languages,
    activeLanguages,
    questionCounts,
    totalAttempts,
    attemptsThisWeek,
    recentUsers,
    lastBackup,
  ] = await Promise.all([
    User.countDocuments(users),
    User.countDocuments({ ...users, isPaid: true }),
    User.countDocuments({ ...users, isVerified: false }),
    User.countDocuments({ ...users, isBlocked: true }),
    User.countDocuments({ ...users, createdAt: { $gte: weekAgo } }),
    Language.countDocuments(),
    Language.countDocuments({ isActive: true }),
    Question.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          qa: { $sum: { $cond: [{ $eq: ['$type', 'qa'] }, 1, 0] } },
          mcq: { $sum: { $cond: [{ $eq: ['$type', 'mcq'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
        },
      },
    ]),
    QuizAttempt.countDocuments({ status: 'completed' }),
    QuizAttempt.countDocuments({ status: 'completed', completedAt: { $gte: weekAgo } }),
    User.find(users).select('name email isPaid accessScope paidLanguages isVerified createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    getLastFullBackup(),
  ]);

  const q = questionCounts[0] || { total: 0, qa: 0, mcq: 0, inactive: 0 };

  sendSuccess(res, {
    users: { total: totalUsers, paid: paidUsers, unverified: unverifiedUsers, blocked: blockedUsers, newThisWeek: newUsersThisWeek },
    languages: { total: languages, active: activeLanguages },
    questions: { total: q.total, qa: q.qa, mcq: q.mcq, inactive: q.inactive },
    quizzes: { total: totalAttempts, thisWeek: attemptsThisWeek },
    recentUsers,
    lastBackup,
  });
}

module.exports = { getStats };
