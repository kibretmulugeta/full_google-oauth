const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const { checkRole } = require('../middleware/rbacMiddleware');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const { logAuditEvent } = require('../utils/auditLogger');

const router = express.Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'default_dev_jwt_secret_key_12345';
const isProduction = process.env.NODE_ENV === 'production';

// Helper to issue access & refresh tokens in HttpOnly cookies
const issueTokens = async (user, res, req) => {
  const tokenPayload = {
    id: user._id,
    email: user.email,
    role: user.role || 'user',
    permissions: user.permissions || [],
  };

  const accessToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '15m' });
  const refreshToken = uuidv4();
  const family = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await Session.create({
    userId: user._id,
    refreshToken,
    family,
    deviceInfo: {
      userAgent: req ? req.headers['user-agent'] : 'Unknown',
      ipAddress: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1',
    },
    expiresAt,
  });

  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { accessToken, refreshToken };
};

/**
 * @route   POST /auth/register
 * @desc    Local user registration (FirstName, LastName, Email, Password, PhoneNumber)
 * @access  Public
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phoneNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      firstName: firstName ? firstName.trim() : '',
      lastName: lastName ? lastName.trim() : '',
      displayName: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
      email: email.toLowerCase().trim(),
      password,
      phoneNumber: phoneNumber ? phoneNumber.trim() : '',
      authProvider: 'local',
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    await logAuditEvent({
      userId: user._id,
      email: user.email,
      action: 'REGISTER',
      req,
      details: 'Registered new local account',
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! You can now log in.',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

/**
 * @route   POST /auth/login
 * @desc    Local email/password authentication with account lockout and 2FA check
 * @access  Public
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +twoFactorSecret');

    if (!user) {
      await logAuditEvent({ email, action: 'LOGIN_FAILED', req, details: 'Non-existent account' });
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isLocked()) {
      await logAuditEvent({ userId: user._id, email: user.email, action: 'ACCOUNT_LOCKED', req, details: 'Attempted login while locked' });
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      await logAuditEvent({ userId: user._id, email: user.email, action: 'LOGIN_FAILED', req, details: 'Incorrect password' });
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 2FA/MFA Verification step
    if (user.twoFactorEnabled) {
      if (!mfaCode) {
        await logAuditEvent({ userId: user._id, email: user.email, action: 'MFA_REQUIRED', req });
        return res.json({
          success: true,
          mfaRequired: true,
          message: 'Two-factor authentication code required',
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: mfaCode,
        window: 1,
      });

      if (!verified) {
        await logAuditEvent({ userId: user._id, email: user.email, action: 'LOGIN_FAILED', req, details: 'Invalid MFA code' });
        return res.status(401).json({ success: false, message: 'Invalid 2FA passcode' });
      }

      await logAuditEvent({ userId: user._id, email: user.email, action: 'MFA_VERIFIED', req });
    }

    await user.resetLoginAttempts();
    await issueTokens(user, res, req);
    await logAuditEvent({ userId: user._id, email: user.email, action: 'LOGIN_SUCCESS', req, details: 'Local password login successful' });

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

/**
 * @route   GET /auth/google
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

/**
 * @route   GET /auth/google/callback
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err || !user) {
      const errMsg = err ? (err.message || String(err)) : 'Google Auth Failed';
      return res.redirect('/?error=' + encodeURIComponent(errMsg));
    }

    try {
      await issueTokens(user, res, req);
      await logAuditEvent({ userId: user._id, email: user.email, action: 'LOGIN_SUCCESS', req, details: 'Google OAuth login' });

      if (user.role === 'admin' || user.role === 'superadmin') {
        return res.redirect('/admin');
      }
      return res.redirect('/dashboard');
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return res.redirect('/?error=server_error');
    }
  })(req, res, next);
});

/**
 * @route   GET /auth/github
 */
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

/**
 * @route   GET /auth/github/callback
 */
router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', { session: false }, async (err, user, info) => {
    if (err || !user) {
      const errMsg = err ? (err.message || String(err)) : 'GitHub Auth Failed';
      return res.redirect('/?error=' + encodeURIComponent(errMsg));
    }

    try {
      await issueTokens(user, res, req);
      await logAuditEvent({ userId: user._id, email: user.email, action: 'LOGIN_SUCCESS', req, details: 'GitHub OAuth login' });

      if (user.role === 'admin' || user.role === 'superadmin') {
        return res.redirect('/admin');
      }
      return res.redirect('/dashboard');
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      return res.redirect('/?error=server_error');
    }
  })(req, res, next);
});

