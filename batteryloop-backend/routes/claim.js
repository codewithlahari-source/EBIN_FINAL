/**
 * routes/claim.js — Bin-first claim flow.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { claimDropCode } = require('../controllers/claimController');

router.post('/', protect, claimDropCode);  // POST /api/claim-drop-code

module.exports = router;
