const express = require('express');
const ctrl = require('./notifications.controller');
const { protect } = require('../../shared/middleware/authenticate');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.listNotifications);
router.post('/check', ctrl.runChecks);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.deleteNotification);
router.delete('/', ctrl.clearAll);

module.exports = router;
