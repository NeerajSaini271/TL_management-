import Redis from 'ioredis';
import config from '../config/index.js';

var redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: function(times) { return null; }
});

redis.on('error', function(err) {
  console.warn('Redis unavailable (non-critical):', err.message);
});

export async function connectRedis() {
  try { await redis.connect(); await redis.ping(); }
  catch(e) { console.warn('Redis skipped - running without cache/blacklist'); }
}

export default redis;
