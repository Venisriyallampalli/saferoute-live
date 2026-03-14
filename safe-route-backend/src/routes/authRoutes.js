const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ sub: userId.toString() }, secret, { expiresIn });
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPhoneValid(phone) {
  return /^\+?[0-9\s()-]{7,20}$/.test(phone);
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone and password are required' });
    }

    if (!isEmailValid(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!isPhoneValid(phone.trim())) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      passwordHash,
    });

    const token = signToken(user._id);

    return res.status(201).json({
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register user' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.status(200).json({ user: req.user.toPublicJSON() });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isEmailValid(email)) {
      return res.status(200).json({ message: 'If that email exists, a reset link has been generated' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(200).json({ message: 'If that email exists, a reset link has been generated' });
    }

    await PasswordResetToken.deleteMany({ userId: user._id, used: false });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      used: false,
    });

    if (process.env.NODE_ENV !== 'production') {
      return res.status(200).json({
        message: 'Reset token generated (development mode)',
        resetToken: rawToken,
      });
    }

    return res.status(200).json({ message: 'If that email exists, a reset link has been generated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to start password reset' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await PasswordResetToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetToken) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    resetToken.used = true;
    await resetToken.save();

    await PasswordResetToken.deleteMany({ userId: user._id, used: false });

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password' });
  }
});

module.exports = router;
