const { query } = require('express-validator');
const { idParam } = require('../../shared/validation/rules');

/**
 * Notification request rules.
 *
 * The id params are validated the way every other module validates them, so a
 * malformed id is refused here rather than reaching a query.
 *
 * The list query is deliberately lenient. `?limit=abc` and `?limit=999999`
 * both work today - one falls back to the default, the other is clamped - and
 * turning either into a 400 would break a request that currently succeeds.
 * These chains normalise instead of rejecting, which leaves those callers
 * working while making sure a nonsensical value never reaches the SQL.
 */
const notificationValidators = {
  /** GET / - newest first, optionally unread only. */
  list: [
    query('limit')
      .optional()
      .toInt()
      // A value that is not a number at all becomes NaN here; the repository
      // falls back to its default for anything it cannot use.
      .customSanitizer((value) => (Number.isFinite(value) ? Math.min(50, Math.max(1, value)) : undefined)),
    // Lenient for the same reason: `?unread=maybe` currently reads as "not
    // true" and returns everything. Rejecting it would be defensible, but it
    // would break a request that works today, so it is normalised instead.
    query('unread')
      .optional()
      .customSanitizer((value) => (value === 'true' ? 'true' : 'false')),
  ],

  /** PATCH /:id/read and DELETE /:id */
  byId: [idParam('id')],
};

module.exports = notificationValidators;
