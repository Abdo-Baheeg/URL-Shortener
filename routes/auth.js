'use strict';

const router = require('express').Router();
const { identify, requireUser } = require('../middleware/jwtAuth');
const authController = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', authController.signup);

// POST /api/auth/login
router.post('/login', authController.login);

// GET  /api/auth/me  (requires valid JWT)
router.get('/me', identify, requireUser, authController.me);

module.exports = router;
