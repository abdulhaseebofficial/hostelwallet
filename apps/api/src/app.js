/**
 * Builds the Express application.
 *
 * Construction only: this module opens no sockets and starts no timers, so it
 * can be required by a test, by server.js, or by Vercel without any of them
 * getting a side effect they did not ask for. Runtime startup lives in
 * ../server.js.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const connectDB = require('./infrastructure/database/connect');
const { isConnected } = require('./infrastructure/database/pool');
const mailer = require('./infrastructure/email/mailer');
const advisor = require('./modules/advisor/advisor.service');
const { validateEnv, isProduction } = require('./shared/config/validateEnv');
const sanitizeRequest = require('./shared/middleware/sanitize');
const { notFound, errorHandler } = require('./shared/middleware/errorHandler');
const { globalLimiter } = require('./shared/middleware/rateLimiter');
const registerRoutes = require('./routes');
const notificationSubscriptions = require('./modules/notifications/notifications.subscriptions');
const {
  DEFAULT_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  RECURRING_FREQUENCIES,
  CURRENCIES,
} = require('./shared/constants');

/**
 * The origins CORS will accept, from CLIENT_URL plus the deployment's own URL.
 *
 * On Vercel the frontend and this API answer on one domain, so the deployment's
 * own URL is same-origin traffic that still arrives with an Origin header.
 * Including it keeps every deploy from depending on CLIENT_URL being updated by
 * hand.
 */
const allowedOrigins = () => {
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
    .filter(Boolean)
    .forEach((host) => origins.push(`https://${host}`));

  return origins;
};

/**
 * Opens the database once per process, on the first request that needs it.
 *
 * Vercel imports this module and drives the app itself, so nothing would ever
 * call a start function and the connection would never open. Gating the data
 * routes on a memoized bootstrap means the first request pays for it and every
 * later invocation on the same instance reuses the connection.
 */
const createBootstrap = () => {
  let booted = null;
  return () => {
    if (!booted) {
      booted = (async () => {
        validateEnv(); // refuse to serve on a weak or missing signing key
        await connectDB();
      })().catch((err) => {
        booted = null; // one failed boot must not poison every later request
        throw err;
      });
    }
    return booted;
  };
};

const createApp = () => {
  const app = express();
  const origins = allowedOrigins();

  // Notifications reacts to what expenses and goals announce. Subscribing here
  // rather than at import time means requiring a module never has an opinion
  // about the bus, and a test can build an app without inheriting listeners
  // from the last one.
  notificationSubscriptions.register();

  /* ------------------------ security & parsing ---------------------- */

  /**
   * Only trust a proxy where there actually is one. Trusting X-Forwarded-For
   * unconditionally lets any client spoof its IP and walk straight past the
   * per-IP rate limit on the auth routes.
   * Set TRUST_PROXY to the number of proxies in front of the app if the
   * default (1 in production, none in development) is wrong for your host.
   */
  app.set(
    'trust proxy',
    process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : isProduction() ? 1 : false
  );

  app.use(helmet());

  // The frontend can run on a different origin, so CORS must allow credentials
  // for the httpOnly refresh cookie to travel.
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin requests and tools like curl send no Origin header.
        if (!origin || origins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  // Strip operator-shaped keys before anything can forward them into a query.
  app.use(sanitizeRequest);

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.use('/api', globalLimiter);

  /* ---------------------------- status ------------------------------ */

  app.get('/', (_req, res) => {
    res.json({
      name: 'HostelWallet API',
      version: '1.0.0',
      docs: '/api/health for status, see README.md for the endpoint list',
    });
  });

  /**
   * Deliberately above the bootstrap gate, so a health check still answers
   * (reporting `database: disconnected`) when the database is unreachable.
   */
  app.get('/api/health', async (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      uptime: Math.round(process.uptime()),
      database: (await isConnected()) ? 'connected' : 'disconnected',
      ai: advisor.isConfigured() ? `configured (${advisor.providerName()})` : 'fallback mode',
      // Surfaced because a deployment with no SMTP silently cannot deliver a
      // password reset, and nothing else makes that visible until a student is
      // locked out of their account.
      mail: mailer.isConfigured() ? 'configured' : 'not configured',
      timestamp: new Date().toISOString(),
    });
  });

  /** Shared vocabulary, so the frontend never hardcodes a category list. */
  app.get('/api/meta', (_req, res) => {
    res.json({
      success: true,
      data: {
        categories: DEFAULT_CATEGORIES,
        paymentMethods: PAYMENT_METHODS,
        incomeSources: INCOME_SOURCES,
        recurringFrequencies: RECURRING_FREQUENCIES,
        currencies: CURRENCIES,
      },
    });
  });

  /* ---------------------------- features ---------------------------- */

  const bootstrap = createBootstrap();
  app.bootstrap = bootstrap; // server.js awaits this before it starts listening

  app.use('/api', (_req, _res, next) => {
    bootstrap().then(() => next(), next);
  });

  registerRoutes(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
