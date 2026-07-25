const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.includes('your_username:your_password') || mongoUri.includes('user:pass')) {
    throw new Error('MONGO_URI environment variable is missing or invalid in server settings');
  }

  try {
    // Disable command buffering so queries fail fast if connection fails
    mongoose.set('bufferCommands', false);

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
