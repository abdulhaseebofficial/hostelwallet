/**
 * Sessions, credentials and password recovery.
 *
 * auth owns the refresh_tokens table and the token lifecycle. It does not own
 * accounts - users does - so every lookup goes through users.service rather
 * than reaching for that repository.
 *
 * Nothing here touches a cookie. The service hands back the refresh token and
 * the controller decides how it travels, which keeps the security rules
 * testable without an HTTP layer around them.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const authRepo = require('./auth.repository');
const users = require('../users/users.service');
const ApiError = require('../../shared/errors/ApiError');
const { sendMail } = require('../../infrastructure/email/mailer');
const { isDevelopment } = require('../../shared/config/validateEnv');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_MS,
} = require('./auth.tokens');

// At most this many devices stay signed in at once; the oldest is dropped.
const MAX_SESSIONS = 10;

const RESET_LINK_TTL_TEXT = '30 minutes';

/**
 * A real bcrypt hash of a value nobody uses. When the email does not exist we
 * still compare against this, so a missing account and a wrong password take
 * the same amount of time and the endpoint cannot be used as an existence
 * oracle.
 */
const DUMMY_HASH = bcrypt.hashSync('hostelwallet-timing-equaliser', 12);

/**
 * Issues both tokens and records the refresh token's hash against the user.
 * Expired entries are pruned by the repository on the way through.
 */
const issueSession = async (user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id, user.tokenVersion);

  await authRepo.addRefreshToken(
    user._id,
    hashToken(refreshToken),
    new Date(Date.now() + REFRESH_MS),
    MAX_SESSIONS
  );

  return { accessToken, refreshToken };
};

/* ---------------------------- registration -------------------------- */

const register = async (input) => {
  const { name, email, password, monthlyIncome, currency, university, hostelName } = input;

  const exists = await users.findByEmail(email);
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await users.createAccount({
    name,
    email,
    password,
    monthlyIncome: monthlyIncome || 0,
    currency: currency || 'INR',
    university: university || '',
    hostelName: hostelName || '',
  });

  const session = await issueSession(user);
  return { user: users.toPublic(user), ...session };
};

/* ------------------------------- login ------------------------------ */

const login = async (email, password) => {
  const user = await users.findCredentialsByEmail(email);

  // Same message AND the same amount of work for "no such user" and "wrong
  // password": comparing against a dummy hash when the account is missing
  // keeps the response time flat, so this cannot be used to discover which
  // emails are registered.
  const passwordMatches = user
    ? await users.comparePassword(password, user.password)
    : await bcrypt.compare(password, DUMMY_HASH);

  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const session = await issueSession(user);
  return { user: users.toPublic(user), ...session };
};

/* ------------------------------ refresh ----------------------------- */

/**
 * Mints a fresh access token and rotates the refresh token.
 *
 * A token that verifies cryptographically but is not in the store was already
 * rotated, which means someone replayed an old one - most likely a stolen
 * cookie. The safe response is to drop every session for the account, so the
 * error carries a flag telling the caller to clear the cookie as well.
 */
const refresh = async (token) => {
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Refresh token expired, please log in again');
  }

  const user = await users.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account not found');

  // tokenVersion is bumped on password change / reset.
  if (payload.v !== user.tokenVersion) {
    throw ApiError.unauthorized('Session is no longer valid, please log in again');
  }

  const presented = hashToken(token);
  const known = await authRepo.hasRefreshToken(user._id, presented);

  if (!known) {
    console.warn(`[security] refresh token replay for user ${user._id}; revoking all sessions`);
    await users.revokeAllSessions(user._id);
    const err = ApiError.unauthorized('This session is no longer valid, please log in again');
    err.clearRefreshCookie = true;
    throw err;
  }

  // Consume the presented token, then hand out a fresh one.
  await authRepo.removeRefreshToken(user._id, presented);

  const session = await issueSession(user);
  return { user: users.toPublic(user), ...session };
};

/* ------------------------------- logout ----------------------------- */

/**
 * Clearing the cookie only affects this browser, so the token is also removed
 * from the server-side store - otherwise a copy of the cookie would stay valid
 * for the full refresh window after "logging out".
 */
const logout = async (token) => {
  if (!token) return;
  try {
    const payload = verifyRefreshToken(token);
    await authRepo.removeRefreshToken(payload.sub, hashToken(token));
  } catch {
    // An expired or forged cookie needs no clean-up; the caller clears it.
  }
};

/* -------------------------- password recovery ----------------------- */

/**
 * Always reports the same thing, whether or not the email is registered, so
 * the endpoint cannot be used to enumerate accounts.
 *
 * Returns the raw token only for a developer who has explicitly opted in on a
 * development machine - it is an account-takeover primitive, so "NODE_ENV is
 * not production" is not good enough, because an unset NODE_ENV satisfies it.
 */
const forgotPassword = async (email) => {
  const user = await users.findByEmail(email);
  if (!user) return {};

  const rawToken = await users.createPasswordResetToken(user._id);

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your HostelWallet password',
    text: [
      `Hi ${user.name},`,
      '',
      `Use the link below to set a new password. It expires in ${RESET_LINK_TTL_TEXT}.`,
      resetUrl,
      '',
      'If you did not ask for this, you can safely ignore this email.',
    ].join('\n'),
  });

  if (isDevelopment() && process.env.ALLOW_DEV_RESET_LINK === 'true') {
    return { devResetToken: rawToken, devResetUrl: resetUrl };
  }
  return {};
};

const resetPassword = async (rawToken, newPassword) => {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  const found = await users.findByResetToken(hashed);
  if (!found) throw ApiError.badRequest('This reset link is invalid or has expired');

  // Clears the reset token, bumps the version and drops every stored session.
  const user = await users.setPassword(found._id, newPassword);

  const session = await issueSession(user);
  return { user: users.toPublic(user), ...session };
};

/** Settings page. Logs every other device out, including its refresh token. */
const changePassword = async (userId, currentPassword, newPassword) => {
  const current = await users.findById(userId, { withPassword: true });
  if (!(await users.comparePassword(currentPassword, current.password))) {
    throw ApiError.badRequest('Your current password is not correct');
  }

  const user = await users.setPassword(current._id, newPassword);
  const session = await issueSession(user);
  return { user: users.toPublic(user), ...session };
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
