const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    trim: true,
    default: '',
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
  },
  displayName: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    select: false, // Don't return password by default
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: '',
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'github'],
    default: 'local',
  },
  googleId: {
    type: String,
    sparse: true,
    trim: true,
  },
  githubId: {
    type: String,
    sparse: true,
    trim: true,
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  },
  permissions: {
    type: [String],
    default: ['read:profile'],
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false,
  },
  twoFactorRecoveryCodes: [String],
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
  },
  webauthnCredentials: [
    {
      credentialID: String,
      credentialPublicKey: String,
      counter: Number,
      transports: [String],
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  if (this.firstName || this.lastName) {
    return `${this.firstName} ${this.lastName}`.trim();
  }
  return this.displayName || this.email.split('@')[0];
});

// Pre-save password hashing
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Set fallback displayName if empty
  if (!this.displayName) {
    if (this.firstName || this.lastName) {
      this.displayName = `${this.firstName} ${this.lastName}`.trim();
    } else {
      this.displayName = this.email.split('@')[0];
    }
  }

  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts and lock account if max attempts reached
userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_TIME) };
  }

  return await this.updateOne(updates);
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

module.exports = mongoose.model('User', userSchema);

