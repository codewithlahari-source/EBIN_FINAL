/**
 * models/ActiveVoucher.js — Granted vouchers (approved & issued to user).
 */
const mongoose = require('mongoose');

const activeVoucherSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voucherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
  voucherCode: { type: String, unique: true, required: true },
  voucherName: { type: String, default: '' },
  value:       { type: String, default: '' },
  status:      { type: String, enum: ['active', 'redeemed', 'expired'], default: 'active' },
  createdAt:   { type: Date, default: Date.now },
  expiresAt:   { type: Date },
  redeemedAt:  { type: Date },
});

activeVoucherSchema.index({ userId: 1 });
activeVoucherSchema.index({ status: 1 });

module.exports = mongoose.model('ActiveVoucher', activeVoucherSchema);
