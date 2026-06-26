/**
 * models/AssignedCoupon.js — Coupons assigned by admin to specific users.
 */
const mongoose = require('mongoose');

const assignedCouponSchema = new mongoose.Schema({
  couponId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, default: '' },
  userDept:    { type: String, default: '' },
  couponTitle: { type: String, default: '' },
  couponCode:  { type: String, default: '' },
  tier:        { type: String, default: '' },
  imgDataUrl:  { type: String, default: '' },
  assignedAt:  { type: Date, default: Date.now },
});

assignedCouponSchema.index({ userId: 1 });
assignedCouponSchema.index({ couponId: 1 });

module.exports = mongoose.model('AssignedCoupon', assignedCouponSchema);
