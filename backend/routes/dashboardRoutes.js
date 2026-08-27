const express = require('express');
const ctrl = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/summary', protect, ctrl.getSummary);

module.exports = router;
