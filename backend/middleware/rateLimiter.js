const rateLimit = require('express-rate-limit');

const message = (msg) => ({ success: false, message: msg });

/**
 * Brute-force protection for login / register / password reset.
 * 20 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Too many attempts. Please try again in 15 minutes.'),
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * The AI routes cost real money per call, so they get a tighter budget:
 * 30 requests per hour per authenticated user (falls back to IP).
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
  message: message('You have reached the hourly AI limit. Try again a bit later.'),
  skip: () => process.env.NODE_ENV === 'test',
});

/** Broad safety net for the rest of the API. */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Too many requests. Please slow down.'),
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authLimiter, aiLimiter, globalLimiter };
