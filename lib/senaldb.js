// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SADEW MD | lib/senaldb.js
// readEnv / updateEnv — MongoDB-backed env store
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

const EnvVar = require('./mongodbenv');
const config = require('../config');

/**
 * Read all env vars from MongoDB, fallback to config.js
 */
const readEnv = async () => {
  try {
    const envVars = await EnvVar.find({});
    const out = {};
    envVars.forEach(e => { out[e.key] = e.value; });
    // fill missing from .env config
    Object.keys(config).forEach(k => {
      if (out[k] === undefined && config[k] !== undefined) {
        out[k] = config[k];
      }
    });
    return out;
  } catch (err) {
    console.error('[senaldb] readEnv error:', err.message);
    return { ...config };
  }
};

/**
 * Upsert a single env var in MongoDB
 */
const updateEnv = async (key, newValue) => {
  try {
    await EnvVar.findOneAndUpdate(
      { key },
      { value: String(newValue) },
      { new: true, upsert: true }
    );
    console.log(`[senaldb] Updated ${key} = ${newValue}`);
  } catch (err) {
    console.error('[senaldb] updateEnv error:', err.message);
    throw err;
  }
};

module.exports = { readEnv, updateEnv };
