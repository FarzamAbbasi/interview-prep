const AppError = require('../utils/AppError');
const { hasAnyAccess } = require('../utils/access');

// Use after protect: only paid users (all or some languages, IPP-1704) and admins can continue
function paidOnly(req, res, next) {
  if (hasAnyAccess(req.user)) return next();
  next(new AppError('This feature needs full access. Please upgrade your account', 403));
}

module.exports = { paidOnly };
