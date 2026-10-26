const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Read "Authorization: Bearer <token>" from the request
function getToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

// Find the user for a decoded token. Returns null if the token was issued
// before the last password reset (e.g. someone else had logged in).
async function findTokenUser(decoded) {
  const user = await User.findById(decoded.id).select('+passwordChangedAt');
  if (!user) return null;
  if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return 'expired';
  }
  return user;
}

// IPP-1703: "last seen" for the admin user panel. Saved at most once an hour, never blocks the request.
const SEEN_EVERY_MS = 60 * 60 * 1000;
function touchLastSeen(user) {
  if (user.lastSeenAt && Date.now() - user.lastSeenAt.getTime() < SEEN_EVERY_MS) return;
  User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } })
    .exec()
    .catch(() => {});
}

/**
 * protect: route needs a logged-in user.
 * Adds the user to req.user. Blocked users are refused.
 */
async function protect(req, res, next) {
  const token = getToken(req);
  if (!token) throw new AppError('Please log in to continue', 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws if invalid/expired
  const user = await findTokenUser(decoded);

  if (!user) throw new AppError('Account not found. Please log in again', 401);
  if (user === 'expired') {
    throw new AppError('Your password was changed. Please log in again', 401);
  }
  if (user.isBlocked) {
    throw new AppError('Your account has been blocked. Please contact support', 403, undefined, 'ACCOUNT_BLOCKED');
  }

  req.user = user;
  touchLastSeen(user);
  next();
}

/**
 * optionalAuth: works for guests AND logged-in users.
 * Used where content changes by user (e.g. locked answers).
 * A missing or bad token simply means "guest".
 */
async function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findTokenUser(decoded);
    if (user && user !== 'expired' && !user.isBlocked) {
      req.user = user;
      touchLastSeen(user);
    }
  } catch {
    // treat as guest
  }
  next();
}

module.exports = { protect, optionalAuth };
