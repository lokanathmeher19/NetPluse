exports.ping = (req, res) => {
    res.send('pong');
};

exports.download = (req, res) => {
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
};

exports.upload = (req, res) => {
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
};
