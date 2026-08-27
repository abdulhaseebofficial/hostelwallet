const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { DEFAULT_CATEGORIES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // `select: false` keeps the hash out of every ordinary query result.
    password: { type: String, required: true, minlength: 8, select: false },

    monthlyIncome: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'PKR', uppercase: true, maxlength: 5 },
    university: { type: String, trim: true, default: '' },
    hostelName: { type: String, trim: true, default: '' },

    // Extra categories the student creates on top of DEFAULT_CATEGORIES.
    customCategories: { type: [String], default: [] },

    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    onboardingCompleted: { type: Boolean, default: false },

    // Bumped on password change / reset so old refresh tokens stop working.
    tokenVersion: { type: Number, default: 0 },

    // Hashes of the refresh tokens that are currently valid, one per signed-in
    // device. Only hashes are kept, so a database dump yields no usable session.
    // A token that verifies but is NOT in here has already been rotated, which
    // means it was replayed - see authController.refresh.
    refreshTokens: {
      type: [
        {
          _id: false,
          tokenHash: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          expiresAt: { type: Date, required: true },
        },
      ],
      default: [],
    },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    lastExpenseReminderAt: { type: Date },
  },
  { timestamps: true }
);

/** Hash the password whenever it is set or changed. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Creates a reset token: the raw value is e-mailed, only the hash is stored. */
userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return raw;
};

/** Every category this user can pick from. */
userSchema.methods.allCategories = function allCategories() {
  return [...DEFAULT_CATEGORIES, ...(this.customCategories || [])];
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.tokenVersion;
    delete ret.refreshTokens;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
