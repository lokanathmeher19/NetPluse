const express = require('express');
const { securityHeaders, corsConfig } = require('./middlewares/security');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Import routes
const speedtestRoutes = require('./routes/speedtest.routes');
const networkRoutes = require('./routes/network.routes');
const miscRoutes = require('./routes/misc.routes');
const resultRoutes = require('./routes/result.routes');
const path = require('path');

const app = express();

// Serve static uploads for social media preview images
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
app.use('/api/results', resultRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
