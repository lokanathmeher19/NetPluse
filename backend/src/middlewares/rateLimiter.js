const rateLimit = require('express-rate-limit');

// DDoS & Abuse Mitigation Rate Limiting (1000 requests per minute per IP)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter
};
