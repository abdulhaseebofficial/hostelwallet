const mongoose = require('mongoose');
const { FEEDBACK_TYPES } = require('../config/constants');

/**
 * A note from a student about the app itself.
 *
 * The row is kept even when the e-mail to the developer cannot be sent, which
 * is the normal case with no SMTP configured - the feedback is not lost just
 * because the mail hop is unavailable. `emailed` records which happened.
 */
const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: FEEDBACK_TYPES, default: 'General' },
    // 1-5, optional: a student with a bug to report should not have to rate anything.
    rating: { type: Number, min: 1, max: 5 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    // Where they were when they hit "send", so a bug report has context.
    page: { type: String, trim: true, maxlength: 120 },
    emailed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
