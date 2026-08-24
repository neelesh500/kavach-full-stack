const rateLimit = require('express-rate-limit');

// Rate limiting for auth routes (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

// Rate limiting for general API requests under high load
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests, please slow down.' }
});

module.exports = {
    authLimiter,
    apiLimiter
};
