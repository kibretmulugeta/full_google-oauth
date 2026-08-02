const path = require('path');
const fs = require('fs');
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const passport = require('passport');

const connectDB = require('../config/db');
const configurePassport = require('../config/passport');
const authRoutes = require('../routes/authRoutes');
const taskRoutes = require('../routes/taskRoutes');
const adminRoutes = require('../routes/adminRoutes');

const app = express();

// Enable trust proxy for reverse proxies (Vercel, Render) so req.protocol correctly detects https
app.set('trust proxy', 1);

// 1. Database Connection Middleware (ensures MongoDB is connected before handling any request in Serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection warning in request middleware:', err.message);
  }
  next();
});

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
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || origin === clientUrl || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, true); // Permissive CORS for OAuth callback flexibility
    },
    credentials: true,
  })
);

// Initialize Passport
app.use(passport.initialize());

// Helper function to resolve static public path across Vercel Lambda and local Node.js
function getPublicFile(filename) {
  const possiblePaths = [
    path.resolve(process.cwd(), 'public', filename),
    path.join(__dirname, '../public', filename),
    path.join(__dirname, 'public', filename),
    path.resolve(__dirname, '..', 'public', filename)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// 4. Static Files Middleware
const publicDir = path.resolve(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
app.use(express.static(path.join(__dirname, '../public')));

// 5. Auth & API Routes
app.use('/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);

// 6. Frontend Route Handlers
const serveHtml = (filename, res) => {
  const filePath = getPublicFile(filename);
  if (filePath) {
    return res.sendFile(filePath);
  }
  return res.status(404).send(`<h1>404 - ${filename} Not Found</h1><p>Ensure public/${filename} is included in deployment.</p>`);
};

app.get('/', (req, res) => {
  serveHtml('index.html', res);
});

app.get('/dashboard', (req, res) => {
  serveHtml('dashboard.html', res);
});

app.get('/admin', (req, res) => {
  serveHtml('admin.html', res);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasGoogleCredentials: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// Catch-all route to serve index.html for unknown SPA routes
app.use((req, res) => {
  if (req.accepts('html')) {
    return serveHtml('index.html', res);
  }
  res.status(404).json({ error: 'Endpoint not found' });
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
