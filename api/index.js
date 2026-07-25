const path = require('path');
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const passport = require('passport');

const connectDB = require('../config/db');
const configurePassport = require('../config/passport');
const authRoutes = require('../routes/authRoutes');

const app = express();

// 1. Connect to MongoDB Atlas
connectDB();

// 2. Configure Passport Strategy
configurePassport();

// 3. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Dynamic CORS configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5000';
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

// Initialize Passport
app.use(passport.initialize());

// 4. Static Files Middleware
app.use(express.static(path.join(__dirname, '../public')));

// 5. Auth API Routes
app.use('/auth', authRoutes);

// 6. Frontend Route Handlers
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Catch-all route to serve login page for unknown routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
});

// Export Express App for Vercel Serverless Function compatibility
module.exports = app;

// Conditional listener: Only start standalone HTTP server when executed directly (Render / Local Node)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
  });
}
