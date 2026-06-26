/**
 * models/Coupon.js — Admin-created coupons (tier-based, assigned to users).
 */
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  tier:       { type: String, enum: ['bronze', 'silver', 'gold'], required: true },
  code:       { type: String, default: '' },
  desc:       { type: String, default: '' },
  expiry:     { type: String, default: '' },
  imgDataUrl: { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Coupon', couponSchema);
