const crypto = require('crypto');

/**
 * One-time tokens for email links (verify email, reset password).
 * The raw token goes in the email link; only its SHA-256 hash is saved in the
 * database, so a leaked database cannot be used to verify or reset accounts.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

// Returns { rawToken, hashedToken, expires }
function createEmailToken(validForMs) {
  const rawToken = crypto.randomBytes(32).toString('hex'); // 64 characters
  return {
    rawToken,
    hashedToken: hashToken(rawToken),
    expires: new Date(Date.now() + validForMs),
  };
}

module.exports = { hashToken, createEmailToken };
