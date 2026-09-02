/**
 * The daily alert sweep.
 *
 * Runs the notification checks for every student. Idempotent: each alert
 * carries a dedupe key, so a second run in the same period raises nothing new
 * and it is safe for both a cron tick and an external scheduler to call this.
 *
 * One student's failure must not stop the sweep, so each is caught and counted
 * rather than thrown.
 */

const usersRepo = require('../../modules/users/users.repository');
const { runChecksForUser } = require('../../modules/notifications/notifications.service');

const runAlertSweep = async () => {
  const users = await usersRepo.findAllForAlerts();

  let failed = 0;
  for (const user of users) {
    try {
      await runChecksForUser(user);
    } catch (err) {
      failed += 1;
      console.error(`[alerts] check failed for one user: ${err.message}`);
    }
  }

  return { users: users.length, failed };
};

module.exports = { runAlertSweep };
