// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SADEW MD | lib/mongodbenv.js
// EnvVar mongoose model
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

const mongoose = require('mongoose');

const envVarSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, unique: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const EnvVar = mongoose.models.EnvVar || mongoose.model('EnvVar', envVarSchema);

module.exports = EnvVar;
