const bcrypt = require('bcryptjs');

let users = [];

const loadUsers = () => {
  users = [];
  const maxUsers = parseInt(process.env.MAX_USERS || '10', 10);
  
  for (let i = 1; i <= maxUsers; i++) {
    const email = process.env[`USER${i}_EMAIL`];
    const passwordHash = process.env[`USER${i}_PASSWORD`];
    const role = process.env[`USER${i}_ROLE`] || 'Staff';
    const name = process.env[`USER${i}_NAME`] || `User ${i}`;
    
    if (email && passwordHash) {
      users.push({
        id: `ENV_USER_${i}`,
        email: email.toLowerCase().trim(),
        password: passwordHash,
        role: role,
        name: name
      });
    }
  }
  console.log(`Loaded ${users.length} users from environment configuration.`);
};

const getUserByEmail = (email) => {
  return users.find(u => u.email === email.toLowerCase().trim());
};

const getUserById = (id) => {
  return users.find(u => u.id === id);
};

const verifyPassword = async (enteredPassword, storedHash) => {
  return await bcrypt.compare(enteredPassword, storedHash);
};

// Memory store for OTPs
const otpCache = new Map();

const setOtp = (email, otp) => {
  otpCache.set(email.toLowerCase(), {
    otp: otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  });
};

const verifyOtp = (email, enteredOtp) => {
  const record = otpCache.get(email.toLowerCase());
  if (!record) return { success: false, message: 'Invalid or expired OTP' };
  
  if (record.expiresAt < Date.now()) {
    otpCache.delete(email.toLowerCase());
    return { success: false, message: 'OTP expired' };
  }
  
  if (record.otp !== enteredOtp) {
    return { success: false, message: 'Invalid OTP' };
  }
  
  // Valid OTP
  otpCache.delete(email.toLowerCase());
  return { success: true };
};

// Simple memory store for OTP request limits (Max 3 attempts per IP/Email)
// This is basic and resets on server restart, sufficient for requirements
const rateLimitMap = new Map();
const isRateLimited = (identifier) => {
  const record = rateLimitMap.get(identifier);
  if (!record) return false;
  if (record.attempts >= 3) {
    if (Date.now() - record.lastAttempt < 15 * 60 * 1000) {
      return true; // Locked for 15 mins
    } else {
      rateLimitMap.delete(identifier);
      return false;
    }
  }
  return false;
};

const incrementRateLimit = (identifier) => {
  const record = rateLimitMap.get(identifier) || { attempts: 0, lastAttempt: Date.now() };
  record.attempts += 1;
  record.lastAttempt = Date.now();
  rateLimitMap.set(identifier, record);
};

const clearRateLimit = (identifier) => {
  rateLimitMap.delete(identifier);
};

module.exports = {
  loadUsers,
  getUserByEmail,
  getUserById,
  verifyPassword,
  setOtp,
  verifyOtp,
  isRateLimited,
  incrementRateLimit,
  clearRateLimit
};
