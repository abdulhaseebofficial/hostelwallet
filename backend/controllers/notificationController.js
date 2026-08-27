const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { runChecksForUser } = require('../services/notificationService');

/** GET /api/notifications - newest first, with the unread count. */
const listNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const filter = { userId: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;

  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId: req.user._id, isRead: false }),
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
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: { notification } });
});

/** PATCH /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );
  res.json({ success: true, message: 'All caught up', data: { updated: result.modifiedCount } });
});

/** DELETE /api/notifications/:id */
const deleteNotification = asyncHandler(async (req, res) => {
  const removed = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!removed) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: { id: req.params.id } });
});

/** DELETE /api/notifications - clear the whole tray. */
const clearAll = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id });
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
