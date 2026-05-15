const { Redis } = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

redis.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('✗ Redis error:', err.message);
});

// Cache helper functions
const cache = {
  async get(key) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },
  
  async set(key, value, ttl = 3600) {
    await redis.setex(key, ttl, JSON.stringify(value));
  },
  
  async del(key) {
    await redis.del(key);
  },
  
  async increment(key) {
    return await redis.incr(key);
  }
};

module.exports = { redis, cache };
