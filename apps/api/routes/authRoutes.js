const express = require('express');
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const { authValidators } = require('../validators');

const router = express.Router();

// Every unauthenticated auth route is rate limited against brute forcing.
router.post('/register', authLimiter, authValidators.register, validate, ctrl.register);
router.post('/login', authLimiter, authValidators.login, validate, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

router.post('/forgot-password', authLimiter, authValidators.forgotPassword, validate, ctrl.forgotPassword);
router.post('/reset-password/:token', authLimiter, authValidators.resetPassword, validate, ctrl.resetPassword);

router.get('/me', protect, ctrl.me);
router.put('/change-password', protect, authValidators.changePassword, validate, ctrl.changePassword);

module.exports = router;
