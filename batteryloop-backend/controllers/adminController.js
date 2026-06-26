/**
 * controllers/adminController.js — Admin-only endpoints.
 */
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Coupon = require('../models/Coupon');
const AssignedCoupon = require('../models/AssignedCoupon');
const BinMetrics = require('../models/BinMetrics');
const SensorEvent = require('../models/SensorEvent');
const Voucher = require('../models/Voucher');
const VoucherRequest = require('../models/VoucherRequest');
const { generateVoucherCode } = require('../utils/code');

/* ─── Admin check ─── */
const checkAdmin = (req, res) => {
  res.json({ success: true, admin: true });
};

/* ─── Users ─── */
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ totalPoints: -1 }).lean();
    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        fname: u.name,
        email: u.email,
        pts: u.totalPoints,
        drops: u.totalDeposits,
        grams: u.totalGrams || 0,
        dept: '',
        year: '',
        role: u.role,
        phone: '',
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/* ─── Drops (all verified deposits) ─── */
const getDrops = async (req, res, next) => {
  try {
    const deposits = await Deposit.find({ status: 'verified' })
      .sort({ confirmedAt: -1 })
      .limit(200)
      .populate('userId', 'name email')
      .lean();

    res.json({
      success: true,
      drops: deposits.map((d) => ({
        id: d._id,
        code: d.generatedCode,
        name: d.userId?.name || 'Unknown',
        email: d.userId?.email || '',
        dept: '',
        batteryCount: d.batteryCount,
        grams: (d.confirmedCount || d.batteryCount) * 25,
        pts: d.pointsEarned,
        time: d.confirmedAt || d.timestamp,
        status: d.status,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/* ─── All deposits (for admin view) ─── */
const getAllDeposits = async (req, res, next) => {
  try {
    const deposits = await Deposit.find()
      .sort({ timestamp: -1 })
      .limit(200)
      .populate('userId', 'name email')
      .lean();

    const total = await Deposit.countDocuments();
    const totalBatteriesCollected = await Deposit.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: null, total: { $sum: '$confirmedCount' } } },
    ]);

    res.json({
      success: true,
      deposits: deposits.map((d) => ({
        id: d._id,
        userName: d.userId?.name || 'Unknown',
        batteryCount: d.batteryCount,
        pointsEarned: d.pointsEarned,
        status: d.status,
        timestamp: d.timestamp,
      })),
      total,
      totalBatteriesCollected: totalBatteriesCollected[0]?.total || 0,
    });
  } catch (err) {
    next(err);
  }
};

/* ─── Coupons CRUD ─── */
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      coupons: coupons.map((c) => ({
        id: c._id,
        title: c.title,
        tier: c.tier,
        code: c.code,
        desc: c.desc,
        expiry: c.expiry,
        imgDataUrl: c.imgDataUrl,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

const createCoupon = async (req, res, next) => {
  try {
    const { title, tier, code, desc, expiry, imgDataUrl } = req.body;
    if (!title || !tier) {
      return res.status(400).json({ success: false, error: 'Title and tier are required' });
    }
    const coupon = await Coupon.create({ title, tier, code: code || '', desc, expiry, imgDataUrl });
    res.status(201).json({ success: true, coupon: { id: coupon._id, ...coupon.toObject() } });
  } catch (err) {
    next(err);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.code !== undefined) updates.code = req.body.code;
    if (req.body.imgDataUrl !== undefined) updates.imgDataUrl = req.body.imgDataUrl;
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.desc !== undefined) updates.desc = req.body.desc;
    if (req.body.tier !== undefined) updates.tier = req.body.tier;
    if (req.body.expiry !== undefined) updates.expiry = req.body.expiry;

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!coupon) return res.status(404).json({ success: false, error: 'Coupon not found' });
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, error: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
};

/* ─── Assigned Coupons ─── */
const getAssigned = async (req, res, next) => {
  try {
    const assigned = await AssignedCoupon.find().sort({ assignedAt: -1 }).lean();
    res.json({
      success: true,
      assigned: assigned.map((a) => ({
        id: a._id,
        couponId: a.couponId,
        userId: a.userId,
        userName: a.userName,
        userDept: a.userDept,
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

const assignCoupon = async (req, res, next) => {
  try {
    const { couponId, userId, userName, userDept, couponTitle, couponCode, tier, imgDataUrl } = req.body;
    if (!couponId || !userId) {
      return res.status(400).json({ success: false, error: 'couponId and userId are required' });
    }
    const assigned = await AssignedCoupon.create({
      couponId, userId, userName, userDept,
      couponTitle, couponCode, tier, imgDataUrl,
      assignedAt: new Date(),
    });
    res.status(201).json({ success: true, assigned: { id: assigned._id, ...assigned.toObject() } });
  } catch (err) {
    next(err);
  }
};

/* ─── Bin Metrics ─── */
const getBins = async (req, res, next) => {
  try {
    let bins = await BinMetrics.find().lean();
    if (!bins.length) {
      // Create a default bin
      const defaultBin = await BinMetrics.create({ binId: 'BIN-01', maxCapacity: 100 });
      bins = [defaultBin.toObject()];
    }
    res.json({
      success: true,
      bins: bins.map((b) => ({
        binId: b.binId,
        batteries: b.currentBatteries,
        max: b.maxCapacity,
        fillPercent: b.fillPercentage,
        deposits: b.totalDeposits,
        lastAt: b.lastDepositAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

const getBinMetrics = async (req, res, next) => {
  try {
    let bin = await BinMetrics.findOne({ binId: req.params.binId || 'BIN-01' }).lean();
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    res.json({
      success: true,
      binMetrics: {
        binId: bin.binId,
        currentBatteries: bin.currentBatteries,
        maxCapacity: bin.maxCapacity,
        fillPercentage: bin.fillPercentage,
        status: bin.fillPercentage >= 80 ? 'full' : bin.fillPercentage >= 50 ? 'half' : 'partial',
        lastDepositAt: bin.lastDepositAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

const updateBinCapacity = async (req, res, next) => {
  try {
    const { maxCapacity } = req.body;
    const bin = await BinMetrics.findOneAndUpdate(
      { binId: req.params.binId },
      { maxCapacity },
      { new: true }
    );
    if (!bin) return res.status(404).json({ success: false, error: 'Bin not found' });
    bin.fillPercentage = Math.round((bin.currentBatteries / bin.maxCapacity) * 100);
    await bin.save();
    res.json({ success: true, message: `Max capacity updated to ${maxCapacity}` });
  } catch (err) {
    next(err);
  }
};

const emptyBin = async (req, res, next) => {
  try {
    const bin = await BinMetrics.findOneAndUpdate(
      { binId: req.params.binId },
      { currentBatteries: 0, fillPercentage: 0, lastResetAt: new Date() },
      { new: true }
    );
    if (!bin) return res.status(404).json({ success: false, error: 'Bin not found' });
    res.json({
      success: true,
      message: `Bin reset. Current: 0/${bin.maxCapacity}`,
      binMetrics: { currentBatteries: 0, fillPercentage: 0 },
    });
  } catch (err) {
    next(err);
  }
};

/* ─── Sensor Events (for admin serial monitor) ─── */
const getSensorEvents = async (req, res, next) => {
  try {
    const events = await SensorEvent.find().sort({ receivedAt: -1 }).limit(100).lean();
    res.json({
      success: true,
      events: events.map((e) => ({
        id: e._id,
        binId: e.binId,
        code: e.depositCode,
        detectedCount: e.detectedCount,
        deviceId: e.deviceId,
        receivedAt: e.receivedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/* ─── Voucher Request Approval (from spec) ─── */
const getPendingVoucherRequests = async (req, res, next) => {
  try {
    const requests = await VoucherRequest.find({ status: 'pending' })
      .populate('userId', 'name email totalPoints')
      .populate('voucherId', 'name pointsCost')
      .sort({ requestedAt: -1 })
      .lean();

    res.json({
      success: true,
      requests: requests.map((r) => ({
        id: r._id,
        userId: r.userId?._id,
        userName: r.userId?.name || 'Unknown',
        userEmail: r.userId?.email || '',
        voucherId: r.voucherId?._id,
        voucherName: r.voucherId?.name || r.rewardName,
        pointsCost: r.voucherId?.pointsCost || r.cost,
        userTotalPoints: r.userId?.totalPoints || 0,
        canApprove: (r.userId?.totalPoints || 0) >= (r.voucherId?.pointsCost || r.cost),
        requestedAt: r.requestedAt,
      })),
      total: requests.length,
    });
  } catch (err) {
    next(err);
  }
};

const approveVoucher = async (req, res, next) => {
  try {
    const { requestId } = req.body;
    const request = await VoucherRequest.findById(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ success: false, error: 'Request not found or already processed' });
    }

    const user = await User.findById(request.userId);
    if (!user || user.totalPoints < request.cost) {
      return res.status(400).json({ success: false, error: 'Insufficient points' });
    }

    // Deduct points
    user.totalPoints -= request.cost;
    await user.save();

    // Update request
    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedBy = req.user._id;
    const vCode = await generateVoucherCode();
    request.redeemCode = vCode;
    await request.save();

    res.json({
      success: true,
      message: 'Voucher approved and granted to user',
      activeVoucher: {
        id: request._id,
        voucherCode: vCode,
        userId: request.userId,
        createdAt: request.approvedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

const denyVoucher = async (req, res, next) => {
  try {
    const { requestId, reason } = req.body;
    const request = await VoucherRequest.findById(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ success: false, error: 'Request not found or already processed' });
    }
    request.status = 'denied';
    request.reason = reason || '';
    await request.save();
    res.json({ success: true, message: 'Voucher request denied' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkAdmin,
  getUsers,
  getDrops,
  getAllDeposits,
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  getAssigned, assignCoupon,
  getBins, getBinMetrics, updateBinCapacity, emptyBin,
  getSensorEvents,
  getPendingVoucherRequests, approveVoucher, denyVoucher,
};
