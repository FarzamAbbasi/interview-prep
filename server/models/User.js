const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // queries do not return the password unless asked
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isVerified: { type: Boolean, default: false }, // email verified?
    isPaid: { type: Boolean, default: false }, // full access unlocked?
    paidAt: { type: Date },
    // IPP-1704: 'all' = every language (also ones added later), 'some' = only paidLanguages
    accessScope: { type: String, enum: ['all', 'some'], default: 'all' },
    paidLanguages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Language' }],
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // IPP-1703: admin who turned full access on
    lastLoginAt: { type: Date }, // IPP-1703
    lastSeenAt: { type: Date }, // IPP-1703: any logged-in request, saved at most once an hour
    isBlocked: { type: Boolean, default: false },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    // IPP-1724: when the free Interview Mode round was used (stays set even if that round is deleted)
    interviewTrialAt: { type: Date, default: null },

    // Email verification and password reset (stored hashed, hidden by default)
    emailToken: { type: String, select: false },
    emailTokenExpires: { type: Date, select: false },
    resetToken: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },

    // Set when the password is reset; login tokens issued before this stop working
    passwordChangedAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash password before saving (only when it is new or changed)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Never send password or tokens in API responses
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.emailToken;
    delete ret.emailTokenExpires;
    delete ret.resetToken;
    delete ret.resetTokenExpires;
    delete ret.passwordChangedAt;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
