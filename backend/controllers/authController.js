const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const authStore = require('../services/authStore');
const LoginAudit = require('../models/LoginAudit');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
};

const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Sri Vaishnavi Jewellers Login Verification',
      text: `Dear User,\n\nYour OTP for login is:\n\n${otp}\n\nThis OTP is valid for 5 minutes.\n\nDo not share this OTP.\n\nSri Vaishnavi Jewellers`,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending OTP Email:', error);
    // Even if email fails, log to console for debugging/testing
    console.log(`\n\n=== LOGIN OTP ===\nEmail: ${email}\nOTP: ${otp}\n=================\n\n`);
    return false;
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const device = req.headers['user-agent'] || 'Unknown';

    console.log(`[AUTH] Login attempt | email=${email} ip=${ipAddress}`);

    if (!email || !password) {
      console.log(`[AUTH] Missing credentials | email=${email}`);
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const identifier = `${ipAddress}_${email.toLowerCase()}`;
    if (authStore.isRateLimited(identifier)) {
      console.log(`[AUTH] Rate limited | identifier=${identifier}`);
      return res.status(429).json({ success: false, message: 'Too many attempts. Locked out for 15 minutes.' });
    }

    const user = authStore.getUserByEmail(email);

    if (!user) {
      console.log(`[AUTH] Unknown email | email=${email}`);
      try { await LoginAudit.create({ email, ipAddress, device, status: 'Failed - Unauthorized Email' }); } catch (_) {}
      authStore.incrementRateLimit(identifier);
      return res.status(401).json({ success: false, message: 'User not authorized' });
    }

    const isMatch = await authStore.verifyPassword(password, user.password);
    console.log(`[AUTH] Password check | email=${email} match=${isMatch}`);
    if (!isMatch) {
      try { await LoginAudit.create({ email, ipAddress, device, status: 'Failed - Invalid Password' }); } catch (_) {}
      authStore.incrementRateLimit(identifier);
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    // Passwords match -> Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    authStore.setOtp(email, otp);
    console.log(`[AUTH] OTP generated | email=${email}`);

    await sendOTPEmail(user.email, otp);

    return res.status(200).json({
      success: true,
      message: 'OTP Sent. Requires OTP verification.',
      requires_otp: true,
      email: user.email
    });
  } catch (error) {
    console.error('[AUTH] Login Error:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const device = req.headers['user-agent'] || 'Unknown';

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const identifier = `${ipAddress}_${email.toLowerCase()}`;
    if (authStore.isRateLimited(identifier)) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Locked out for 15 minutes.' });
    }

    const result = authStore.verifyOtp(email, otp);
    if (!result.success) {
      await LoginAudit.create({ email, ipAddress, device, status: 'Failed - Invalid OTP' });
      authStore.incrementRateLimit(identifier);
      return res.status(401).json({ success: false, message: result.message });
    }

    // Success
    const user = authStore.getUserByEmail(email);
    authStore.clearRateLimit(identifier);
    await LoginAudit.create({ email, ipAddress, device, status: 'Success' });

    const token = generateToken(user.id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Verify OTP Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    // req.user is set by authMiddleware
    return res.status(200).json({ success: true, user: req.user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { login, verifyOtp, getProfile };
