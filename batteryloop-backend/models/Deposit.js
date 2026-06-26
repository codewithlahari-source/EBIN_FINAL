/**
 * models/Deposit.js
 */
const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  batteryCount:   { type: Number, required: true },
  pointsEarned:   { type: Number, default: 0 },
  expectedPoints: { type: Number, default: 0 },
  generatedCode:  { type: String, unique: true, required: true },
  active:         { type: Boolean, default: true },
  status:         { type: String, enum: ['pending', 'in-progress', 'verified', 'expired'], default: 'pending' },
  binId:          { type: String, default: 'BIN-01' },
  confirmedAt:    { type: Date },
  confirmedCount: { type: Number },
  timestamp:      { type: Date, default: Date.now },
});

depositSchema.index({ userId: 1 });
depositSchema.index({ status: 1 });
depositSchema.index({ binId: 1, status: 1 });

module.exports = mongoose.model('Deposit', depositSchema);
