/**
 * routes/admin.js — All admin-only endpoints.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const admin = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

router.get('/check',                  admin.checkAdmin);

// Users
router.get('/users',                  admin.getUsers);

// Drops (verified deposits)
router.get('/drops',                  admin.getDrops);

// All deposits (admin view)
router.get('/deposits',               admin.getAllDeposits);

// Coupons CRUD
router.get('/coupons',                admin.getCoupons);
router.post('/coupons',               admin.createCoupon);
router.patch('/coupons/:id',          admin.updateCoupon);
router.delete('/coupons/:id',         admin.deleteCoupon);

// Assigned coupons
router.get('/assigned',               admin.getAssigned);
router.post('/assigned',              admin.assignCoupon);

// Bin metrics
router.get('/bins',                   admin.getBins);
router.get('/bin-metrics',            admin.getBins);
router.get('/bin-metrics/:binId',     admin.getBinMetrics);
router.put('/bin-metrics/:binId',     admin.updateBinCapacity);
router.post('/bins/:binId/empty',     admin.emptyBin);
router.post('/reset-bin',             admin.emptyBin);

// Sensor events (serial monitor)
router.get('/sensor-events',          admin.getSensorEvents);

// Voucher request approval
router.get('/voucher-requests',       admin.getPendingVoucherRequests);
router.post('/approve-voucher',       admin.approveVoucher);
router.post('/deny-voucher',          admin.denyVoucher);

module.exports = router;
