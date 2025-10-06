// src/db/ensureSchema.js
const db = require('./index');

const createUsersTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NULL
    );
  `;
  try {
    await db.query(queryText);
    console.log('✅ "users" table is ready.');
  } catch (err) {
    console.error('Error creating users table:', err);
    process.exit(1);
  }
};

const createMonitorsTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS monitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
      base_url TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      check_interval_seconds INTEGER NOT NULL DEFAULT 300, -- Default to 5 minutes
      is_active BOOLEAN NOT NULL DEFAULT true,
      current_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., 'up', 'down', 'pending'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await db.query(queryText);
    console.log('✅ "monitors" table is ready.');
  } catch (err) {
    console.error('Error creating monitors table:', err);
    process.exit(1);
  }
};

// --- UPDATE THIS FUNCTION ---
const ensureSchema = async () => {
  console.log('Ensuring database schema exists...');
  await createUsersTable();
  await createMonitorsTable(); // Call the new function here
  console.log('Schema setup complete.');
};

module.exports = ensureSchema;