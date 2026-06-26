/**
 * server.js — BatteryLoop Express backend.
 *
 * Serves the API and also the frontend static files from ../frontend.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/mongodb');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

/* ─── Global middleware ─── */
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // large limit for image data URLs

/* ─── API routes ─── */
app.use('/auth',              require('./routes/auth'));
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/deposit',       require('./routes/deposits'));
app.use('/api/deposits',      require('./routes/deposits'));
app.use('/api/sensor-data',   require('./routes/sensor'));
app.use('/api/rewards',       require('./routes/rewards'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/claim-drop-code', require('./routes/claim'));
app.use('/api/health',        require('./routes/health'));

/* ─── Serve frontend static files ─── */
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return res.status(404).json({ success: false, error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

/* ─── Error handler ─── */
app.use(errorHandler);

/* ─── Start ─── */
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🔋 BatteryLoop server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

start();
