const User = require('../models/User');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { sendEmail } = require('../utils/sendEmail');
const { verificationEmail, resetPasswordEmail } = require('../utils/emailTemplates');
const { hashToken, createEmailToken } = require('../utils/authTokens');
const generateToken = require('../utils/generateToken');

const VERIFY_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours (matches the email text)
const RESEND_COOLDOWN = 60 * 1000; // a user can ask for a new email once per minute
const RESET_TOKEN_TTL = 60 * 60 * 1000; // 1 hour (matches the email text)

/**
 * Create a fresh verification token on the user, save it, and email the link.
 * Returns true if the email was sent, false if sending failed.
 */
async function sendVerificationLink(user) {
  const { rawToken, hashedToken, expires } = createEmailToken(VERIFY_TOKEN_TTL);
  user.emailToken = hashedToken;
  user.emailTokenExpires = expires;
  await user.save();

  const link = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[dev] Verify link for ${user.email}: ${link}`);
  }

  try {
    await sendEmail({ to: user.email, ...verificationEmail({ name: user.name, link }) });
    return true;
  } catch (error) {
    console.error(`[email] Verification email to ${user.email} failed:`, error.message);
    return false;
  }
}

/**
 * POST /api/auth/register   (IPP-303)
 * Body: { name, email, password }
 * Creates an unverified account and emails a verification link.
 * No login token is given; the user logs in after verifying (IPP-304).
 */
async function register(req, res) {
  const { name, email, password } = req.body;

  let user = await User.findOne({ email });

  if (user && user.isVerified) {
    throw new AppError('This email is already registered. Please log in', 409);
  }

  if (user) {
    // Registered before but never verified (e.g. lost the email):
    // take the new details and send a fresh link
    user.name = name;
    user.password = password; // hashed again by the User model
  } else {
    user = new User({ name, email, password });
  }

  const emailSent = await sendVerificationLink(user);

  const message = emailSent
    ? 'Account created. Please check your email to verify your account'
    : 'Account created, but we could not send the verification email. Please use "Resend verification email"';

  sendSuccess(res, { user, emailSent }, message, 201);
}

/**
 * GET /api/auth/verify-email/:token   (IPP-303)
 * The frontend page /verify-email/:token calls this with the token from the link.
 * The link works once: the token is removed after use.
 */
async function verifyEmail(req, res) {
  const user = await User.findOneAndUpdate(
    { emailToken: hashToken(req.params.token), emailTokenExpires: { $gt: new Date() } },
    { $set: { isVerified: true }, $unset: { emailToken: 1, emailTokenExpires: 1 } },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw new AppError(
      'This verification link is invalid or has expired. Please request a new one',
      400
    );
  }

  sendSuccess(res, { email: user.email }, 'Email verified. You can now log in');
}

/**
 * POST /api/auth/resend-verification   (IPP-303)
 * Body: { email }
 * Always gives the same reply, so nobody can use it to check which emails are registered.
 */
async function resendVerification(req, res) {
  const genericMessage =
    'If this email is registered and not yet verified, a new verification link has been sent';

  const user = await User.findOne({ email: req.body.email }).select('+emailTokenExpires');

  if (user && !user.isVerified && !user.isBlocked) {
    // When was the last link sent? (expiry time minus 24h)
    const lastSentAt = user.emailTokenExpires
      ? user.emailTokenExpires.getTime() - VERIFY_TOKEN_TTL
      : 0;

    if (Date.now() - lastSentAt < RESEND_COOLDOWN) {
      throw new AppError('Please wait a minute before asking for another email', 429);
    }

    await sendVerificationLink(user);
  }

  sendSuccess(res, null, genericMessage);
}

/**
 * POST /api/auth/login   (IPP-304)
 * Body: { email, password }
 * Returns a JWT (valid 7 days) and the user.
 * The password is checked first, so account status is only revealed to the real owner.
 */
async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.isBlocked) {
    throw new AppError('Your account has been blocked. Please contact support', 403, undefined, 'ACCOUNT_BLOCKED');
  }

  if (!user.isVerified) {
    throw new AppError(
      'Please verify your email before logging in. Check your inbox or request a new link',
      403,
      undefined,
      'EMAIL_NOT_VERIFIED'
    );
  }

  const token = generateToken(user._id);
  sendSuccess(res, { token, user }, 'Logged in successfully');
}

/**
 * GET /api/auth/me   (IPP-304)
 * Needs "Authorization: Bearer <token>". Returns the logged-in user.
 * The frontend calls this on page load to restore the session.
 */
async function getMe(req, res) {
  sendSuccess(res, { user: req.user });
}

/**
 * POST /api/auth/forgot-password   (IPP-305)
 * Body: { email }
 * Emails a reset link valid for 1 hour. Always gives the same reply,
 * so nobody can use it to check which emails are registered.
 */
async function forgotPassword(req, res) {
  const genericMessage =
    'If this email is registered, a password reset link has been sent. Please check your inbox';

  const user = await User.findOne({ email: req.body.email }).select('+resetTokenExpires');

  if (user && !user.isBlocked) {
    const lastSentAt = user.resetTokenExpires
      ? user.resetTokenExpires.getTime() - RESET_TOKEN_TTL
      : 0;

    // Within 1 minute of the last email: quietly skip (same reply, no new email)
    if (Date.now() - lastSentAt >= RESEND_COOLDOWN) {
      const { rawToken, hashedToken, expires } = createEmailToken(RESET_TOKEN_TTL);
      user.resetToken = hashedToken;
      user.resetTokenExpires = expires;
      await user.save();

      const link = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[dev] Reset link for ${user.email}: ${link}`);
      }

      try {
        await sendEmail({ to: user.email, ...resetPasswordEmail({ name: user.name, link }) });
      } catch (error) {
        console.error(`[email] Reset email to ${user.email} failed:`, error.message);
      }
    }
  }

  sendSuccess(res, null, genericMessage);
}

/**
 * POST /api/auth/reset-password/:token   (IPP-305)
 * Body: { password }
 * The frontend page /reset-password/:token calls this with the token from the link.
 * Sets the new password; the link works once. The user then logs in normally.
 */
async function resetPassword(req, res) {
  const user = await User.findOne({
    resetToken: hashToken(req.params.token),
    resetTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError('This reset link is invalid or has expired. Please request a new one', 400);
  }

  user.password = req.body.password; // hashed by the User model
  user.passwordChangedAt = new Date(); // old login tokens stop working
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;

  // Opening the link proves the inbox belongs to them, so the email counts as verified
  if (!user.isVerified) {
    user.isVerified = true;
    user.emailToken = undefined;
    user.emailTokenExpires = undefined;
  }

  await user.save();

  sendSuccess(res, null, 'Password changed. Please log in with your new password');
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  getMe,
  forgotPassword,
  resetPassword,
};
