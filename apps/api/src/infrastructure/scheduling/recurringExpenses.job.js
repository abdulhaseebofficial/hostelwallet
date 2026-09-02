/**
 * recurringService — turns recurring expense templates into real expenses.
 *
 * A recurring expense (e.g. the monthly mess bill) is stored as an ordinary
 * expense with `isRecurring: true` and a `nextRunAt` date. When that date
 * passes we clone the template into a new expense and move `nextRunAt`
 * forward. Cloning is idempotent: the loop always advances the pointer, so
 * running it twice in a row cannot create a duplicate.
 */

const expensesRepo = require('../../modules/expenses/expenses.repository');

/** Next occurrence after `date` for a given frequency. */
const advance = (date, frequency) => {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1); // monthly (default)
  return next;
};

/** First run date for a brand new recurring template. */
const firstRunAfter = (date, frequency) => advance(date, frequency);

/**
 * Materialise every due occurrence for one user.
 * Returns the number of expenses created.
 */
const materializeForUser = async (userId, now = new Date()) => {
  const templates = await expensesRepo.findDue(userId);

  let created = 0;

  for (const template of templates) {
    // Cap the catch-up so a template untouched for years cannot flood the DB.
    let guard = 0;
    let pointer = template.nextRunAt ? new Date(template.nextRunAt) : null;
    const clones = [];

    while (pointer && pointer <= now && guard < 60) {
      clones.push({
        userId: template.userId,
        amount: template.amount,
        category: template.category,
        description: template.description,
        paymentMethod: template.paymentMethod,
        date: new Date(pointer),
        generatedFrom: template._id,
      });
      pointer = advance(pointer, template.recurringFrequency);
      guard += 1;
    }

    if (clones.length) {
      created += await expensesRepo.createMany(clones);
    }
    await expensesRepo.setNextRunAt(template._id, pointer);
  }

  return created;
};

/** Cron entry point: catch every user up at once. */
const materializeAll = async () => {
  const now = new Date();
  const userIds = await expensesRepo.userIdsWithDue();

  let total = 0;
  for (const userId of userIds) {
    try {
      total += await materializeForUser(userId, now);
    } catch (err) {
      console.error('[recurring] failed for user', String(userId), err.message);
    }
  }

  if (total) console.log(`[recurring] created ${total} expense(s) across ${userIds.length} user(s)`);
  return total;
};

module.exports = { advance, firstRunAfter, materializeForUser, materializeAll };
