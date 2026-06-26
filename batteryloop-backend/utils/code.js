/**
 * utils/code.js — Unique code generators for deposits & vouchers.
 */
const Deposit = require('../models/Deposit');
const ActiveVoucher = require('../models/ActiveVoucher');

/**
 * Generate a deposit code: "BAT" + 4 random digits.
 * Ensures uniqueness against the database.
 */
const generateDepositCode = async () => {
  let code;
  let exists = true;
  while (exists) {
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    code = `BAT${digits}`;
    exists = await Deposit.findOne({ generatedCode: code });
  }
  return code;
};

/**
 * Generate a voucher code: "VC" + 5 random alphanumeric chars.
 */
const generateVoucherCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let exists = true;
  while (exists) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    code = `VC${suffix}`;
    exists = await ActiveVoucher.findOne({ voucherCode: code });
  }
  return code;
};

/**
 * Generate a 4-digit drop code (for bin-first flow).
 */
const generateDropCode = () => {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
};

module.exports = { generateDepositCode, generateVoucherCode, generateDropCode };
