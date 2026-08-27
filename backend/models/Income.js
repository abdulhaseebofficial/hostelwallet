const mongoose = require('mongoose');
const { INCOME_SOURCES } = require('../config/constants');

const incomeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
    source: { type: String, enum: INCOME_SOURCES, default: 'Pocket Money' },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

incomeSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Income', incomeSchema);
