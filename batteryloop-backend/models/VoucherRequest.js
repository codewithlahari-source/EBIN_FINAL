/**
 * models/VoucherRequest.js — User-initiated redemption requests.
 * In the frontend these are the "redemptions" table rows.
 */
const mongoose = require('mongoose');

const voucherRequestSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voucherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
  rewardName:  { type: String, default: '' },
  cost:        { type: Number, default: 0 },
  redeemCode:  { type: String, default: '' },
  status:      { type: String, enum: ['pending', 'approved', 'denied', 'redeemed'], default: 'approved' },
  reason:      { type: String, default: '' },
  requestedAt: { type: Date, default: Date.now },
  approvedAt:  { type: Date },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

voucherRequestSchema.index({ userId: 1 });
voucherRequestSchema.index({ status: 1 });

module.exports = mongoose.model('VoucherRequest', voucherRequestSchema);
