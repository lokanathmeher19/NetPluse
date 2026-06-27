const express = require('express');
const router = express.Router();
const resultController = require('../controllers/result.controller');

// Need a higher limit for base64 image uploads (e.g. 10mb)
router.post('/', express.json({ limit: '10mb' }), resultController.createResult);
router.get('/:id', resultController.getResult);

module.exports = router;
