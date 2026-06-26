/**
 * config/mongodb.js — MongoDB connection via Mongoose.
 *
 * Uses Google Public DNS (8.8.8.8) to resolve SRV records when the
 * default system DNS fails (common with some ISPs blocking Atlas SRV lookups).
 */
const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  try {
    // Use Google Public DNS to resolve MongoDB Atlas SRV records
    // (fixes ECONNREFUSED on ISPs that block SRV lookups)
    dns.setServers(['8.8.8.8', '8.8.4.4']);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
