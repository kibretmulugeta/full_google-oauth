const mongoose = require('mongoose');
const dns = require('dns');

// Execute at top-level module load time
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
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
    // If SRV DNS lookup fails (querySrv ENOTFOUND), fallback to direct Atlas shard seed list URI
    if (error.message && error.message.includes('querySrv ENOTFOUND') && mongoUri.startsWith('mongodb+srv://')) {
      console.warn('⚠️ SRV DNS lookup failed. Attempting direct Atlas shard connection fallback...');
      try {
        const directUri = mongoUri
          .replace('mongodb+srv://', 'mongodb://')
          .replace(/@([^/]+)/, (match, host) => {
            const hostClean = host.split('?')[0];
            return `@${hostClean}-shard-00-00.${hostClean}:27017,${hostClean}-shard-00-01.${hostClean}:27017,${hostClean}-shard-00-02.${hostClean}:27017`;
          });

        const fallbackUri = directUri.includes('?')
          ? `${directUri}&ssl=true&authSource=admin`
          : `${directUri}?ssl=true&authSource=admin`;

        const conn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log(`✅ MongoDB Atlas Direct Seed List Connected: ${conn.connection.host}`);
        return;
      } catch (fallbackErr) {
        console.error(`❌ Direct fallback connection error: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }

    console.error(`❌ MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
