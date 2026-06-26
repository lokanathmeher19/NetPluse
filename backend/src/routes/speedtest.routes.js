const express = require('express');
const router = express.Router();
const speedtestController = require('../controllers/speedtest.controller');
const { noCache } = require('../middlewares/security');

// Speedtest routes typically shouldn't be cached
router.use(noCache);

router.get('/ping', speedtestController.ping);
router.get('/download', speedtestController.download);
router.post('/upload', speedtestController.upload);

module.exports = router;
