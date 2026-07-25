const mongoose = require('mongoose');
const dns = require('dns');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // Set reliable public DNS servers to resolve MongoDB Atlas SRV records in serverless environments
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (dnsErr) {
    console.warn('Custom DNS setServers warning:', dnsErr.message);
  }

  const mongoUri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : '';

  if (!mongoUri || mongoUri.includes('your_username:your_password') || mongoUri.includes('user:pass')) {
    throw new Error('MONGO_URI environment variable is missing or invalid in server settings');
  }

  try {
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
