const express = require('express');
const { securityHeaders, corsConfig } = require('./middlewares/security');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Import routes
const speedtestRoutes = require('./routes/speedtest.routes');
const networkRoutes = require('./routes/network.routes');
const miscRoutes = require('./routes/misc.routes');

const app = express();

// Enterprise Security Headers
app.use(securityHeaders);

// Cross-Origin Settings
app.use(corsConfig);

// DDoS & Abuse Mitigation Rate Limiting
app.use(apiLimiter);

// Register routes
app.use('/', speedtestRoutes);
app.use('/', networkRoutes);
app.use('/', miscRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
