const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('=> Using existing MongoDB connection');
    return;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.includes('your_username:your_password') || mongoUri.includes('user:pass')) {
    console.warn('⚠️ MONGO_URI is not properly configured in .env file. Database operations will fail until a valid connection string is provided.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
  }
};

module.exports = connectDB;
