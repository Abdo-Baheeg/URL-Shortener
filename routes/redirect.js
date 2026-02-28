'use strict';

const router = require('express').Router();
const { redirectLimiter } = require('../middleware/rateLimiter');
const urlController = require('../controllers/urlController');

// GET /:shortCode  →  302/301 redirect to original URL
router.get('/:shortCode', redirectLimiter, urlController.redirect);

module.exports = router;
