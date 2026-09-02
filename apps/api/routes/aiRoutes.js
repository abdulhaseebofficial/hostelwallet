const express = require('express');
const ctrl = require('../controllers/aiController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');
const { aiValidators } = require('../validators');

const router = express.Router();

router.use(protect);

// Cheap, read-only endpoints stay outside the AI quota.
router.get('/status', ctrl.status);
router.get('/chat/history', ctrl.chatHistory);
router.delete('/chat', ctrl.clearChat);

// Everything that spends a Claude call is metered per user, per hour.
router.post('/advice', aiLimiter, aiValidators.advice, validate, ctrl.advice);
router.post('/chat', aiLimiter, aiValidators.chat, validate, ctrl.chat);
router.get('/tip', aiLimiter, ctrl.tip);
router.post('/suggest-budget', aiLimiter, ctrl.suggestBudget);
router.get('/weekly-summary', aiLimiter, ctrl.weeklySummary);

module.exports = router;
