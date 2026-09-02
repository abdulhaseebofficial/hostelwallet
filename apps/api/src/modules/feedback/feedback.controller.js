/**
 * Feedback endpoints. Request in, JSON out; the rules are in feedback.service.
 */

const feedback = require('./feedback.service');
const asyncHandler = require('../../shared/http/asyncHandler');

/** POST /api/feedback */
const submitFeedback = asyncHandler(async (req, res) => {
  const saved = await feedback.submit(req.user, req.body);
  res.status(201).json({
    success: true,
    message: 'Thanks - your feedback is on its way.',
    data: { feedback: saved },
  });
});

/** GET /api/feedback/meta - the type list and how to reach the developer. */
const feedbackMeta = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: feedback.meta() });
});

/** GET /api/feedback/mine - what this student has already sent. */
const myFeedback = asyncHandler(async (req, res) => {
  const items = await feedback.listForUser(req.user._id);
  res.json({ success: true, data: { items } });
});

module.exports = { submitFeedback, feedbackMeta, myFeedback };
