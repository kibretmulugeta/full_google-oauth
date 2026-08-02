const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const connectDB = require('./db');
const { logAuditEvent } = require('../utils/auditLogger');

const configurePassport = () => {
  let baseUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.trim().replace(/\/$/, '') : '';
  if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }

  // 1. Google OAuth 2.0 Strategy
  const googleClientID = process.env.GOOGLE_CLIENT_ID || 'dummy_google_id';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_google_secret';
  const googleCallbackURL = baseUrl ? `${baseUrl}/auth/google/callback` : '/auth/google/callback';

  console.log(`🔑 Google OAuth Callback URL: ${googleCallbackURL}`);

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientID,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackURL,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          await connectDB();

          const googleId = profile.id;
          const email = (profile.emails && profile.emails[0] ? profile.emails[0].value : '').toLowerCase();
          const displayName = profile.displayName || profile.username || 'Google User';
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

          let user = await User.findOne({ $or: [{ googleId }, { email }] });

          if (user) {
            if (!user.googleId) {
              user.googleId = googleId;
            }
            if (!user.avatarUrl) user.avatarUrl = avatarUrl;
            if (user.authProvider === 'local') user.isEmailVerified = true;
            await user.save();
            return done(null, user);
          }

          user = await User.create({
            googleId,
            email,
            displayName,
            avatarUrl,
            authProvider: 'google',
            isEmailVerified: true,
          });

          await logAuditEvent({ userId: user._id, email: user.email, action: 'REGISTER', details: 'Registered via Google OAuth' });

          return done(null, user);
        } catch (error) {
          console.error('Passport Google Strategy Error:', error);
          return done(error, null);
        }
      }
    )
  );

  // 2. GitHub OAuth Strategy
  const githubClientID = process.env.GITHUB_CLIENT_ID || 'dummy_github_id';
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || 'dummy_github_secret';
  const githubCallbackURL = baseUrl ? `${baseUrl}/auth/github/callback` : '/auth/github/callback';

  console.log(`🔑 GitHub OAuth Callback URL: ${githubCallbackURL}`);

  passport.use(
    new GitHubStrategy(
      {
        clientID: githubClientID,
        clientSecret: githubClientSecret,
        callbackURL: githubCallbackURL,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          await connectDB();

          const githubId = String(profile.id);
          const email = (profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.local`).toLowerCase();
          const displayName = profile.displayName || profile.username || 'GitHub User';
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

          let user = await User.findOne({ $or: [{ githubId }, { email }] });

          if (user) {
            if (!user.githubId) {
              user.githubId = githubId;
            }
            if (!user.avatarUrl) user.avatarUrl = avatarUrl;
            if (user.authProvider === 'local') user.isEmailVerified = true;
            await user.save();
            return done(null, user);
          }

          user = await User.create({
            githubId,
            email,
            displayName,
            avatarUrl,
            authProvider: 'github',
            isEmailVerified: true,
          });

          await logAuditEvent({ userId: user._id, email: user.email, action: 'REGISTER', details: 'Registered via GitHub OAuth' });

          return done(null, user);
        } catch (error) {
          console.error('Passport GitHub Strategy Error:', error);
          return done(error, null);
        }
      }
    )
  );
};

module.exports = configurePassport;

