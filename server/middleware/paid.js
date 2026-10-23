const AppError = require('../utils/AppError');

// Use after protect: only paid users (and admins) can continue
function paidOnly(req, res, next) {
  if (req.user && (req.user.isPaid || req.user.role === 'admin')) return next();
  next(new AppError('This feature needs full access. Please upgrade your account', 403));
}

module.exports = { paidOnly };
