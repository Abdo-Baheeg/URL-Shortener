'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Url = require('../models/Url');

const signToken = (userId) =>
  jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── Sign Up ────────────────────────────────────────────────────────────────

exports.signup = async (req, res) => {
  try {
    const { email, password, name, guestId } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already in use.' });

    const user = await User.create({ email, password, name: name || '' });
    const token = signToken(user._id);

    // Claim any guest URLs into this new account
    let claimedCount = 0;
    if (guestId) {
      const result = await Url.updateMany(
        { guestId, userId: null },
        { $set: { userId: user._id, guestId: null } }
      );
      claimedCount = result.modifiedCount;
    }

    return res.status(201).json({
      success: true,
      data: { token, user, claimedUrls: claimedCount },
    });
  } catch (err) {
    console.error('[signup]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Login ──────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { email, password, guestId } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user._id);

    // Claim any guest URLs into this account
    let claimedCount = 0;
    if (guestId) {
      const result = await Url.updateMany(
        { guestId, userId: null },
        { $set: { userId: user._id, guestId: null } }
      );
      claimedCount = result.modifiedCount;
    }

    return res.json({
      success: true,
      data: { token, user, claimedUrls: claimedCount },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// ─── Get Current User ────────────────────────────────────────────────────────

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ success: true, data: { user } });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
