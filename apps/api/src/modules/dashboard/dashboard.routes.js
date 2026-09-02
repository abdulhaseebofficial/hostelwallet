const express = require('express');
const ctrl = require('./dashboard.controller');
const { protect } = require('../auth/auth.middleware');

const router = express.Router();

router.get('/summary', protect, ctrl.getSummary);

module.exports = router;
