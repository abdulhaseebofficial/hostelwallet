/**
 * Notification endpoints. Request in, JSON out; the rules and the tray
 * operations are in notifications.service.
 */

const notifications = require('./notifications.service');
const asyncHandler = require('../../shared/http/asyncHandler');

/** GET /api/notifications - newest first, with the unread count. */
const listNotifications = asyncHandler(async (req, res) => {
  const data = await notifications.listForUser(req.user._id, {
    limit: req.query.limit,
    unreadOnly: req.query.unread === 'true',
  });
  res.json({ success: true, data });
});

/** POST /api/notifications/check - re-run the alert rules on demand. */
const runChecks = asyncHandler(async (req, res) => {
  const created = await notifications.runChecksForUser(req.user);
  res.json({ success: true, data: { created: created.length, items: created } });
});

/** PATCH /api/notifications/:id/read */
const markRead = asyncHandler(async (req, res) => {
  const notification = await notifications.markRead(req.params.id, req.user._id);
  res.json({ success: true, data: { notification } });
});

/** PATCH /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notifications.markAllRead(req.user._id);
  res.json({ success: true, message: 'All caught up', data: { updated } });
});

/** DELETE /api/notifications/:id */
const deleteNotification = asyncHandler(async (req, res) => {
  const id = await notifications.remove(req.params.id, req.user._id);
  res.json({ success: true, data: { id } });
});

/** DELETE /api/notifications - clear the whole tray. */
const clearAll = asyncHandler(async (req, res) => {
  await notifications.clearAll(req.user._id);
  res.json({ success: true, message: 'Notifications cleared' });
});

module.exports = {
  listNotifications,
  runChecks,
  markRead,
  markAllRead,
  deleteNotification,
  clearAll,
};
