const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'REGISTER',
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'MFA_REQUIRED',
      'MFA_VERIFIED',
      'LOGOUT',
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_SUCCESS',
      'EMAIL_VERIFIED',
      'ACCOUNT_LOCKED',
      'SESSION_REVOKED',
      'PROFILE_UPDATED',
      'ROLE_UPDATED',
    ],
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1',
  },
  userAgent: {
    type: String,
    default: 'Unknown',
  },
  details: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
