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
const connectDB = require('../../apps/api/src/infrastructure/database/connect');
const { query, closePool } = require('../../apps/api/src/infrastructure/database/pool');
const usersRepo = require('../../apps/api/src/modules/users/users.repository');
const expensesRepo = require('../../apps/api/src/modules/expenses/expenses.repository');
const incomeRepo = require('../../apps/api/src/modules/income/income.repository');
const goalsRepo = require('../../apps/api/src/modules/goals/goals.repository');
const budgetsRepo = require('../../apps/api/src/modules/budgets/budgets.repository');

const DEMO_EMAIL = 'demo@hostelwallet.app';

// [category, minAmount, maxAmount, howManyPerMonth, sampleDescriptions]
const PATTERN = [
  ['Mess/Food', 120, 500, 14, ['Canteen chai and paratha', 'Dhaba lunch with friends', 'Late night roll', 'Samosa and drink', 'Biryani outside']],
  ['Travel', 80, 900, 4, ['Rickshaw to campus', 'Careem to the bus stand', 'Daewoo ticket home', 'Shared van fare']],
  ['Mobile/Internet', 600, 1800, 1, ['Monthly internet package', 'Mobile load']],
  ['Books & Stationery', 150, 1200, 2, ['Photocopies of notes', 'Lab file and register', 'Used book from a senior']],
  ['Entertainment', 300, 1000, 3, ['Cricket match with friends', 'Cinema ticket', 'Birthday treat', 'Game top-up']],
  ['Health', 250, 1500, 1, ['Medicines from the pharmacy', 'Doctor visit']],
  ['Personal Care', 200, 1200, 2, ['Salon visit', 'Barber', 'Toiletries and skincare', 'Tailoring']],
  ['Misc', 150, 1000, 2, ['Laundry', 'Printouts', 'Gift for a friend', 'Hostel deposit']],
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

  // Deleting the account takes its expenses, income, goals, budgets,
  // notifications and chat with it: every child table is ON DELETE CASCADE.
  const existing = await usersRepo.findByEmail(DEMO_EMAIL);
  if (existing) {
    await usersRepo.remove(existing._id);
    console.log('[seed] removed previous demo data');
  }

  const user = await usersRepo.create({
    name: 'Demo Student',
    email: DEMO_EMAIL,
    password: 'demo1234',
    monthlyIncome: 28000,
    currency: 'PKR',
    university: 'University of the Punjab, Lahore',
    hostelName: 'University Hostel, Block C',
  });
  await usersRepo.updateProfile(user._id, { onboardingCompleted: true });

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
  await expensesRepo.createMany(expenses);

  // Last month's hostel fee as a plain expense...
  await expensesRepo.create(user._id, {
    amount: 9000,
    category: 'Rent/Hostel Fee',
    description: 'Hostel mess and room fee',
    paymentMethod: 'Bank Transfer',
    date: new Date(last.y, last.m - 1, 3, 10, 0),
  });

  // ...and this month's as the live recurring template, which clones itself on
  // the 3rd of next month.
  await expensesRepo.create(user._id, {
    amount: 9000,
    category: 'Rent/Hostel Fee',
    description: 'Hostel mess and room fee',
    paymentMethod: 'Bank Transfer',
    date: new Date(thisMonth.y, thisMonth.m - 1, 3, 10, 0),
    isRecurring: true,
    recurringFrequency: 'monthly',
    nextRunAt: new Date(thisMonth.y, thisMonth.m, 3, 10),
  });

  // Midday, not midnight. These land on the 1st, and the app does its month
  // arithmetic in the server's local timezone while the row stores an instant -
  // so a midnight-on-the-1st row seeded from UTC+5 falls into the previous
  // month once the server reading it runs in UTC, and the month's income
  // silently goes missing. Noon survives a shift either way.
  for (const row of [
    { amount: 25000, source: 'Pocket Money', note: 'Sent from home', date: new Date(last.y, last.m - 1, 1, 12) },
    { amount: 25000, source: 'Pocket Money', note: 'Sent from home', date: new Date(thisMonth.y, thisMonth.m - 1, 1, 12) },
    { amount: 3000, source: 'Part-time Job', note: 'Weekend tuition', date: new Date(thisMonth.y, thisMonth.m - 1, 12, 12) },
  ]) {
    await incomeRepo.create(user._id, row);
  }

  // goalsRepo.create sets is_completed from the saved amount, so the fully
  // funded emergency fund comes out already marked done.
  for (const goal of [
    {
      title: 'Laptop for final year project',
      targetAmount: 120000,
      savedAmount: 28000,
      deadline: new Date(now.getFullYear(), now.getMonth() + 6, 1),
      icon: '💻',
      note: 'A used one is fine',
    },
    {
      title: 'Northern areas trip with friends',
      targetAmount: 25000,
      savedAmount: 9000,
      deadline: new Date(now.getFullYear(), now.getMonth() + 2, 15),
      icon: '🏖',
    },
    {
      title: 'Emergency fund',
      targetAmount: 10000,
      savedAmount: 10000,
      deadline: null,
      icon: '🛡',
    },
  ]) {
    await goalsRepo.create(user._id, goal);
  }

  await budgetsRepo.upsertMany(
    user._id,
    [
      ['Mess/Food', 6000],
      ['Rent/Hostel Fee', 9000],
      ['Travel', 1500],
      ['Books & Stationery', 1500],
      ['Mobile/Internet', 1500],
      ['Entertainment', 1500],
      ['Health', 1200],
      ['Personal Care', 1200],
      ['Misc', 1500],
    ].map(([category, limit]) => ({ category, limit })),
    thisMonth.m,
    thisMonth.y
  );

  const [{ n }] = await query(`SELECT count(*)::bigint AS n FROM expenses WHERE user_id = $1`, [
    user._id,
  ]);

  console.log('');
  console.log('  Demo data ready');
  console.log(`  email     ${DEMO_EMAIL}`);
  console.log('  password  demo1234');
  console.log(`  expenses  ${n}`);
  console.log('');

  await closePool();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[seed] failed:', err);
  await closePool().catch(() => {});
  process.exit(1);
});
