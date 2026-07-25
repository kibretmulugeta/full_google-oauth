const mongoose = require('mongoose');

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
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    // If SRV lookup fails in serverless, try standard Atlas seed list connection string
    if (error.message && error.message.includes('querySrv ENOTFOUND') && mongoUri.startsWith('mongodb+srv://')) {
      try {
        const urlObj = new URL(mongoUri.replace('mongodb+srv://', 'http://'));
        const hostname = urlObj.hostname; // e.g. "cluster0.vfutu5u.mongodb.net"
        const dbName = urlObj.pathname || ''; // e.g. "/google_auth_db"
        const auth = urlObj.username ? `${urlObj.username}:${urlObj.password}@` : '';
        const search = urlObj.search || '?retryWrites=true&w=majority';

        const shardHosts = `${hostname.replace('.mongodb.net', '')}-shard-00-00.${hostname}:27017,${hostname.replace('.mongodb.net', '')}-shard-00-01.${hostname}:27017,${hostname.replace('.mongodb.net', '')}-shard-00-02.${hostname}:27017`;
        
        const fallbackUri = `mongodb://${auth}${shardHosts}${dbName}${search}${search.includes('?') ? '&' : '?'}ssl=true&authSource=admin`;

        const conn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 10000,
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
