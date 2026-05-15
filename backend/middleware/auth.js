const jwt = require('jsonwebtoken');
const { redis } = require('../config/redis');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check Redis for session validity
    const session = await redis.get(`session:${decoded.sessionId}`);
    if (!session) return res.status(401).json({ error: 'Session expired' });

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const rateLimiter = async (req, res, next) => {
  const key = `ratelimit:${req.ip}:${req.path}`;
  const count = await redis.incr(key);
  
  if (count === 1) await redis.expire(key, 60); // 1 minute window
  
  if (count > 100) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  next();
};

module.exports = { authMiddleware, roleMiddleware, rateLimiter };
