const express = require('express');
const router = express.Router();
const miscController = require('../controllers/misc.controller');

// Need body parser for POST requests with JSON payload
router.post('/notify', express.json(), miscController.notify);

module.exports = router;
