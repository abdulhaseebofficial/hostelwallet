const express = require('express');
const ctrl = require('../controllers/feedbackController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { feedbackLimiter } = require('../middleware/rateLimiter');
const { feedbackValidators } = require('../validators');

const router = express.Router();

router.use(protect);

router.get('/meta', ctrl.feedbackMeta);
router.get('/mine', ctrl.myFeedback);

// Rate limited on top of the global cap: every submission writes a row and
// tries to send an e-mail, so it is worth more to a spammer than a read is.
router.post('/', feedbackLimiter, feedbackValidators.create, validate, ctrl.submitFeedback);

module.exports = router;
