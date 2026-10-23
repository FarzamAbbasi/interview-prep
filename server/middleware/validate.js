const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Wrap express-validator rules for a route:
 *
 *   router.post('/register', validate([
 *     body('email').isEmail().withMessage('Valid email is required'),
 *   ]), controller);
 *
 * If any rule fails, responds 400 with a list of { field, message }.
 */
function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) return next();
      const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
      next(new AppError(errors[0].message, 400, errors));
    },
  ];
}

module.exports = validate;
