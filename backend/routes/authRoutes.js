const express = require('express');
const router = express.Router();
const { login, verifyOtp, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.get('/profile', protect, getProfile);

module.exports = router;
