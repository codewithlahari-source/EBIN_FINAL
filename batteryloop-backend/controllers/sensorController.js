/**
 * controllers/sensorController.js — NodeMCU / bin sensor integration.
 *
 * When the bin confirms a deposit, this endpoint:
 *  1. Finds the pending deposit (by code or by binId)
 *  2. Marks it "verified"
 *  3. Credits points to the user
 *  4. Updates bin metrics
 *  5. Logs the sensor event
 */
const Deposit = require('../models/Deposit');
const User = require('../models/User');
const BinMetrics = require('../models/BinMetrics');
const SensorEvent = require('../models/SensorEvent');
const { calculatePoints } = require('../utils/points');

/**
 * POST /api/sensor-data
 * Body: { depositCode?, binId, detectedCount, deviceId? }
 *
 * The frontend simulate button sends { binId, detectedCount, deviceId }.
 * The NodeMCU sends { depositCode, confirmedCount, binId }.
 * We handle both shapes.
 */
const confirmDeposit = async (req, res, next) => {
  try {
    const { depositCode, binId, detectedCount, confirmedCount, deviceId } = req.body;
    const count = Number(detectedCount || confirmedCount || 0);
    const bin = binId || 'BIN-01';

    // Find the deposit to verify
    let deposit;
    if (depositCode) {
      deposit = await Deposit.findOne({ generatedCode: depositCode, status: 'pending' });
    } else {
      // Find most recent pending deposit for this bin
      deposit = await Deposit.findOne({ binId: bin, status: 'pending' }).sort({ timestamp: -1 });
    }

    if (!deposit) {
      return res.status(404).json({ success: false, error: 'No pending deposit found' });
    }

    // Calculate points based on the confirmed count (or original battery count)
    const confirmedBatteries = count || deposit.batteryCount;
    const pointsEarned = calculatePoints(confirmedBatteries);

    // Update deposit
    deposit.status = 'verified';
    deposit.active = false;
    deposit.confirmedCount = confirmedBatteries;
    deposit.pointsEarned = pointsEarned;
    deposit.confirmedAt = new Date();
    await deposit.save();

    // Credit points to user
    await User.findByIdAndUpdate(deposit.userId, {
      $inc: {
        totalPoints: pointsEarned,
        totalDeposits: 1,
        totalGrams: confirmedBatteries * 25, // ~25g per battery estimate
      },
    });

    // Update bin metrics (upsert)
    const binMetrics = await BinMetrics.findOneAndUpdate(
      { binId: bin },
      {
        $inc: { currentBatteries: confirmedBatteries, totalDeposits: 1 },
        $set: { lastDepositAt: new Date() },
      },
      { upsert: true, new: true }
    );
    // Recalculate fill percentage
    binMetrics.fillPercentage = Math.min(
      100,
      Math.round((binMetrics.currentBatteries / binMetrics.maxCapacity) * 100)
    );
    await binMetrics.save();

    // Log sensor event
    await SensorEvent.create({
      binId: bin,
      depositId: deposit._id,
      depositCode: deposit.generatedCode,
      detectedCount: confirmedBatteries,
      deviceId: deviceId || 'unknown',
      receivedAt: new Date(),
    });

    res.json({
      success: true,
      pointsCredited: pointsEarned,
      deposit: {
        id: deposit._id,
        status: 'verified',
        confirmedCount: confirmedBatteries,
        pointsEarned,
      },
      binUpdate: {
        currentBatteries: binMetrics.currentBatteries,
        fillPercentage: binMetrics.fillPercentage,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/sensor-data/status/:depositCode
 */
const getDepositStatus = async (req, res, next) => {
  try {
    const deposit = await Deposit.findOne({ generatedCode: req.params.depositCode }).lean();
    if (!deposit) {
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }
    res.json({
      success: true,
      status: deposit.status,
      batteryCount: deposit.batteryCount,
      binId: deposit.binId,
    });
  } catch (err) {
    next(err);
  }
};

const getPendingByBin = async (req, res, next) => {
  try {
    const deposit = await Deposit.findOne({ binId: req.params.binId, status: 'pending' }).sort({ timestamp: -1 }).lean();
    if (!deposit) {
      return res.json({ success: true, hasPending: false });
    }
    res.json({
      success: true,
      hasPending: true,
      targetCount: deposit.batteryCount,
      depositCode: deposit.generatedCode
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { confirmDeposit, getDepositStatus, getPendingByBin };
