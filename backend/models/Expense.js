const mongoose = require('mongoose');
const { PAYMENT_METHODS, RECURRING_FREQUENCIES } = require('../config/constants');

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    category: { type: String, required: [true, 'Category is required'], trim: true },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'Cash' },
    date: { type: Date, required: true, default: Date.now, index: true },

    // A recurring expense is a normal expense that also acts as a template;
    // the scheduler clones it whenever nextRunAt falls due.
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: { type: String, enum: RECURRING_FREQUENCIES, default: 'monthly' },
    nextRunAt: { type: Date },
    generatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
  },
  { timestamps: true }
);

// The dominant query is "one user's expenses in a date range, newest first".
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
