/**
 * controllers/voucherController.js — Rewards store & redemptions.
 */
const Voucher = require('../models/Voucher');
const VoucherRequest = require('../models/VoucherRequest');
const User = require('../models/User');
const AssignedCoupon = require('../models/AssignedCoupon');
const { generateVoucherCode } = require('../utils/code');

const Coupon = require('../models/Coupon');

/**
 * GET /api/rewards — List all active rewards for the store.
 * Now dynamically fetches Coupons created by Admin!
 */
const listRewards = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    const tierCost = { bronze: 100, silver: 250, gold: 500 };

    res.json({
      success: true,
      rewards: coupons.map((c) => ({
        id: c._id,
        name: c.title,
        cost: tierCost[c.tier] || 100,
        value: c.code,
        desc: c.desc,
        icon: c.tier === 'gold' ? '🏆' : c.tier === 'silver' ? '🥈' : '🥉',
        imgDataUrl: c.imgDataUrl,
        category: c.tier,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rewards/redeem
 */
const redeemReward = async (req, res, next) => {
  try {
    const { rewardId } = req.body;
    if (!rewardId) return res.status(400).json({ success: false, error: 'rewardId is required' });

    const coupon = await Coupon.findById(rewardId);
    if (!coupon) return res.status(404).json({ success: false, error: 'Reward not found' });

    const tierCost = { bronze: 100, silver: 250, gold: 500 };
    const cost = tierCost[coupon.tier] || 100;

    const user = await User.findById(req.user._id);
    if (user.totalPoints < cost) {
      return res.status(400).json({ success: false, error: `Not enough points. Need ${cost}, have ${user.totalPoints}` });
    }

    // Deduct points
    user.totalPoints -= cost;
    await user.save();

    // Give them the admin's coupon code, or generate one if the admin left it blank
    const redeemCode = coupon.code ? coupon.code : await generateVoucherCode();

    // Create redemption record
    const redemption = await VoucherRequest.create({
      userId: user._id,
      voucherId: null, // Using Coupons now
      rewardName: coupon.title,
      cost: cost,
      redeemCode,
      status: 'approved',
      approvedAt: new Date(),
    });

    res.json({
      success: true,
      redemption: {
        id: redemption._id,
        rewardName: coupon.title,
        cost: cost,
        redeemCode,
        status: 'approved',
        createdAt: redemption.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/voucher-requests — User's redemption history.
 */
const getMyRedemptions = async (req, res, next) => {
  try {
    const requests = await VoucherRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      requests: requests.map((r) => ({
        id: r._id,
        rewardName: r.rewardName,
        cost: r.cost,
        redeemCode: r.redeemCode,
        status: r.status,
        createdAt: r.createdAt,
        requestedAt: r.requestedAt,
        approvedAt: r.approvedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rewards/my-coupons — Get admin-assigned coupons for current user.
 */
const getMyCoupons = async (req, res, next) => {
  try {
    const assigned = await AssignedCoupon.find({ userId: req.user._id })
      .sort({ assignedAt: -1 })
      .lean();

    res.json({
      success: true,
      coupons: assigned.map((a) => ({
        id: a._id,
        couponTitle: a.couponTitle,
        couponCode: a.couponCode,
        tier: a.tier,
        imgDataUrl: a.imgDataUrl,
        assignedAt: a.assignedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listRewards, redeemReward, getMyRedemptions, getMyCoupons };
