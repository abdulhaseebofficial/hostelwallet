const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');
const { sendMail } = require('../utils/mailer');
const { DEVELOPER, FEEDBACK_TYPES } = require('../config/constants');

/**
 * POST /api/feedback
 *
 * Stores the note first, then tries to e-mail it on. The mail hop is
 * deliberately not awaited into the response path beyond a try/catch: a
 * student who took the trouble to write something should see "thanks", not an
 * SMTP error, and the row is already safe either way.
 */
const submitFeedback = asyncHandler(async (req, res) => {
  const { type, rating, message, page } = req.body;

  const feedback = await Feedback.create({
    userId: req.user._id,
    type: type || 'General',
    rating: rating || undefined,
    message: message.trim(),
    page,
  });

  try {
    const result = await sendMail({
      to: DEVELOPER.email,
      subject: `HostelWallet feedback: ${feedback.type}${feedback.rating ? ` (${feedback.rating}/5)` : ''}`,
      text: [
        `From: ${req.user.name} <${req.user.email}>`,
        `Type: ${feedback.type}`,
        feedback.rating ? `Rating: ${feedback.rating}/5` : null,
        feedback.page ? `Page: ${feedback.page}` : null,
        '',
        feedback.message,
      ]
        .filter((line) => line !== null)
        .join('\n'),
    });

    if (result.delivered) {
      feedback.emailed = true;
      await feedback.save();
    }
  } catch (error) {
    // Logged, never surfaced - the feedback itself was already stored.
    console.error('[feedback] could not e-mail the developer:', error.message);
  }

  res.status(201).json({
    success: true,
    message: 'Thanks - your feedback is on its way.',
    data: { feedback },
  });
});

/** GET /api/feedback/meta - the type list and how to reach the developer. */
const feedbackMeta = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { types: FEEDBACK_TYPES, developer: DEVELOPER },
  });
});

/** GET /api/feedback/mine - what this student has already sent. */
const myFeedback = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ success: true, data: { items } });
});

module.exports = { submitFeedback, feedbackMeta, myFeedback };
