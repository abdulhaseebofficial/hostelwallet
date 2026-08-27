/**
 * Shared, app-wide constants. Kept in one place so models, validators and the
 * AI prompts all agree on the same vocabulary.
 */

// Default spending categories tuned for Indian hostel life.
const DEFAULT_CATEGORIES = [
  'Mess/Food',
  'Rent/Hostel Fee',
  'Books & Stationery',
  'Travel',
  'Mobile/Internet',
  'Entertainment',
  'Health',
  // Covers what every hostel student spends on regardless of who they are:
  // salon or barber, toiletries, laundry supplies, tailoring, skincare.
  'Personal Care',
  'Misc',
];

// How a hostel student in Pakistan actually pays for things.
const PAYMENT_METHODS = ['Cash', 'JazzCash', 'Easypaisa', 'Bank Transfer', 'Card', 'Raast'];

const INCOME_SOURCES = ['Pocket Money', 'Part-time Job', 'Scholarship', 'Freelance', 'Gift', 'Other'];

const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly'];

const CURRENCIES = [
  { code: 'PKR', symbol: 'Rs', label: 'Pakistani Rupee' },
  { code: 'INR', symbol: '\u20B9', label: 'Indian Rupee' },
  { code: 'BDT', symbol: '\u09F3', label: 'Bangladeshi Taka' },
  { code: 'AED', symbol: '\u062F.\u0625', label: 'UAE Dirham' },
  { code: 'SAR', symbol: '\uFDFC', label: 'Saudi Riyal' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '\u00A3', label: 'British Pound' },
  { code: 'EUR', symbol: '\u20AC', label: 'Euro' },
];

const NOTIFICATION_TYPES = ['overspend', 'goal_deadline', 'log_reminder', 'bill_due', 'goal_completed', 'info'];

// A sensible starting split used when the AI is unavailable (percent of income).
const FALLBACK_BUDGET_SPLIT = {
  'Mess/Food': 0.28,
  'Rent/Hostel Fee': 0.28,
  'Books & Stationery': 0.07,
  Travel: 0.07,
  'Mobile/Internet': 0.05,
  Entertainment: 0.08,
  Health: 0.04,
  'Personal Care': 0.05,
  Misc: 0.08,
};

/**
 * Who the app is by, and where feedback goes. Kept here so the address and
 * profile live in exactly one place on the server.
 */
const DEVELOPER = {
  name: 'Abdul Haseeb',
  email: 'abdul.haseeb.kashmiri@outlook.com',
  linkedin: 'https://www.linkedin.com/in/abdulhaseebkashmiri/',
};

/** What a piece of feedback is about. */
const FEEDBACK_TYPES = ['General', 'Bug', 'Feature request', 'Design', 'Praise'];

module.exports = {
  DEFAULT_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  RECURRING_FREQUENCIES,
  CURRENCIES,
  NOTIFICATION_TYPES,
  FALLBACK_BUDGET_SPLIT,
  DEVELOPER,
  FEEDBACK_TYPES,
};
