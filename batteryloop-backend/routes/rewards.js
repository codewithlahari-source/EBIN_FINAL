/**
 * routes/rewards.js — Voucher/reward store routes.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { listRewards, redeemReward, getMyRedemptions, getMyCoupons } = require('../controllers/voucherController');

router.get('/', listRewards);                       // GET  /api/rewards
router.post('/redeem', protect, redeemReward);       // POST /api/rewards/redeem
router.get('/redemptions', protect, getMyRedemptions); // GET  /api/rewards/redemptions
router.get('/my-coupons', protect, getMyCoupons);    // GET  /api/rewards/my-coupons

module.exports = router;
