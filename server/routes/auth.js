const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken, authenticateToken, createRateLimit } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth routes
const authRateLimit = createRateLimit(15 * 60 * 1000, 10, 'Too many authentication attempts');
const registerRateLimit = createRateLimit(60 * 60 * 1000, 5, 'Too many registration attempts');

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters long and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('fullName')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Full name is required and must be less than 100 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerRateLimit, registerValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, fullName, bio, fitnessGoals, gymName, location } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password, // Will be hashed by the pre-save middleware
      fullName,
      bio: bio || '',
      fitnessGoals: fitnessGoals || [],
      gymName: gymName || '',
      location: location || ''
    });

    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Return user data and tokens
    res.status(201).json({
      message: 'User registered successfully',
      user: user.getSafeUserData(),
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `${field} already exists` });
    }

    res.status(500).json({ error: 'Failed to register user' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authRateLimit, loginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'Login successful',
      user: user.getSafeUserData(),
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public (but requires refresh token)
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new tokens
    const accessToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user.getSafeUserData()
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// @route   PUT /api/auth/me
// @desc    Update current user info
// @access  Private
router.put('/me', authenticateToken, [
  body('fullName').optional().isLength({ min: 1, max: 100 }).trim(),
  body('bio').optional().isLength({ max: 500 }),
  body('fitnessGoals').optional().isArray(),
  body('gymName').optional().isLength({ max: 100 }),
  body('location').optional().isLength({ max: 100 }),
  body('isPrivate').optional().isBoolean()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { fullName, bio, fitnessGoals, gymName, location, isPrivate } = req.body;
    
    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName;
    if (bio !== undefined) updateFields.bio = bio;
    if (fitnessGoals !== undefined) updateFields.fitnessGoals = fitnessGoals;
    if (gymName !== undefined) updateFields.gymName = gymName;
    if (location !== undefined) updateFields.location = location;
    if (isPrivate !== undefined) updateFields.isPrivate = isPrivate;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: user.getSafeUserData()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client should remove token)
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a more sophisticated setup, you might maintain a blacklist of tokens
    // For now, we'll just send a success response
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
