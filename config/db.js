const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  let mongoUri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : '';
  if (mongoUri && !mongoUri.includes('authSource=')) {
    mongoUri += mongoUri.includes('?') ? '&authSource=admin' : '?authSource=admin';
  }

  if (!mongoUri || mongoUri.includes('your_username:your_password') || mongoUri.includes('user:pass')) {
    throw new Error('MONGO_URI environment variable is missing or invalid in server settings');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️ Primary Mongo connection failed (${error.message}). Trying direct Atlas shard fallback...`);

    if (mongoUri.startsWith('mongodb+srv://')) {
      try {
        const urlObj = new URL(mongoUri.replace('mongodb+srv://', 'http://'));
        const hostname = urlObj.hostname; // e.g. "cluster0.vfutu5u.mongodb.net"
        const dbName = urlObj.pathname || '/google_auth_db';
        const auth = urlObj.username ? `${urlObj.username}:${urlObj.password}@` : '';

        const parts = hostname.split('.');
        const clusterName = parts[0] || 'cluster0';
        const domain = parts.length > 1 ? parts.slice(1).join('.') : 'mongodb.net';

        const shardHosts = `${clusterName}-shard-00-00.${domain}:27017,${clusterName}-shard-00-01.${domain}:27017,${clusterName}-shard-00-02.${domain}:27017`;
        
        const fallbackUri = `mongodb://${auth}${shardHosts}${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;

        const conn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 10000,
        });
        isConnected = true;
        console.log(`✅ MongoDB Atlas Direct Seed List Connected: ${conn.connection.host}`);
        return;
      } catch (fallbackErr) {
        const reason = fallbackErr.reason ? JSON.stringify(fallbackErr.reason) : fallbackErr.message;
        throw new Error(`DB Connection Failed: ${reason}`);
      }
    }

    const reason = error.reason ? JSON.stringify(error.reason) : error.message;
    throw new Error(`DB Connection Failed: ${reason}`);
  }
};

module.exports = connectDB;
