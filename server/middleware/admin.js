const AppError = require('../utils/AppError');

// Use after protect: only admins can continue
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  next(new AppError('Admin access only', 403));
}

module.exports = { adminOnly };
