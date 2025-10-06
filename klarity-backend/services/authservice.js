// src/services/auth.service.js
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// --- User Registration ---
exports.register = async (email, password) => {
  // 1. Check if user already exists
  const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (userCheck.rows.length > 0) {
    throw new AppError('A user with this email already exists.', 409); // 409 Conflict
  }

  // 2. Hash the password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 3. Insert new user into the database
  const newUserQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at';
  const { rows } = await db.query(newUserQuery, [email, passwordHash]);
  
  return rows[0];
};

exports.login = async (email, password) => {
  // 1. Check if user with that email exists
  const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = userQuery.rows[0];
  if (!user) {
    throw new AppError('Invalid credentials.', 401);
  }

  // 2. Check if password is correct
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Invalid credentials.', 401);
  }

  // 3. **(NEW)** Update last_login_at and get the updated user record
  const updateLoginQuery = 'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *';
  const { rows } = await db.query(updateLoginQuery, [user.id]);
  const updatedUser = rows[0];
  
  return updatedUser; // Return the user object with the new last_login_at timestamp
};
// --- Generate JWT ---
exports.generateToken = (userId) => {
  const payload = {
    user: {
      id: userId,
    },
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};