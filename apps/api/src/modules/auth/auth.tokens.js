const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isProduction } = require('../../shared/config/validateEnv');

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

// Pinning the algorithm matters on VERIFY: without it, jsonwebtoken will accept
// any algorithm the token claims, which is how algorithm-confusion attacks work.
const ALGORITHM = 'HS256';

/** Short lived token sent to the browser and held in memory / localStorage. */
const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId), type: 'access' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
    algorithm: ALGORITHM,
  });

/**
 * Long lived token, stored in an httpOnly cookie so JavaScript cannot read it.
 * `jti` makes every issued token unique even within the same second, which is
 * what allows rotation and reuse detection to tell two tokens apart.
 */
const signRefreshToken = (userId, tokenVersion = 0) =>
  jwt.sign(
    { sub: String(userId), type: 'refresh', v: tokenVersion, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES, algorithm: ALGORITHM }
  );

const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM] });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: [ALGORITHM] });

/**
 * Only the hash of a refresh token is stored, exactly like a password: a leaked
 * database dump must not hand over usable sessions.
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Cookie options shared by login / refresh / logout so they always match. */
const refreshCookieOptions = () => {
  const prod = isProduction();
  return {
    httpOnly: true,
    secure: prod, // HTTPS only outside local development
    sameSite: prod ? 'none' : 'lax', // 'none' lets Vercel talk to Render
    path: '/api/auth',
    maxAge: REFRESH_MS,
  };
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  refreshCookieOptions,
  REFRESH_MS,
  REFRESH_COOKIE: 'hw_refresh',
};
