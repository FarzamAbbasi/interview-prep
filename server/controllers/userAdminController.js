const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { getPaging, pagination } = require('../utils/questionFilters');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/admin/users   (IPP-1004, admin)
 *   ?search=ali (name or email) &filter=paid|free|blocked|unverified|admin &page=1 &limit=20
 * Newest first. Each user also has quizCount and lastQuizAt.
 */
async function listUsers(req, res) {
  const { page, limit, skip } = getPaging(req.query, 20, 100);
  const filter = {};

  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  switch (req.query.filter) {
    case 'paid':
      Object.assign(filter, { role: 'user', isPaid: true });
      break;
    case 'free':
      Object.assign(filter, { role: 'user', isPaid: false });
      break;
    case 'blocked':
      filter.isBlocked = true;
      break;
    case 'unverified':
      filter.isVerified = false;
      break;
    case 'admin':
      filter.role = 'admin';
      break;
    default:
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email role isPaid paidAt isVerified isBlocked createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Quiz count + last quiz for the users on this page
  const stats = await QuizAttempt.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, status: 'completed' } },
    { $group: { _id: '$user', quizCount: { $sum: 1 }, lastQuizAt: { $max: '$completedAt' } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));

  sendSuccess(res, {
    users: users.map((u) => ({
      ...u,
      quizCount: byUser.get(String(u._id))?.quizCount || 0,
      lastQuizAt: byUser.get(String(u._id))?.lastQuizAt || null,
    })),
    pagination: pagination(page, limit, total),
  });
}

/**
 * PUT /api/admin/users/:id/access   (IPP-502, admin)
 * Body: { isPaid: true | false }
 * Turns full access on/off by hand until online payment is added.
 */
async function setPaidAccess(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admins always have full access', 400);

  user.isPaid = req.body.isPaid;
  user.paidAt = req.body.isPaid ? user.paidAt || new Date() : undefined;
  await user.save();

  sendSuccess(
    res,
    { user },
    req.body.isPaid ? `Full access turned on for ${user.name}` : `Full access turned off for ${user.name}`
  );
}

/**
 * PUT /api/admin/users/:id/block   (IPP-1004, admin)
 * Body: { isBlocked: true | false }
 * A blocked user cannot log in, and requests with an old login token are refused.
 */
async function setBlocked(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'admin') throw new AppError('Admins cannot be blocked', 400);

  user.isBlocked = req.body.isBlocked;
  await user.save();

  sendSuccess(res, { user }, req.body.isBlocked ? `${user.name} is blocked` : `${user.name} is unblocked`);
}

module.exports = { listUsers, setPaidAccess, setBlocked };
