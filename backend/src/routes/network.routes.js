const express = require('express');
const router = express.Router();
const networkController = require('../controllers/network.controller');
const { noCache } = require('../middlewares/security');

router.get('/servers', networkController.getServers);
router.get('/outages', noCache, networkController.getOutages);

module.exports = router;
