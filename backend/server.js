/**
 * HostelWallet API server.
 *
 * Boot order matters: env vars first (everything else reads process.env at
 * require time), then the DB, then the HTTP listener, then the cron jobs.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');

const connectDB = require('./config/db');
const { validateEnv, isProduction } = require('./config/validateEnv');
const sanitizeRequest = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const {
  DEFAULT_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  RECURRING_FREQUENCIES,
  CURRENCIES,
} = require('./config/constants');

const app = express();
const PORT = process.env.PORT || 5000;

/* --------------------------- security & parsing --------------------- */

/**
 * Only trust a proxy where there actually is one. Trusting X-Forwarded-For
 * unconditionally lets any client spoof its IP and walk straight past the
 * per-IP rate limit on the auth routes.
 * Set TRUST_PROXY to the number of proxies in front of the app if the default
 * (1 in production, none in development) is wrong for your host.
 */
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : isProduction() ? 1 : false);

app.use(helmet());

// The frontend runs on a different origin, so CORS must allow credentials for
// the httpOnly refresh cookie to travel.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin requests and tools like curl send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Strip MongoDB operators before anything can forward them into a query.
app.use(sanitizeRequest);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use('/api', globalLimiter);

/* ------------------------------- routes ----------------------------- */

app.get('/', (_req, res) => {
  res.json({
    name: 'HostelWallet API',
    version: '1.0.0',
    docs: '/api/health for status, see README.md for the endpoint list',
  });
});

app.get('/api/health', (_req, res) => {
  const mongoose = require('mongoose');
  res.json({
    success: true,
    status: 'ok',
    uptime: Math.round(process.uptime()),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ai: Boolean(process.env.ANTHROPIC_API_KEY) ? 'configured' : 'fallback mode',
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

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/income', require('./routes/incomeRoutes'));
app.use('/api/goals', require('./routes/goalRoutes'));
app.use('/api/budget', require('./routes/budgetRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.use(notFound);
app.use(errorHandler);

/* ---------------------------- scheduled jobs ------------------------ */

/**
 * Two background jobs:
 *  - 00:05 daily: materialise recurring expenses (mess bill, hostel fee...).
 *  - 09:00 daily: refresh alerts (overspending, goal deadlines, bills due).
 * Both also run on demand when the student opens the app, so a sleeping free
 * tier dyno never means missed data.
 */
const startCronJobs = () => {
  const { materializeAll } = require('./services/recurringService');
  const { runChecksForUser } = require('./services/notificationService');
  const User = require('./models/User');

  cron.schedule('5 0 * * *', async () => {
    try {
      await materializeAll();
    } catch (err) {
      console.error('[cron] recurring expenses failed:', err.message);
    }
  });

  cron.schedule('0 9 * * *', async () => {
    try {
      const users = await User.find().select('_id currency name monthlyIncome');
      for (const user of users) {
        await runChecksForUser(user).catch(() => {});
      }
      console.log(`[cron] alert check finished for ${users.length} user(s)`);
    } catch (err) {
      console.error('[cron] alert check failed:', err.message);
    }
  });

  console.log('[cron] scheduled jobs registered');
};

/* ------------------------------- start-up --------------------------- */

let server;

const start = async () => {
  try {
    validateEnv(); // refuse to boot on a weak or missing signing key
    await connectDB();

    server = app.listen(PORT, () => {
      console.log('');
      console.log('  HostelWallet API');
      console.log(`  listening on   http://localhost:${PORT}`);
      console.log(`  environment    ${process.env.NODE_ENV || 'development'}`);
      console.log(`  cors origins   ${allowedOrigins.join(', ')}`);
      console.log(
        `  ai advisor     ${process.env.ANTHROPIC_API_KEY ? 'Claude - ' + require('./services/aiService').modelChain().join(' -> ') : 'fallback rules (set ANTHROPIC_API_KEY to enable Claude)'}`
      );
      console.log('');
    });

    if (process.env.NODE_ENV !== 'test') startCronJobs();
  } catch (err) {
    console.error('[startup] failed:', err.message);
    process.exit(1);
  }
};

/** Close the HTTP server before exiting so in-flight requests finish. */
const shutdown = (signal) => {
  console.log(`\n[shutdown] ${signal} received, closing server`);
  if (!server) process.exit(0);
  server.close(() => {
    require('mongoose').connection.close(false).finally(() => process.exit(0));
  });
  // Do not hang forever if a socket refuses to close.
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled promise rejection:', reason);
});

if (require.main === module) start();

module.exports = { app, start };
