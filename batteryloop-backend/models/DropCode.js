/**
 * models/DropCode.js — Bin-first flow: the bin generates a 4-digit code,
 * user reads it from the display and claims points on the dashboard.
 */
const mongoose = require('mongoose');

const dropCodeSchema = new mongoose.Schema({
  code:         { type: String, required: true },
  binId:        { type: String, default: 'BIN-01' },
  batteryCount: { type: Number, default: 1 },
  pts:          { type: Number, default: 10 },
  claimedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status:       { type: String, enum: ['available', 'claimed', 'expired'], default: 'available' },
  createdAt:    { type: Date, default: Date.now },
});

dropCodeSchema.index({ code: 1, status: 1 });

module.exports = mongoose.model('DropCode', dropCodeSchema);
