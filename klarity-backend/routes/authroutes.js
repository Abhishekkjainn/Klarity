// src/routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/authcontroller');
const authMiddleware = require('../middleware/authmiddleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// This is an example of a protected route
router.get('/me', authMiddleware.protect, authController.getMe);

module.exports = router;