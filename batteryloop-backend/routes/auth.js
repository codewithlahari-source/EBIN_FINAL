/**
 * routes/auth.js
 */
const express = require('express');
const router = express.Router();
const { googleLogin, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// POST /auth/google — exchange Google credential for JWT
router.post('/google', googleLogin);

// GET /api/auth/me — get current user profile
router.get('/me', protect, getMe);

// POST /api/auth/sync — legacy endpoint (frontend calls it on login)
// Simply returns user profile — the real upsert happens in /auth/google
router.post('/sync', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      totalPoints: req.user.totalPoints,
      role: req.user.role,
    },
  });
});

module.exports = router;
