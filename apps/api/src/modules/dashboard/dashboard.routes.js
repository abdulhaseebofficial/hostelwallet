const express = require('express');
const ctrl = require('./dashboard.controller');
const { protect } = require('../../shared/middleware/authenticate');

const router = express.Router();

router.get('/summary', protect, ctrl.getSummary);

module.exports = router;
