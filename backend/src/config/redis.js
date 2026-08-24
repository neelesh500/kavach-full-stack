const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

let redisClient = null;

if (env.redis.url) {
    redisClient = new Redis(env.redis.url);

    redisClient.on('connect', () => logger.info('Redis connection established.'));
    redisClient.on('error', (err) => logger.error('Redis connection error:', err));
} else {
    logger.info('No REDIS_URL provided, skipping Redis configuration.');
}

module.exports = redisClient;
