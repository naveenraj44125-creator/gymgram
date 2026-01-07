const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user) {
      // Update last active timestamp
      user.lastActive = new Date();
      await user.save();
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d' // Token expires in 7 days
  });
};

// Generate refresh token (longer expiration)
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d' // Refresh token expires in 30 days
  });
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Middleware to check if user owns the resource
const checkResourceOwnership = (resourceField = 'user') => {
  return (req, res, next) => {
    // This middleware should be used after authenticateToken
    // and after the resource is loaded into req (e.g., req.post, req.comment)
    
    const resource = req[resourceField.split('.')[0]]; // e.g., 'post' from 'post.user'
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const resourceUserId = resourceField.includes('.') 
      ? resource[resourceField.split('.')[1]].toString()
      : resource.toString();

    if (resourceUserId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied - not the owner' });
    }

    next();
  };
};

// Middleware to check if user is admin (for future admin features)
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Rate limiting for sensitive operations
const createRateLimit = (windowMs, max, message) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();
    
    // Clean up old entries
    const cutoff = now - windowMs;
    for (const [key, timestamps] of requests.entries()) {
      requests.set(key, timestamps.filter(time => time > cutoff));
      if (requests.get(key).length === 0) {
        requests.delete(key);
      }
    }
    
    // Check current user's requests
    const userRequests = requests.get(userId) || [];
    
    if (userRequests.length >= max) {
      return res.status(429).json({ error: message || 'Too many requests' });
    }
    
    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  checkResourceOwnership,
  requireAdmin,
  createRateLimit
};
