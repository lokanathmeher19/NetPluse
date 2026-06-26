const helmet = require('helmet');
const cors = require('cors');

const securityHeaders = helmet();

const corsConfig = cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
});

const noCache = (req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
};

module.exports = {
    securityHeaders,
    corsConfig,
    noCache
};
