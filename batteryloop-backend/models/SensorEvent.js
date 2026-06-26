/**
 * models/SensorEvent.js — Raw events from NodeMCU / bin hardware.
 */
const mongoose = require('mongoose');

const sensorEventSchema = new mongoose.Schema({
  binId:         { type: String, required: true },
  depositId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Deposit' },
  depositCode:   { type: String, default: '' },
  detectedCount: { type: Number, default: 0 },
  deviceId:      { type: String, default: '' },
  receivedAt:    { type: Date, default: Date.now },
});

sensorEventSchema.index({ binId: 1 });
sensorEventSchema.index({ receivedAt: -1 });

module.exports = mongoose.model('SensorEvent', sensorEventSchema);
