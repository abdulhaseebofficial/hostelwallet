const notificationsRepo = require('./notifications.repository');
const ApiError = require('../../shared/errors/ApiError');
const asyncHandler = require('../../shared/http/asyncHandler');
const { runChecksForUser } = require('./notifications.service');

/** GET /api/notifications - newest first, with the unread count. */
const listNotifications = asyncHandler(async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    notificationsRepo.list(req.user._id, {
      limit: req.query.limit,
      unreadOnly: req.query.unread === 'true',
    }),
    notificationsRepo.unreadCount(req.user._id),
  ]);

  res.json({ success: true, data: { items, unreadCount } });
});

/** POST /api/notifications/check - re-run the alert rules on demand. */
const runChecks = asyncHandler(async (req, res) => {
  const created = await runChecksForUser(req.user);
  res.json({ success: true, data: { created: created.length, items: created } });
});

/** PATCH /api/notifications/:id/read */
const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationsRepo.markRead(req.params.id, req.user._id);
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: { notification } });
});

/** PATCH /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notificationsRepo.markAllRead(req.user._id);
  res.json({ success: true, message: 'All caught up', data: { updated } });
});

/** DELETE /api/notifications/:id */
const deleteNotification = asyncHandler(async (req, res) => {
  const removed = await notificationsRepo.remove(req.params.id, req.user._id);
  if (!removed) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: { id: req.params.id } });
});

/** DELETE /api/notifications - clear the whole tray. */
const clearAll = asyncHandler(async (req, res) => {
  await notificationsRepo.clearAll(req.user._id);
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
