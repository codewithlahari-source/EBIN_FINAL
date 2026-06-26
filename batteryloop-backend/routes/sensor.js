/**
 * routes/sensor.js
 */
const express = require('express');
const router = express.Router();
const { confirmDeposit, getDepositStatus, getPendingByBin } = require('../controllers/sensorController');

// POST /api/sensor-data — NodeMCU / simulator confirms deposit
// No auth required for sensor (hardware uses shared endpoint)
router.post('/', confirmDeposit);

// GET /api/sensor-data/status/:depositCode
router.get('/status/:depositCode', getDepositStatus);

// GET /api/sensor-data/pending/:binId
router.get('/pending/:binId', getPendingByBin);

module.exports = router;
