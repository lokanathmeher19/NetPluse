const fs = require('fs');
const path = require('path');

const resultsFilePath = path.join(__dirname, '../data/results.json');
const uploadsDir = path.join(__dirname, '../public/uploads');

exports.createResult = (req, res) => {
    try {
        const { image, ping, download, upload, jitter, packetLoss, isp, server, userId } = req.body;

        // Generate a short ID for the URL (e.g. 5 random hex chars)
        const id = Math.random().toString(36).substring(2, 8);
        
        let fileName = null;
        let filePath = null;

        if (image) {
            // Process base64 image
            const base64Data = image.replace(/^data:image\/png;base64,/, "");
            fileName = `${id}.png`;
            filePath = path.join(uploadsDir, fileName);

            // Save image to disk
            fs.writeFileSync(filePath, base64Data, 'base64');
        }

        // Read existing results
        let results = [];
        if (fs.existsSync(resultsFilePath)) {
            try {
                results = JSON.parse(fs.readFileSync(resultsFilePath, 'utf8'));
            } catch (e) {
                results = [];
            }
        }

        // Create new result entry
        const newResult = {
            id,
            userId: userId || null,
            ping,
            download,
            upload,
            jitter,
            packetLoss,
            isp,
            server,
            imagePath: fileName ? `/uploads/${fileName}` : null,
            createdAt: new Date().toISOString()
        };

        results.push(newResult);
        fs.writeFileSync(resultsFilePath, JSON.stringify(results, null, 2));

        res.status(201).json({ success: true, id, url: `/result/${id}` });
    } catch (error) {
        console.error('Error creating result:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

exports.getResult = (req, res) => {
    try {
        const { id } = req.params;
        if (!fs.existsSync(resultsFilePath)) {
            return res.status(404).json({ error: 'Result not found' });
        }
        
        let results = [];
        try {
            results = JSON.parse(fs.readFileSync(resultsFilePath, 'utf8'));
        } catch(e) {
            return res.status(404).json({ error: 'Invalid result database' });
        }
        
        const result = results.find(r => r.id === id);

        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
