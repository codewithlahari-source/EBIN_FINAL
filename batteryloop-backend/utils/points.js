/**
 * utils/points.js — Points calculation from battery count.
 */
const calculatePoints = (batteryCount) => {
  if (batteryCount >= 1 && batteryCount <= 2) return 10;
  if (batteryCount >= 3 && batteryCount <= 5) return 25;
  if (batteryCount >= 6 && batteryCount <= 10) return 60;
  if (batteryCount > 10) return 100;
  return 0;
};

module.exports = { calculatePoints };
