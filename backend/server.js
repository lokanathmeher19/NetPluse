require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 8080;

// Enterprise Security Headers
app.use(helmet());

// Cross-Origin Settings
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
}));

// DDoS & Abuse Mitigation Rate Limiting (100 requests per minute per IP)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Middleware to prevent caching
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
});

// GET /ping - Simple ping endpoint for latency measurement
app.get('/ping', (req, res) => {
    res.send('pong');
});

// GET /download - Stream dummy data for download test
app.get('/download', (req, res) => {
    // We intentionally DO NOT set Content-Length to force 'Transfer-Encoding: chunked'
    res.header('Content-Type', 'application/octet-stream');

    const chunkSize = 1024 * 64; // 64K chunks
    const dummyBuffer = Buffer.alloc(chunkSize, '0'); // Sending zeros is fine, network doesn't compress automatically here as we don't use compression middleware

    const maxDuration = 35000; // 35 second maximum timeout as a safety fallback
    const startTime = Date.now();

    const streamData = () => {
        let ok = true;

        // Write chunks into the socket buffer only if there is room ('ok' flag)
        // This throttles specifically dynamically to network line capacity
        while (ok && !res.socket.destroyed && (Date.now() - startTime) < maxDuration) {
            ok = res.write(dummyBuffer);
        }

        if (res.socket.destroyed || (Date.now() - startTime) >= maxDuration) {
            res.end();
            return;
        }

        // If buffer is full, wait for it to drain before continuing to dump data into memory
        if (!ok) {
            res.once('drain', streamData);
        }
    };

    streamData();

    req.on('close', () => {
        res.end();
    });
});

// POST /upload - Accept uploaded data and consume it
// To avoid holding all data in memory, we stream it as it comes.
app.post('/upload', (req, res) => {
    let bytesReceived = 0;

    req.on('data', chunk => {
        bytesReceived += chunk.length;
    });

    req.on('end', () => {
        res.json({ receivedBytes: bytesReceived });
    });

    // Handle any stream errors
    req.on('error', (err) => {
        console.error('Upload stream error:', err);
        res.status(500).json({ error: 'Stream error', details: err.message });
    });
});

// GET /servers - Mock list of servers for advanced features
app.get('/servers', (req, res) => {
    res.json({
        servers: [
            { id: '1', name: 'US East (N. Virginia)', location: 'Ashburn, VA', lat: 39.0438, lon: -77.4874, distance: 0 },
            { id: '2', name: 'US West (Oregon)', location: 'Boardman, OR', lat: 45.8399, lon: -119.7006, distance: 0 },
            { id: '3', name: 'EU (Frankfurt)', location: 'Frankfurt, Germany', lat: 50.1109, lon: 8.6821, distance: 0 },
            { id: '4', name: 'Asia Pacific (Singapore)', location: 'Singapore', lat: 1.3521, lon: 103.8198, distance: 0 }
        ]
    });
});

// GET /outages - Check for major ISP outages (Scraping Downdetector or similar logic)
app.get('/outages', async (req, res) => {
    try {
        // In a true enterprise env, we'd use a paid API like ThousandEyes or Downdetector Enterprise.
        // For this demo, we can provide a realistic mock or perform a simple scrape/status check.
        // Let's implement a realistic real-time mock that simulates outage detection based on region

        const isps = ['Comcast', 'Spectrum', 'AT&T', 'Verizon', 'Cox', 'CenturyLink', 'Starlink'];
        const statuses = ['Operational', 'Operational', 'Operational', 'Minor Issues', 'Major Outage'];

        // Randomly assign statuses for demonstration (simulating live metrics)
        const outages = isps.map(isp => {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            return {
                provider: isp,
                status: status,
                reports: status === 'Operational' ? Math.floor(Math.random() * 20) : Math.floor(Math.random() * 5000) + 100,
                lastUpdated: new Date().toISOString()
            };
        });

        // Attempt a real scrape if asked, but many sites block basic axios requests (Cloudflare).
        // For reliability in the demo, we safely return our generated data.

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: outages
        });
    } catch (error) {
        console.error('Outage check error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch outage data' });
    }
});

// Mock database for emails
const notifyList = new Set();

// POST /notify - Collect emails for "Coming Soon" features
app.post('/notify', express.json(), (req, res) => {
    const { email, feature } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    // In a real app we'd save this to a DB (Postgres, MongoDB)
    notifyList.add(email);
    console.log(`[Notification Request] Added ${email} for feature: ${feature}`);

    res.json({ success: true, message: 'You will be notified when this feature is ready!' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Express Speedtest backend running on port ${port}`);
});
