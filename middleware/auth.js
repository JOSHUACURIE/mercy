// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ✅ Protect middleware (requires valid token)
exports.protect = async (req, res, next) => {
  let token;

  try {
    // Check for Bearer token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1]; // extract token
    }

    if (!token) {
      return res.status(401).json({ msg: 'Not authorized, no token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (without password)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ msg: 'User not found, invalid token' });
    }

    next();
  } catch (err) {
    console.error('❌ Auth error:', err.message);
    return res.status(401).json({ msg: 'Not authorized, token failed' });
  }
};

// ✅ Role-based middleware
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Admin access only' });
  }
  next();
};

exports.isDoctor = (req, res, next) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({ msg: 'Doctor access only' });
  }
  next();
};

exports.isPatient = (req, res, next) => {
  if (!req.user || req.user.role !== 'patient') {
    return res.status(403).json({ msg: 'Patient access only' });
  }
  next();
};
