const express = require('express');
const ctrl = require('./reports.controller');
const validate = require('../../shared/middleware/validate');
const { protect } = require('../auth/auth.middleware');
const reportValidators = require('./reports.validator');

const router = express.Router();

router.use(protect);

router.get('/monthly', reportValidators.monthly, validate, ctrl.monthlyReport);
router.get('/export', reportValidators.export, validate, ctrl.exportReport);

module.exports = router;
