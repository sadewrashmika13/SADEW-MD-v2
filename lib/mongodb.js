// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SADEW MD | lib/mongodb.js
// Central MongoDB connection — called once at startup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://botmini:botmini@minibot.upglk0f.mongodb.net/?retryWrites=true&w=majority&appName=minibot';

let isConnected = false;

async function connectDB() {
  if (!MONGODB_URI) {
    console.log('[MongoDB] No URI — skipping connection.');
    return;
  }
  if (isConnected) {
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS:          45000,
    });
    isConnected = true;
    console.log('🛜 MongoDB Connected ✅');

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.log('[MongoDB] Disconnected — will reconnect on next call.');
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Error:', err.message);
      isConnected = false;
    });

  } catch (err) {
    isConnected = false;
    console.error('❌ MongoDB Connection Error:', err.message);
    setTimeout(connectDB, 10000);
  }
}

module.exports = connectDB;
