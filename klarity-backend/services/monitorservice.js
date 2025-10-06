// src/services/monitor.service.js
const db = require('../db');
const AppError = require('../utils/AppError');

exports.create = async (monitorData, userId) => {
  const { name, http_method, base_url, endpoint, check_interval_seconds } = monitorData;
  const query = `
    INSERT INTO monitors (user_id, name, http_method, base_url, endpoint, check_interval_seconds)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const { rows } = await db.query(query, [userId, name, http_method, base_url, endpoint, check_interval_seconds]);
  return rows[0];
};

exports.findAllByUserId = async (userId) => {
  const query = 'SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC;';
  const { rows } = await db.query(query, [userId]);
  return rows;
};

exports.findById = async (monitorId, userId) => {
  const query = 'SELECT * FROM monitors WHERE id = $1 AND user_id = $2;';
  const { rows } = await db.query(query, [monitorId, userId]);
  if (rows.length === 0) {
    throw new AppError('Monitor not found or you do not have permission to view it.', 404);
  }
  return rows[0];
};

exports.update = async (monitorId, updateData, userId) => {
  const { name, http_method, base_url, endpoint, check_interval_seconds, is_active } = updateData;
  const query = `
    UPDATE monitors
    SET name = $1, http_method = $2, base_url = $3, endpoint = $4, check_interval_seconds = $5, is_active = $6, updated_at = NOW()
    WHERE id = $7 AND user_id = $8
    RETURNING *;
  `;
  const { rows } = await db.query(query, [name, http_method, base_url, endpoint, check_interval_seconds, is_active, monitorId, userId]);
  if (rows.length === 0) {
    throw new AppError('Monitor not found or you do not have permission to update it.', 404);
  }
  return rows[0];
};

exports.remove = async (monitorId, userId) => {
  const query = 'DELETE FROM monitors WHERE id = $1 AND user_id = $2;';
  const result = await db.query(query, [monitorId, userId]);
  if (result.rowCount === 0) {
    throw new AppError('Monitor not found or you do not have permission to delete it.', 404);
  }
  // No content to return on successful deletion
};