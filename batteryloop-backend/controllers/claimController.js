/**
 * controllers/claimController.js — Bin-first "claim drop code" flow.
 *
 * The bin generates a 4-digit code on its display after detecting a battery drop.
 * The user reads the code and enters it on the dashboard to claim points.
 */
const DropCode = require('../models/DropCode');
const User = require('../models/User');

/**
 * POST /api/claim-drop-code
 * Body: { code: "1234" }
 */
const claimDropCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{4}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Enter a valid 4-digit code' });
    }

    const dropCode = await DropCode.findOne({ code, status: 'available' });
    if (!dropCode) {
      return res.status(404).json({ success: false, error: 'Code not found or already claimed' });
    }

    // Mark as claimed
    dropCode.status = 'claimed';
    dropCode.claimedBy = req.user._id;
    await dropCode.save();

    // Credit points
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalPoints: dropCode.pts, totalDeposits: 1 },
    });

    res.json({
      success: true,
      pointsCredited: dropCode.pts,
      message: `+${dropCode.pts} points claimed!`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { claimDropCode };
