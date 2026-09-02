const express = require('express');
const ctrl = require('./feedback.controller');
const validate = require('../../shared/middleware/validate');
const { protect } = require('../../shared/middleware/authenticate');
const { feedbackLimiter } = require('../../shared/middleware/rateLimiter');
const feedbackValidators = require('./feedback.validator');

const router = express.Router();

router.use(protect);

router.get('/meta', ctrl.feedbackMeta);
router.get('/mine', ctrl.myFeedback);

// Rate limited on top of the global cap: every submission writes a row and
// tries to send an e-mail, so it is worth more to a spammer than a read is.
router.post('/', feedbackLimiter, feedbackValidators.create, validate, ctrl.submitFeedback);

module.exports = router;
