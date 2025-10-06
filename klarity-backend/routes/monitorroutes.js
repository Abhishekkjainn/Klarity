// src/routes/monitor.routes.js
const express = require('express');
const monitorController = require('../controllers/monitorcontroller');
const authMiddleware = require('../middleware/authmiddleware');

const router = express.Router();

// This line protects all routes defined after it
router.use(authMiddleware.protect);

router
  .route('/')
  .post(monitorController.createMonitor)
  .get(monitorController.getAllMonitors);

router
  .route('/:id')
  .get(monitorController.getMonitorById)
  .put(monitorController.updateMonitor) // Using PUT for simplicity, PATCH is also valid
  .delete(monitorController.deleteMonitor);

module.exports = router;