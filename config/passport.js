const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const connectDB = require('./db');

const configurePassport = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID || 'dummy_id';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret';

  let baseUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.trim().replace(/\/$/, '') : '';
  if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  const callbackURL = baseUrl ? `${baseUrl}/auth/google/callback` : '/auth/google/callback';

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientID,
        clientSecret: clientSecret,
        callbackURL: callbackURL,
        proxy: true, // required for hosting behind proxies like Render or Vercel
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Ensure MongoDB connection is fully established before querying models in serverless environment
          await connectDB();

          const googleId = profile.id;
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
          const displayName = profile.displayName || profile.username || 'Google User';
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

          // 1. Query MongoDB by googleId
          let user = await User.findOne({ googleId });

          if (user) {
            // User exists - log them in
            return done(null, user);
          }

          // 2. If user does not exist, auto-register them
          user = await User.create({
            googleId,
            email,
            displayName,
            avatarUrl,
          });

          return done(null, user);
        } catch (error) {
          console.error('Passport Google Strategy Error:', error);
          return done(error, null);
        }
      }
    )
  );
};

module.exports = configurePassport;
