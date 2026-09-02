const usersRepo = require('../db/users');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/generateToken');

/**
 * Verifies the `Authorization: Bearer <accessToken>` header and attaches the
 * user record to `req.user`. Every route below /api that touches user data
 * must sit behind this.
 */
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw ApiError.unauthorized('No token provided. Please log in.');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // Distinguish expiry so the frontend interceptor knows to hit /refresh.
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Session expired');
    throw ApiError.unauthorized('Invalid token');
  }

  if (payload.type !== 'access') throw ApiError.unauthorized('Invalid token type');

  const user = await usersRepo.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('This account no longer exists');

  req.user = user;
  next();
});

module.exports = { protect };
