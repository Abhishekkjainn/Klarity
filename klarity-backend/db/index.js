// src/db/index.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('🔗 Database connected successfully!');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};