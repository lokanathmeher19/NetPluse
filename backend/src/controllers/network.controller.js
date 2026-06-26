exports.getServers = (req, res) => {
    res.json({
        servers: [
            { id: '1', name: 'US East (N. Virginia)', location: 'Ashburn, VA', lat: 39.0438, lon: -77.4874, distance: 0 },
            { id: '2', name: 'US West (Oregon)', location: 'Boardman, OR', lat: 45.8399, lon: -119.7006, distance: 0 },
            { id: '3', name: 'EU (Frankfurt)', location: 'Frankfurt, Germany', lat: 50.1109, lon: 8.6821, distance: 0 },
            { id: '4', name: 'Asia Pacific (Singapore)', location: 'Singapore', lat: 1.3521, lon: 103.8198, distance: 0 }
        ]
    });
};

exports.getOutages = async (req, res) => {
    try {
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

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: outages
        });
    } catch (error) {
        console.error('Outage check error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch outage data' });
    }
};
