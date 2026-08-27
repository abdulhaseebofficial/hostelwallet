const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: [true, 'Goal title is required'], trim: true, maxlength: 80 },
    targetAmount: { type: Number, required: true, min: [1, 'Target must be at least 1'] },
    savedAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date },
    icon: { type: String, default: '\uD83C\uDFAF' },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },

    // Small ledger so add / withdraw stays auditable instead of a silent overwrite.
    contributions: [
      {
        amount: Number,
        date: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

goalSchema.virtual('progress').get(function progress() {
  if (!this.targetAmount) return 0;
  return Math.min(100, Math.round((this.savedAmount / this.targetAmount) * 100));
});

/** Keep isCompleted in sync with the saved amount on every write. */
goalSchema.pre('save', function syncCompletion(next) {
  const reached = this.savedAmount >= this.targetAmount;
  if (reached && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
  } else if (!reached && this.isCompleted) {
    this.isCompleted = false;
    this.completedAt = undefined;
  }
  next();
});

goalSchema.index({ userId: 1, isCompleted: 1, deadline: 1 });

module.exports = mongoose.model('Goal', goalSchema);
