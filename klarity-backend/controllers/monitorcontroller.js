// src/controllers/monitor.controller.js
const monitorService = require('../services/monitorservice');
const AppError = require('../utils/AppError');

exports.createMonitor = async (req, res, next) => {
  try {
    // req.user.id is available thanks to our 'protect' middleware
    const newMonitor = await monitorService.create(req.body, req.user.id);
    res.status(201).json({
      status: 'success',
      data: {
        monitor: newMonitor,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllMonitors = async (req, res, next) => {
  try {
    const monitors = await monitorService.findAllByUserId(req.user.id);
    res.status(200).json({
      status: 'success',
      results: monitors.length,
      data: {
        monitors,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMonitorById = async (req, res, next) => {
  try {
    const monitor = await monitorService.findById(req.params.id, req.user.id);
    res.status(200).json({
      status: 'success',
      data: {
        monitor,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateMonitor = async (req, res, next) => {
  try {
    const updatedMonitor = await monitorService.update(req.params.id, req.body, req.user.id);
    res.status(200).json({
      status: 'success',
      data: {
        monitor: updatedMonitor,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMonitor = async (req, res, next) => {
  try {
    await monitorService.remove(req.params.id, req.user.id);
    res.status(204).json({ // 204 No Content
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};