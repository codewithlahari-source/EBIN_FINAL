/**
 * models/BinMetrics.js — Tracks physical bin fill level.
 */
const mongoose = require('mongoose');

const binMetricsSchema = new mongoose.Schema({
  binId:            { type: String, unique: true, required: true },
  currentBatteries: { type: Number, default: 0 },
  maxCapacity:      { type: Number, default: 100 },
  fillPercentage:   { type: Number, default: 0 },
  totalDeposits:    { type: Number, default: 0 },
  lastDepositAt:    { type: Date },
  lastResetAt:      { type: Date },
}, { timestamps: true });

// Index created automatically by unique: true on binId field

module.exports = mongoose.model('BinMetrics', binMetricsSchema);
