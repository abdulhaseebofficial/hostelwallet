const express = require('express');
const ctrl = require('../controllers/reportController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { reportValidators } = require('../validators');

const router = express.Router();

router.use(protect);

router.get('/monthly', reportValidators.monthly, validate, ctrl.monthlyReport);
router.get('/export', reportValidators.export, validate, ctrl.exportReport);

module.exports = router;
