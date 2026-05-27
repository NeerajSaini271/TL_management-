import Redis from 'ioredis';
import config from '../config/index.js';

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export async function connectRedis() {
  // redis ping
  await redis.ping();
  console.log('📦 Redis connected');
}

export default redis;
