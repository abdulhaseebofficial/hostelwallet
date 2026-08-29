const rateLimit = require('express-rate-limit');
const { isProduction } = require('../config/validateEnv');

const message = (msg) => ({ success: false, message: msg });

/**
 * Limits are strict in production and generous in local development.
 *
 * The point of these limits is to stop brute force coming from the internet.
 * A dev server on localhost has no such exposure, and a strict cap there only
 * breaks legitimate work: the QA suite alone makes well over twenty auth calls.
 * `isProduction()` is default-deny, so an unset NODE_ENV still gets the strict
 * numbers - development has to be opted into explicitly.
 */
const forEnv = (strict, relaxed) => (isProduction() ? strict : relaxed);

/**
 * Brute-force protection for login / register / password reset.
 * 20 attempts per 15 minutes per IP in production.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: forEnv(20, 300),
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
  max: forEnv(30, 300),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
  message: message('You have reached the hourly AI limit. Try again a bit later.'),
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Feedback writes a row and attempts an e-mail, so it is worth more to a
 * spammer than a read: 10 submissions per hour per authenticated user.
 */
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
  message: message('That is a lot of feedback for one hour. Please try again later.'),
  skip: () => process.env.NODE_ENV === 'test',
});

/** Broad safety net for the rest of the API. */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: forEnv(600, 5000),
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Too many requests. Please slow down.'),
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authLimiter, aiLimiter, feedbackLimiter, globalLimiter };
