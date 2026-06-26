/**
 * models/Voucher.js — Reward catalog items (admin-managed).
 * In the frontend these are called "rewards" in the store.
 */
const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  pointsCost:  { type: Number, required: true },
  value:       { type: String, default: '' },
  description: { type: String, default: '' },
  icon:        { type: String, default: '🎁' },
  imgDataUrl:  { type: String, default: '' },
  category:    { type: String, default: 'gift_card' },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

voucherSchema.index({ active: 1 });

module.exports = mongoose.model('Voucher', voucherSchema);
