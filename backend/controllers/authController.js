const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendMail } = require('../utils/mailer');
const { isDevelopment } = require('../config/validateEnv');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
  REFRESH_MS,
  REFRESH_COOKIE,
} = require('../utils/generateToken');

// At most this many devices stay signed in at once; the oldest is dropped.
const MAX_SESSIONS = 10;

/**
 * A real bcrypt hash of a value nobody uses. When the email does not exist we
 * still compare against this, so a missing account and a wrong password take
 * the same amount of time and the endpoint cannot be used as an existence oracle.
 */
const DUMMY_HASH = bcrypt.hashSync('hostelwallet-timing-equaliser', 12);

/**
 * Issues both tokens and records the refresh token's hash against the user.
 * Expired entries are pruned on the way through.
 */
const issueSession = async (res, user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id, user.tokenVersion);

  const now = Date.now();
  const live = (user.refreshTokens || []).filter((t) => new Date(t.expiresAt).getTime() > now);
  live.push({
    tokenHash: hashToken(refreshToken),
    createdAt: new Date(),
    expiresAt: new Date(now + REFRESH_MS),
  });
  user.refreshTokens = live.slice(-MAX_SESSIONS);
  await user.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return accessToken;
};

/** Signs every device out by forgetting all stored refresh tokens. */
const revokeAllSessions = async (user) => {
  user.refreshTokens = [];
  user.tokenVersion += 1;
  await user.save({ validateBeforeSave: false });
};

/**
 * POST /api/auth/register
 * Creates the account and logs the student straight in.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, monthlyIncome, currency, university, hostelName } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name,
    email,
    password,
    monthlyIncome: monthlyIncome || 0,
    currency: currency || 'INR',
    university: university || '',
    hostelName: hostelName || '',
  });

  const accessToken = await issueSession(res, user);

  res.status(201).json({
    success: true,
    message: `Welcome to HostelWallet, ${user.name.split(' ')[0]}!`,
    data: { user: user.toJSON(), accessToken },
  });
});

/**
 * POST /api/auth/login
 * The password field is `select: false`, so it has to be requested explicitly.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Same message AND the same amount of work for "no such user" and "wrong
  // password": comparing against a dummy hash when the account is missing keeps
  // the response time flat, so this cannot be used to discover which emails are
  // registered.
  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH);

  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = await issueSession(res, user);

  res.json({
    success: true,
    message: `Welcome back, ${user.name.split(' ')[0]}!`,
    data: { user: user.toJSON(), accessToken },
  });
});

/**
 * POST /api/auth/refresh
 * Reads the httpOnly cookie and mints a fresh access token. The refresh token
 * is rotated on every use.
 */
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Refresh token expired, please log in again');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account not found');

  // tokenVersion is bumped on password change / reset.
  if (payload.v !== user.tokenVersion) {
    throw ApiError.unauthorized('Session is no longer valid, please log in again');
  }

  // Rotation: the presented token must be one we currently recognise. If it
  // verifies cryptographically but is NOT in the store it was already rotated,
  // which means someone replayed an old token - most likely a stolen cookie.
  // The safe response is to drop every session for this account.
  const presented = hashToken(token);
  const known = (user.refreshTokens || []).some((t) => t.tokenHash === presented);

  if (!known) {
    console.warn(`[security] refresh token replay for user ${user._id}; revoking all sessions`);
    await revokeAllSessions(user);
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    throw ApiError.unauthorized('This session is no longer valid, please log in again');
  }

  // Consume the presented token, then hand out a fresh one.
  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== presented);

  const accessToken = await issueSession(res, user);
  res.json({ success: true, data: { user: user.toJSON(), accessToken } });
});

/**
 * POST /api/auth/logout
 * Clearing the cookie only affects this browser, so the token is also removed
 * from the server-side store - otherwise a copy of the cookie would stay valid
 * for the full 30 days after "logging out".
 */
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies ? req.cookies[REFRESH_COOKIE] : null;

  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      const user = await User.findById(payload.sub);
      if (user) {
        const presented = hashToken(token);
        user.refreshTokens = (user.refreshTokens || []).filter((t) => t.tokenHash !== presented);
        await user.save({ validateBeforeSave: false });
      }
    } catch {
      // An expired or forged cookie needs no clean-up; just clear it below.
    }
  }

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ success: true, message: 'Logged out' });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
});

/**
 * POST /api/auth/forgot-password
 * Always answers 200 so the endpoint cannot be used to enumerate accounts.
 * In development the raw token is echoed back to make testing painless.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  const genericResponse = {
    success: true,
    message: 'If that email is registered, a password reset link is on its way.',
  };

  if (!user) return res.json(genericResponse);

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your HostelWallet password',
    text: [
      `Hi ${user.name},`,
      '',
      'Use the link below to set a new password. It expires in 30 minutes.',
      resetUrl,
      '',
      'If you did not ask for this, you can safely ignore this email.',
    ].join('\n'),
  });

  res.json({
    ...genericResponse,
    // Returning the raw token is an account-takeover primitive, so it needs an
    // explicit opt-in AND local development - "NODE_ENV is not production" is
    // not good enough, because an unset NODE_ENV would satisfy it.
    ...(isDevelopment() && process.env.ALLOW_DEV_RESET_LINK === 'true'
      ? { devResetToken: rawToken, devResetUrl: resetUrl }
      : {}),
  });
});

/** POST /api/auth/reset-password/:token */
const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.tokenVersion += 1;   // invalidate every existing session
  user.refreshTokens = [];  // and forget every stored refresh token
  await user.save();

  const accessToken = await issueSession(res, user);
  res.json({
    success: true,
    message: 'Password updated. You are logged in.',
    data: { user: user.toJSON(), accessToken },
  });
});

/** PUT /api/auth/change-password (Settings page) */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is not correct');
  }

  user.password = newPassword;
  user.tokenVersion += 1;   // log every other device out
  user.refreshTokens = [];  // including their stored refresh tokens
  await user.save();

  const accessToken = await issueSession(res, user);
  res.json({ success: true, message: 'Password changed', data: { accessToken } });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
};
