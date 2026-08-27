const mongoose = require('mongoose');

/**
 * Connect to MongoDB.
 * Mongoose 8 buffers queries until the connection is ready, but we still fail
 * fast on start-up so a bad MONGO_URI is obvious instead of silently hanging.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy backend/.env.example to backend/.env');
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('error', (err) => console.error('[db] connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));

  return conn;
};

module.exports = connectDB;
