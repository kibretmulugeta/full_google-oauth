const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

/**
 * @route   GET /auth/google
 * @desc    Initiates Google OAuth 2.0 authentication flow
 * @access  Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * @route   GET /auth/google/callback
 * @desc    Handles Google OAuth callback, generates JWT, sets HttpOnly cookie, and redirects
 * @access  Public
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err || !user) {
      console.error('Google Auth Error:', err || info);
      return res.redirect('/?error=google_auth_failed');
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'default_dev_jwt_secret_key_12345';

      // Generate JWT containing internal MongoDB _id
      const token = jwt.sign(
        {
          id: user._id,
          googleId: user.googleId,
          email: user.email,
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Set JWT in a secure HttpOnly cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to dashboard page
      return res.redirect('/dashboard');
    } catch (error) {
      console.error('Error handling auth callback:', error);
      return res.redirect('/?error=server_error');
    }
  })(req, res, next);
});

/**
 * @route   GET /auth/me
 * @desc    Fetch authenticated user profile using HttpOnly JWT cookie
 * @access  Private (Protected by authMiddleware)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-__v');
    if (!user) {
      return res.status(44).json({
        success: false,
        message: 'User not found in database',
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        googleId: user.googleId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user profile',
    });
  }
});

/**
 * @route   GET /auth/logout
 * @desc    Clears HttpOnly JWT cookie and redirects to login page
 * @access  Public
 */
router.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.redirect('/');
});

module.exports = router;
