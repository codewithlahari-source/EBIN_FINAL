/**
 * routes/deposits.js
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createDeposit, getHistory, getDeposit, getByCode } = require('../controllers/depositController');

router.post('/', protect, createDeposit);           // POST /api/deposit
router.get('/history', protect, getHistory);         // GET  /api/deposit/history
router.get('/code/:code', protect, getByCode);       // GET  /api/deposit/code/:code
router.get('/:depositId', protect, getDeposit);      // GET  /api/deposit/:depositId

module.exports = router;
