const express = require('express');
const ctrl = require('./notifications.controller');
const validate = require('../../shared/middleware/validate');
const { protect } = require('../auth/auth.middleware');
const notificationValidators = require('./notifications.validator');

const router = express.Router();

router.use(protect);

router.get('/', notificationValidators.list, validate, ctrl.listNotifications);
router.post('/check', ctrl.runChecks);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', notificationValidators.byId, validate, ctrl.markRead);
router.delete('/:id', notificationValidators.byId, validate, ctrl.deleteNotification);
router.delete('/', ctrl.clearAll);

module.exports = router;
