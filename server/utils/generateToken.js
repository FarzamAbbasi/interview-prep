const jwt = require('jsonwebtoken');

// Login token (JWT). Holds only the user id; valid for 7 days by default.
function generateToken(userId) {
  return jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = generateToken;
