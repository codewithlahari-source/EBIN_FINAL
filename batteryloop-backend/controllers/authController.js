/**
 * controllers/authController.js — Google login via Firebase ID token.
 *
 * Frontend uses Firebase Auth popup for Google sign-in, then sends the
 * Firebase ID token here. We verify it with Firebase Admin SDK,
 * upsert the user in MongoDB, and return our own JWT.
 */
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');

// Initialize Firebase Admin (no service account needed — we only verify tokens)
if (!getApps().length) {
  initializeApp({
    projectId: 'ebin-1',
  });
}

/**
 * POST /auth/google
 * Body: { credential: "<Firebase ID token>" }
 */
const googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Credential is required' });
    }

    // Verify the Firebase ID token
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(credential);
    } catch (verifyErr) {
      return res.status(401).json({ success: false, error: 'Invalid token: ' + verifyErr.message });
    }

    const { uid: googleId, email, name, picture } = decoded;

    // Find or create user in MongoDB
    let user = await User.findOne({ email });
    if (!user && googleId) {
      user = await User.findOne({ googleId });
    }
    
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());

    const role = adminEmails.includes((email || '').toLowerCase()) ? 'admin' : 'user';

    if (user) {
      user.googleId = googleId; // Update googleId in case they switched Firebase projects
      user.name = name || user.name;
      user.profilePicture = picture || user.profilePicture;
      user.role = role; // Update role in case they were added to admins later
      await user.save();
    } else {
      const role = adminEmails.includes((email || '').toLowerCase()) ? 'admin' : 'user';
      user = await User.create({
        googleId,
        email: email || `${googleId}@firebase.user`,
        name: name || email?.split('@')[0] || 'User',
        profilePicture: picture || '',
        role,
      });
    }

    // Sign our own JWT
    const token = signToken({ userId: user._id, email: user.email, role: user.role });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        totalPoints: user.totalPoints,
        totalDeposits: user.totalDeposits,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    user: {
      id: u._id,
      email: u.email,
      name: u.name,
      profilePicture: u.profilePicture,
      totalPoints: u.totalPoints,
      totalDeposits: u.totalDeposits,
      totalGrams: u.totalGrams,
      role: u.role,
    },
  });
};

module.exports = { googleLogin, getMe };
