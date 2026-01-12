const jwt = require('jsonwebtoken');
const { supabase } = require('../services/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Optional auth - doesn't fail if no token
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
}

// Check if user is admin
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', req.user.userId)
    .single();

  if (!user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Check subscription status
async function requireSubscription(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { data: user } = await supabase
    .from('users')
    .select('subscription_status, subscription_end')
    .eq('id', req.user.userId)
    .single();

  const isActive = user?.subscription_status === 'active' &&
    (!user.subscription_end || new Date(user.subscription_end) > new Date());

  if (!isActive) {
    return res.status(403).json({ error: 'Active subscription required' });
  }

  req.subscription = { active: true };
  next();
}

// Generate JWT token
function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireSubscription,
  generateToken,
};