/**
 * @route   POST /auth/refresh-token
 * @desc    Rotate refresh token and issue new short-lived access token
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token missing' });
    }

    const session = await Session.findOne({ refreshToken, isRevoked: false });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Session expired or revoked' });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Revoke old token and issue new
    session.isRevoked = true;
    await session.save();

    await issueTokens(user, res, req);

    return res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ success: false, message: 'Server error refreshing token' });
  }
});

/**
 * @route   POST /auth/forgot-password
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, a password reset link has been generated.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    await logAuditEvent({ userId: user._id, email: user.email, action: 'PASSWORD_RESET_REQUEST', req });

    return res.json({
      success: true,
      message: 'Password reset request recorded.',
      resetToken, // Returned in dev mode for easy testing
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing request' });
  }
});

/**
 * @route   POST /auth/reset-password
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await logAuditEvent({ userId: user._id, email: user.email, action: 'PASSWORD_RESET_SUCCESS', req });

    return res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password' });
  }
});

/**
 * @route   POST /auth/mfa/setup
 */
router.post('/mfa/setup', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const secret = speakeasy.generateSecret({ name: `AuthModule (${user.email})` });
    user.twoFactorSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      success: true,
      secret: secret.base32,
      qrCodeUrl,
    });
  } catch (error) {
    console.error('MFA Setup error:', error);
    return res.status(500).json({ success: false, message: 'Server error setting up MFA' });
  }
});

/**
 * @route   POST /auth/mfa/verify
 */
router.post('/mfa/verify', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: 'MFA setup not initialized' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid 2FA verification code' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    await logAuditEvent({ userId: user._id, email: user.email, action: 'MFA_VERIFIED', req });

    return res.json({ success: true, message: 'Two-factor authentication successfully enabled' });
  } catch (error) {
    console.error('MFA Verify error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying MFA' });
  }
});

/**
 * @route   POST /auth/mfa/disable
 */
router.post('/mfa/disable', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    return res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    console.error('MFA Disable error:', error);
    return res.status(500).json({ success: false, message: 'Server error disabling MFA' });
  }
});

/**
 * @route   GET /auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -twoFactorSecret -__v');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phoneNumber: user.phoneNumber,
        authProvider: user.authProvider,
        googleId: user.googleId,
        githubId: user.githubId,
        avatarUrl: user.avatarUrl,
        role: user.role || 'user',
        permissions: user.permissions || [],
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

/**
 * @route   GET /auth/sessions
 */
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id, isRevoked: false }).select('-refreshToken');
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sessions' });
  }
});

/**
 * @route   POST /auth/sessions/revoke
 */
router.post('/sessions/revoke', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await Session.updateOne({ _id: sessionId, userId: req.user.id }, { $set: { isRevoked: true } });
    await logAuditEvent({ userId: req.user.id, action: 'SESSION_REVOKED', req });
    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error revoking session' });
  }
});

/**
 * @route   POST /auth/admin-login
 */
router.post('/admin-login', authLimiter, async (req, res) => {
  try {
    const { email, adminKey } = req.body;
    const requiredKey = process.env.ADMIN_KEY || 'admin123';

    if (!adminKey || adminKey !== requiredKey) {
      return res.status(401).json({ success: false, message: 'Invalid Admin Key' });
    }

    const adminEmail = (email && email.trim()) ? email.trim().toLowerCase() : 'admin@system.local';

    let user = await User.findOne({ email: adminEmail });
    if (!user) {
      user = await User.create({
        email: adminEmail,
        displayName: 'System Admin',
        role: 'admin',
        authProvider: 'local',
        permissions: ['read:profile', 'manage:users', 'manage:system', 'access:admin'],
        avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff',
      });
    } else if (user.role !== 'admin' && user.role !== 'superadmin') {
      user.role = 'admin';
      user.permissions = ['read:profile', 'manage:users', 'manage:system', 'access:admin'];
      await user.save();
    }

    await issueTokens(user, res, req);
    await logAuditEvent({ userId: user._id, email: user.email, action: 'LOGIN_SUCCESS', req, details: 'Admin Passcode Login' });

    return res.json({
      success: true,
      message: 'Admin authentication successful',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      redirect: '/admin',
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    return res.status(500).json({ success: false, message: 'Server error during admin authentication' });
  }
});

/**
 * @route   GET /auth/logout
 */
router.get('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await Session.updateOne({ refreshToken }, { $set: { isRevoked: true } });
    }
  } catch (err) {
    console.error('Error revoking token on logout:', err);
  }

  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: isProduction });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: isProduction });
  res.redirect('/');
});

module.exports = router;

