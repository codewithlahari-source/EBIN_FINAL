/**
 * models/User.js
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId:       { type: String, unique: true, required: true },
  email:          { type: String, unique: true, required: true },
  name:           { type: String, required: true },
  profilePicture: { type: String, default: '' },
  totalPoints:    { type: Number, default: 0 },
  totalDeposits:  { type: Number, default: 0 },
  totalGrams:     { type: Number, default: 0 },
  role:           { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

// Indexes created automatically by unique: true on schema fields

module.exports = mongoose.model('User', userSchema);
