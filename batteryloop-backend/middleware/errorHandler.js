/**
 * middleware/errorHandler.js — Global Express error handler.
 */
const errorHandler = (err, req, res, _next) => {
  console.error('❌ Error:', err.message || err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
};

module.exports = { errorHandler };
