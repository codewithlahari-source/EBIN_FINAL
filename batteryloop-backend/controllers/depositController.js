/**
 * controllers/depositController.js — Create deposits & get history.
 */
const Deposit = require('../models/Deposit');
const { calculatePoints } = require('../utils/points');
const { generateDepositCode } = require('../utils/code');

/**
 * POST /api/deposit
 * Body: { batteryCount, binId? }
 */
const createDeposit = async (req, res, next) => {
  try {
    const { batteryCount, binId } = req.body;
    const count = Number(batteryCount);

    if (!count || count <= 0 || count > 50) {
      return res.status(400).json({ success: false, error: 'Battery count must be 1–50' });
    }
    
    const targetBin = binId || 'BIN-01';

    // --- LOCK CHECK & CLEANUP ---
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    // 1. Expire any old pending deposits for this bin
    await Deposit.updateMany(
      { binId: targetBin, status: 'pending', timestamp: { $lt: fiveMinsAgo } },
      { $set: { status: 'expired', active: false } }
    );

    // 2. Check if bin is currently locked
    const activeLock = await Deposit.findOne({ binId: targetBin, status: 'pending' });
    if (activeLock) {
      if (activeLock.userId.toString() !== req.user._id.toString()) {
        return res.status(409).json({ success: false, error: 'This bin is currently locked by another user. Please wait or try again in a few minutes.' });
      }
      // If the current user already holds the lock, return their existing active deposit
      return res.status(200).json({
        success: true,
        deposit: {
          id: activeLock._id,
          batteryCount: activeLock.batteryCount,
          expectedPoints: activeLock.expectedPoints,
          pointsEarned: 0,
          generatedCode: activeLock.generatedCode,
          binId: activeLock.binId,
          status: activeLock.status,
          timestamp: activeLock.timestamp,
        },
        message: `You already have an active code! Drop ${activeLock.batteryCount} batteries with code ${activeLock.generatedCode}`,
      });
    }
    // ----------------------------

    const expectedPoints = calculatePoints(count);
    const generatedCode = await generateDepositCode();

    const deposit = await Deposit.create({
      userId: req.user._id,
      batteryCount: count,
      expectedPoints,
      generatedCode,
      binId: binId || 'BIN-01',
      status: 'pending',
      active: true,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      deposit: {
        id: deposit._id,
        batteryCount: deposit.batteryCount,
        expectedPoints: deposit.expectedPoints,
        pointsEarned: 0,
        generatedCode: deposit.generatedCode,
        binId: deposit.binId,
        status: deposit.status,
        timestamp: deposit.timestamp,
      },
      message: `Code generated! Drop ${count} batteries with code ${deposit.generatedCode}`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/deposits/history
 */
const getHistory = async (req, res, next) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    const total = await Deposit.countDocuments({ userId: req.user._id });
    const totalPointsEarned = deposits.reduce((sum, d) => sum + (d.pointsEarned || 0), 0);

    res.json({
      success: true,
      deposits: deposits.map((d) => ({
        id: d._id,
        batteryCount: d.batteryCount,
        pointsEarned: d.pointsEarned,
        expectedPoints: d.expectedPoints,
        generatedCode: d.generatedCode,
        status: d.status,
        active: d.active,
        confirmedCount: d.confirmedCount,
        timestamp: d.timestamp,
      })),
      total,
      totalPointsEarned,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/deposits/:depositId
 */
const getDeposit = async (req, res, next) => {
  try {
    const deposit = await Deposit.findOne({
      _id: req.params.depositId,
      userId: req.user._id,
    }).lean();

    if (!deposit) {
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    res.json({ success: true, deposit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/deposits/code/:code
 */
const getByCode = async (req, res, next) => {
  try {
    const deposit = await Deposit.findOne({ generatedCode: req.params.code }).lean();
    if (!deposit) {
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }
    res.json({
      success: true,
      deposit: {
        id: deposit._id,
        batteryCount: deposit.batteryCount,
        status: deposit.status,
        binId: deposit.binId,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createDeposit, getHistory, getDeposit, getByCode };
