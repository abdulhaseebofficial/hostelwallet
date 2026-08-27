/**
 * Demo data seeder.  `npm run seed`
 *
 * Creates (or resets) a demo student with two months of realistic hostel
 * spending, budgets and goals, so the dashboard and the AI advisor have
 * something to work with straight away. Amounts and descriptions are sized for
 * a university hostel in Pakistan.
 *
 *   email:    demo@hostelwallet.app
 *   password: demo1234
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const Goal = require('../models/Goal');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');
const ChatMessage = require('../models/ChatMessage');

const DEMO_EMAIL = 'demo@hostelwallet.app';

// [category, minAmount, maxAmount, howManyPerMonth, sampleDescriptions]
const PATTERN = [
  ['Mess/Food', 120, 500, 14, ['Canteen chai and paratha', 'Dhaba lunch with friends', 'Late night roll', 'Samosa and drink', 'Biryani outside']],
  ['Travel', 80, 900, 4, ['Rickshaw to campus', 'Careem to the bus stand', 'Daewoo ticket home', 'Shared van fare']],
  ['Mobile/Internet', 600, 1800, 1, ['Monthly internet package', 'Mobile load']],
  ['Books & Stationery', 150, 1200, 2, ['Photocopies of notes', 'Lab file and register', 'Used book from a senior']],
  ['Entertainment', 300, 1000, 3, ['Cricket match with friends', 'Cinema ticket', 'Birthday treat', 'Game top-up']],
  ['Health', 250, 1500, 1, ['Medicines from the pharmacy', 'Doctor visit']],
  ['Misc', 150, 1000, 3, ['Laundry', 'Haircut', 'Toiletries', 'Printouts']],
];

const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const buildMonth = (userId, year, month) => {
  const rows = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const maxDay =
    year === new Date().getFullYear() && month === new Date().getMonth() + 1
      ? new Date().getDate()
      : daysInMonth;

  PATTERN.forEach(([category, min, max, perMonth, notes]) => {
    const count = Math.max(1, Math.round(perMonth * (maxDay / daysInMonth)));
    for (let i = 0; i < count; i += 1) {
      rows.push({
        userId,
        amount: rand(min, max),
        category,
        description: pick(notes),
        paymentMethod: pick(['Cash', 'Cash', 'JazzCash', 'Easypaisa', 'Card']),
        date: new Date(year, month - 1, rand(1, maxDay), rand(8, 22), rand(0, 59)),
      });
    }
  });

  // The fixed hostel fee is NOT added here - it is created once per month by
  // the caller, so the recurring template does not double-count this month.
  return rows;
};

const run = async () => {
  await connectDB();

  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const userId = existing._id;
    await Promise.all([
      Expense.deleteMany({ userId }),
      Income.deleteMany({ userId }),
      Goal.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      ChatMessage.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });
    console.log('[seed] removed previous demo data');
  }

  const user = await User.create({
    name: 'Demo Student',
    email: DEMO_EMAIL,
    password: 'demo1234',
    monthlyIncome: 28000,
    currency: 'PKR',
    university: 'University of the Punjab, Lahore',
    hostelName: 'Iqbal Hostel, Block C',
    onboardingCompleted: true,
  });

  const now = new Date();
  const thisMonth = { y: now.getFullYear(), m: now.getMonth() + 1 };
  const last =
    now.getMonth() === 0
      ? { y: now.getFullYear() - 1, m: 12 }
      : { y: now.getFullYear(), m: now.getMonth() };

  const expenses = [
    ...buildMonth(user._id, last.y, last.m),
    ...buildMonth(user._id, thisMonth.y, thisMonth.m),
  ];
  await Expense.insertMany(expenses);

  // Last month's hostel fee as a plain expense...
  await Expense.create({
    userId: user._id,
    amount: 9000,
    category: 'Rent/Hostel Fee',
    description: 'Hostel mess and room fee',
    paymentMethod: 'Bank Transfer',
    date: new Date(last.y, last.m - 1, 3, 10, 0),
  });

  // ...and this month's as the live recurring template, which clones itself on
  // the 3rd of next month.
  await Expense.create({
    userId: user._id,
    amount: 9000,
    category: 'Rent/Hostel Fee',
    description: 'Hostel mess and room fee',
    paymentMethod: 'Bank Transfer',
    date: new Date(thisMonth.y, thisMonth.m - 1, 3, 10, 0),
    isRecurring: true,
    recurringFrequency: 'monthly',
    nextRunAt: new Date(thisMonth.y, thisMonth.m, 3),
  });

  await Income.insertMany([
    { userId: user._id, amount: 25000, source: 'Pocket Money', note: 'Sent from home', date: new Date(last.y, last.m - 1, 1) },
    { userId: user._id, amount: 25000, source: 'Pocket Money', note: 'Sent from home', date: new Date(thisMonth.y, thisMonth.m - 1, 1) },
    { userId: user._id, amount: 3000, source: 'Part-time Job', note: 'Weekend tuition', date: new Date(thisMonth.y, thisMonth.m - 1, 12) },
  ]);

  // Created one by one rather than with insertMany: the pre('save') hook is what
  // flips isCompleted, and insertMany skips it (the emergency fund is fully funded).
  await Goal.create([
    {
      userId: user._id,
      title: 'Laptop for final year project',
      targetAmount: 120000,
      savedAmount: 28000,
      deadline: new Date(now.getFullYear(), now.getMonth() + 6, 1),
      icon: '\uD83D\uDCBB',
      note: 'A used one is fine',
    },
    {
      userId: user._id,
      title: 'Northern areas trip with friends',
      targetAmount: 25000,
      savedAmount: 9000,
      deadline: new Date(now.getFullYear(), now.getMonth() + 2, 15),
      icon: '\uD83C\uDFD6',
    },
    {
      userId: user._id,
      title: 'Emergency fund',
      targetAmount: 10000,
      savedAmount: 10000,
      deadline: null,
      icon: '\uD83D\uDEE1',
    },
  ]);

  await Budget.insertMany(
    [
      ['Mess/Food', 6000],
      ['Rent/Hostel Fee', 9000],
      ['Travel', 1500],
      ['Books & Stationery', 1500],
      ['Mobile/Internet', 1500],
      ['Entertainment', 1500],
      ['Health', 1200],
      ['Misc', 1500],
    ].map(([category, limit]) => ({
      userId: user._id,
      category,
      limit,
      month: thisMonth.m,
      year: thisMonth.y,
    }))
  );

  console.log('');
  console.log('  Demo data ready');
  console.log(`  email     ${DEMO_EMAIL}`);
  console.log('  password  demo1234');
  console.log(`  expenses  ${expenses.length + 2}`);
  console.log('');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
