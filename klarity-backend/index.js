// index.js (Final Perfected Architecture)

// =================================================================
// 0. ULTIMATE SAFETY NETS
// =================================================================
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...', reason);
  process.exit(1);
});

// =================================================================
// 1. IMPORTS & SETUP
// =================================================================
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { Resend } = require('resend');
const pLimit = require('p-limit');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// =================================================================
// 2. DATABASE CONNECTION & SCHEMA
// =================================================================
const db = new Pool({ connectionString: process.env.DATABASE_URL });
db.on('connect', () => console.log('🔗 Database connected successfully!'));

const ensureSchema = async () => {
  console.log('Ensuring database schema exists...');
  // --- UPGRADED: Added pgcrypto for gen_random_uuid() ---
  const createExtQuery = `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;
  const createUsersTableQuery = `CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), last_login_at TIMESTAMPTZ NULL);`;
  const createMonitorsTableQuery = `CREATE TABLE IF NOT EXISTS monitors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, http_method VARCHAR(10) NOT NULL DEFAULT 'GET', base_url TEXT NOT NULL, endpoint TEXT NOT NULL, notification_email TEXT, check_interval_seconds INTEGER NOT NULL DEFAULT 300, is_active BOOLEAN NOT NULL DEFAULT true, current_status VARCHAR(50) NOT NULL DEFAULT 'pending', consecutive_failures INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), last_checked_at TIMESTAMPTZ NULL, expected_status_code INTEGER NULL, expected_response_body TEXT NULL);`;
  const createHealthChecksTableQuery = `CREATE TABLE IF NOT EXISTS health_checks (id BIGSERIAL PRIMARY KEY, monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE, timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), status_code INTEGER, response_time_ms INTEGER, was_successful BOOLEAN NOT NULL, error_message TEXT); CREATE INDEX IF NOT EXISTS health_checks_monitor_id_timestamp_idx ON health_checks (monitor_id, timestamp DESC);`;
  
  try {
    await db.query(createExtQuery); console.log('✅ "pgcrypto" extension is ready.');
    await db.query(createUsersTableQuery); console.log('✅ "users" table is ready.');
    await db.query(createMonitorsTableQuery); console.log('✅ "monitors" table is ready.');
    await db.query(createHealthChecksTableQuery); console.log('✅ "health_checks" table is ready.');
    console.log('Schema setup complete.');
  } catch (err) { console.error('Error ensuring schema:', err); process.exit(1); }
};

// =================================================================
// 3. UTILITIES
// =================================================================
const generateDowntimeEmail = (monitor, checkResult) => { /* ... (code unchanged) ... */ const errorReason = checkResult.errorMessage ? `Error: ${checkResult.errorMessage}` : `Received status code: ${checkResult.statusCode}`; return `<div style="font-family: sans-serif; padding: 20px; color: #333;"><h1 style="color: #e74c3c;">🔴 Whoops! Your API might be taking a nap.</h1><p>Heads up! We detected a problem with your monitor:</p><h2 style="font-size: 24px;">${monitor.name}</h2><div style="background-color: #f9f9f9; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;"><p><strong>URL Checked:</strong> ${monitor.base_url}${monitor.endpoint}</p><p><strong>Time of Failure:</strong> ${new Date().toUTCString()}</p><p><strong>Reason:</strong> ${errorReason}</p></div><p>This alert was triggered after 3 consecutive failed checks. We'll let you know as soon as it's back online.</p><p>In the meantime, you might want to check your server logs!</p><a href="https://your-frontend-domain.com/dashboard" style="display: inline-block; padding: 12px 20px; background-color: #3498db; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 10px;">Go to Dashboard</a></div>`; };
const generateRecoveryEmail = (monitor) => { /* ... (code unchanged) ... */ return `<div style="font-family: sans-serif; padding: 20px; color: #333;"><h1 style="color: #2ecc71;">✅ We're back! Your API is up and running.</h1><p>Good news! Your monitor is back online and responding correctly:</p><h2 style="font-size: 24px;">${monitor.name}</h2><div style="background-color: #f9f9f9; border-left: 4px solid #2ecc71; padding: 15px; margin: 20px 0;"><p><strong>URL Checked:</strong> ${monitor.base_url}${monitor.endpoint}</p><p><strong>Time of Recovery:</strong> ${new Date().toUTCString()}</p></div><p>You can breathe easy now. We'll keep an eye on things for you.</p><a href="https://your-frontend-domain.com/dashboard" style="display: inline-block; padding: 12px 20px; background-color: #3498db; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Performance</a></div>`; };
const sendEmail = async (options) => { /* ... (code unchanged) ... */ try { const { data, error } = await resend.emails.send({ from: process.env.EMAIL_FROM, to: options.to, subject: options.subject, html: options.html }); if (error) { return console.error({ error }); } console.log(`Email sent successfully to ${options.to}. ID: ${data.id}`); } catch (error) { console.error('Exception when sending email:', error); } };
class AppError extends Error { /* ... (code unchanged) ... */ constructor(message, statusCode) { super(message); this.statusCode = statusCode; this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; this.isOperational = true; Error.captureStackTrace(this, this.constructor); } }

// =================================================================
// 4. THE PERFECT POLLING ENGINE (CONCURRENT & UNLOCKED)
// =================================================================

const processMonitor = async (monitor) => {
    // This function processes a single monitor and is completely self-contained.
    try {
        const startTime = Date.now();
        let checkResult = { statusCode: null, responseTime: null, wasSuccessful: false, errorMessage: null };
        try {
            const url = new URL(monitor.endpoint || '', monitor.base_url).toString();
            const response = await axios({ method: monitor.http_method.toLowerCase(), url, timeout: 15000 });
            let isActuallySuccessful = true;
            const expectedCode = monitor.expected_status_code;
            if (expectedCode && response.status !== expectedCode) { isActuallySuccessful = false; checkResult.errorMessage = `Expected status ${expectedCode}, got ${response.status}.`; }
            else if (!expectedCode && (response.status < 200 || response.status >= 300)) { isActuallySuccessful = false; checkResult.errorMessage = `Received non-success status: ${response.status}.`; }
            const expectedBody = monitor.expected_response_body;
            if (isActuallySuccessful && expectedBody) {
                const bodyString = JSON.stringify(response.data);
                if (!bodyString.includes(expectedBody)) { isActuallySuccessful = false; checkResult.errorMessage = `Response body check failed.`; }
            }
            checkResult.wasSuccessful = isActuallySuccessful;
            checkResult.statusCode = response.status;
        } catch (error) {
            if (error.response) { checkResult.statusCode = error.response.status; }
            checkResult.errorMessage = error.code || error.message; // Use error code for timeouts etc.
            checkResult.wasSuccessful = false;
        }
        checkResult.responseTime = Date.now() - startTime;
        let newStatus = checkResult.wasSuccessful ? 'up' : 'down';
        let newConsecutiveFailures = checkResult.wasSuccessful ? 0 : monitor.consecutive_failures + 1;

        // Use a transaction for atomic update
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await client.query('INSERT INTO health_checks (monitor_id, status_code, response_time_ms, was_successful, error_message) VALUES ($1, $2, $3, $4, $5)', [monitor.id, checkResult.statusCode, checkResult.responseTime, checkResult.wasSuccessful, checkResult.errorMessage]);
            await client.query('UPDATE monitors SET current_status = $1, last_checked_at = NOW(), consecutive_failures = $2 WHERE id = $3', [newStatus, newConsecutiveFailures, monitor.id]);
            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError; // Re-throw to be caught by the outer catch
        } finally {
            client.release();
        }

        if (newConsecutiveFailures === 3) { const alertEmail = monitor.notification_email || monitor.owner_email; await sendEmail({ to: alertEmail, subject: `🔴 Heads Up! Your monitor "${monitor.name}" is down`, html: generateDowntimeEmail(monitor, checkResult) }); }
        if (checkResult.wasSuccessful && monitor.consecutive_failures >= 3) { const alertEmail = monitor.notification_email || monitor.owner_email; await sendEmail({ to: alertEmail, subject: `✅ Good News! Your monitor "${monitor.name}" has recovered`, html: generateRecoveryEmail(monitor) }); }
    
    } catch (error) {
        console.error(`💥 Failed to process monitor ${monitor.id} (${monitor.name}). Error:`, error);
    }
};

const runHealthChecks = async () => {
    console.log(`[${new Date().toISOString()}] Starting health check run...`);
    try {
        // --- THE MAGIC: ATOMIC & CONCURRENT ---
        // This query fetches all due monitors and immediately locks them in the database
        // so no other concurrent process can pick them up. It's an atomic "claim-and-process" pattern.
        const { rows: dueMonitors } = await db.query(`
            UPDATE monitors
            SET last_checked_at = NOW()
            WHERE id IN (
                SELECT id FROM monitors
                WHERE is_active = true AND (last_checked_at IS NULL OR last_checked_at <= NOW() - (check_interval_seconds * '1 second'::interval))
                ORDER BY last_checked_at ASC NULLS FIRST
                LIMIT 100 -- Process up to 100 monitors per run to prevent overload
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *;
        `);

        if (dueMonitors.length === 0) { console.log('No monitors due for a check.'); return; }
        console.log(`Claimed and processing ${dueMonitors.length} monitor(s).`);

        // Limit concurrency to a safe number (e.g., 10 parallel checks at a time)
        const limit = pLimit(10);
        const tasks = dueMonitors.map(monitor => limit(() => processMonitor(monitor)));
        await Promise.all(tasks);

        console.log('Health checks completed.');
    } catch (error) {
        console.error('💥 Critical error in runHealthChecks:', error);
    }
};

// =================================================================
// 5. MIDDLEWARE, ROUTES, and SERVER START
// =================================================================
app.use(cors({ origin: ['https://klarityy.vercel.app', process.env.FRONTEND_URL].filter(Boolean), credentials: true }));
app.use(express.json({ limit: '10kb' })); // Add payload size limit
app.use(cookieParser());
const protect = async (req, res, next) => { /* ... (code unchanged) ... */ try { let token; if (req.cookies.jwt) { token = req.cookies.jwt; } if (!token) { return next(new AppError('You are not logged in.', 401)); } const decoded = jwt.verify(token, process.env.JWT_SECRET); const { rows } = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [decoded.user.id]); const currentUser = rows[0]; if (!currentUser) { return next(new AppError('The user for this token no longer exists.', 401)); } req.user = currentUser; next(); } catch (error) { next(new AppError('Invalid token or session expired.', 401)); } };
app.get('/', (req, res) => { /* ... (code unchanged) ... */ const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Klarity API</title><style>body { background-color: #111827; color: #e5e7eb; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Inter', sans-serif; } h1 { font-size: 4rem; font-weight: 800; letter-spacing: -0.05em; }</style></head><body><h1>Klarity API</h1></body></html>`; res.send(html);});
app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok', statusCode: 200, message: 'API is healthy and running.' }));

// --- UPGRADED: "Fire and Forget" for instantaneous cron response ---
app.get('/api/v1/scheduler/run-checks', (req, res) => {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    // Don't wait. Respond immediately and let the checks run in the background.
    runHealthChecks(); 
    res.status(202).json({ status: 'accepted', message: 'Health check process triggered.' });
});

// --- Authentication, Monitors, and Analytics Routes (Unchanged) ---
const authRouter = express.Router();
const signAndSendToken = (user, statusCode, res) => { const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN }); const cookieOptions = { expires: new Date(Date.now() + Number(process.env.JWT_COOKIE_EXPIRES_IN || 90) * 24 * 60 * 60 * 1000), httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' }; res.cookie('jwt', token, cookieOptions); user.password_hash = undefined; res.status(statusCode).json({ status: 'success', statusCode, message: statusCode === 201 ? 'User registered successfully.' : 'User logged in successfully.', token, data: { user } }); };
authRouter.post('/register', async (req, res, next) => { try { const { email, password } = req.body; if (!email || !password || password.length < 8) { return next(new AppError('Please provide a valid email and a password of at least 8 characters.', 400)); } const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]); if (userCheck.rows.length > 0) { return next(new AppError('A user with this email already exists.', 409));} const salt = await bcrypt.genSalt(10); const passwordHash = await bcrypt.hash(password, salt); const newUserQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at'; const { rows } = await db.query(newUserQuery, [email, passwordHash]); signAndSendToken(rows[0], 201, res); } catch (error) { next(error); } });
authRouter.post('/login', async (req, res, next) => { try { const { email, password } = req.body; if (!email || !password) { return next(new AppError('Please provide email and password.', 400));} const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email]); const user = userQuery.rows[0]; if (!user || !(await bcrypt.compare(password, user.password_hash))) { return next(new AppError('Invalid credentials.', 401)); } const updateLoginQuery = 'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *'; const { rows } = await db.query(updateLoginQuery, [user.id]); signAndSendToken(rows[0], 200, res); } catch (error) { next(error); } });
authRouter.post('/logout', (req, res) => { res.cookie('jwt', 'loggedout', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true }); res.status(200).json({ status: 'success', statusCode: 200, message: 'User logged out successfully.' }); });
authRouter.get('/me', protect, (req, res) => { res.status(200).json({ status: 'success', statusCode: 200, message: 'User profile retrieved successfully.', data: { user: req.user } }); });
app.use('/api/v1/auth', authRouter);
const monitorRouter = express.Router();
monitorRouter.use(protect);
monitorRouter.post('/', async (req, res, next) => { try { const { name, http_method, base_url, endpoint, check_interval_seconds, notification_email, expected_status_code, expected_response_body } = req.body; const query = `INSERT INTO monitors (user_id, name, http_method, base_url, endpoint, check_interval_seconds, notification_email, expected_status_code, expected_response_body) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`; const { rows } = await db.query(query, [req.user.id, name, http_method, base_url, endpoint, check_interval_seconds, notification_email, expected_status_code, expected_response_body]); res.status(201).json({ status: 'success', statusCode: 201, message: 'Monitor created successfully.', data: { monitor: rows[0] } }); } catch (error) { next(error); } });
monitorRouter.get('/', async (req, res, next) => { try { const { rows } = await db.query('SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC;', [req.user.id]); res.status(200).json({ status: 'success', statusCode: 200, message: 'Monitors retrieved successfully.', results: rows.length, data: { monitors: rows } }); } catch (error) { next(error); } });
monitorRouter.get('/:id', async (req, res, next) => { try { const { rows } = await db.query('SELECT * FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]); if (rows.length === 0) { return next(new AppError('Monitor not found.', 404)); } res.status(200).json({ status: 'success', statusCode: 200, message: 'Monitor retrieved successfully.', data: { monitor: rows[0] } }); } catch (error) { next(error); } });
monitorRouter.put('/:id', async (req, res, next) => { try { const { name, http_method, base_url, endpoint, check_interval_seconds, is_active, notification_email, expected_status_code, expected_response_body } = req.body; const query = `UPDATE monitors SET name = $1, http_method = $2, base_url = $3, endpoint = $4, check_interval_seconds = $5, is_active = $6, notification_email = $7, expected_status_code = $8, expected_response_body = $9, updated_at = NOW() WHERE id = $10 AND user_id = $11 RETURNING *;`; const { rows } = await db.query(query, [name, http_method, base_url, endpoint, check_interval_seconds, is_active, notification_email, expected_status_code, expected_response_body, req.params.id, req.user.id]); if (rows.length === 0) { return next(new AppError('Monitor not found.', 404));} res.status(200).json({ status: 'success', statusCode: 200, message: 'Monitor updated successfully.', data: { monitor: rows[0] } }); } catch (error) { next(error); } });
monitorRouter.delete('/:id', async (req, res, next) => { try { const result = await db.query('DELETE FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]); if (result.rowCount === 0) { return next(new AppError('Monitor not found.', 404));} res.status(204).send(); } catch (error) { next(error); } });
app.use('/api/v1/monitors', monitorRouter);
const analyticsRouter = express.Router();
analyticsRouter.use(protect);
analyticsRouter.get('/user/overview', async (req, res, next) => { try { const { period = '24h' } = req.query; const intervalMap = { '24h': '1 day', '7d': '7 days', '30d': '30 days' }; if (!intervalMap[period]) { return next(new AppError('Invalid period.', 400)); } const query = `SELECT TRUNC(AVG(hc.response_time_ms)) AS "averageLatencyAll", TRUNC((COUNT(*) FILTER (WHERE hc.was_successful) * 100.0 / NULLIF(COUNT(*), 0)), 2) AS "uptimePercentageAll", COUNT(*) FILTER (WHERE NOT hc.was_successful) AS "totalFailuresAll" FROM health_checks hc JOIN monitors m ON hc.monitor_id = m.id WHERE m.user_id = $1 AND hc.timestamp >= NOW() - $2::interval;`; const { rows } = await db.query(query, [req.user.id, intervalMap[period]]); res.status(200).json({ status: 'success', statusCode: 200, message: `User-wide overview for the last ${period} retrieved.`, data: rows[0] }); } catch (error) { next(error); } });
analyticsRouter.get('/user/worst-performers', async (req, res, next) => { try { const { period = '7d' } = req.query; const intervalMap = { '24h': '1 day', '7d': '7 days', '30d': '30 days' }; if (!intervalMap[period]) { return next(new AppError('Invalid period.', 400)); } const query = `SELECT m.id, m.name, TRUNC(AVG(hc.response_time_ms)) as "averageLatency", TRUNC((COUNT(*) FILTER (WHERE hc.was_successful) * 100.0 / NULLIF(COUNT(*), 0)), 2) AS "uptimePercentage" FROM health_checks hc JOIN monitors m ON hc.monitor_id = m.id WHERE m.user_id = $1 AND hc.timestamp >= NOW() - $2::interval GROUP BY m.id, m.name ORDER BY "uptimePercentage" ASC, "averageLatency" DESC LIMIT 5;`; const { rows } = await db.query(query, [req.user.id, intervalMap[period]]); res.status(200).json({ status: 'success', statusCode: 200, message: `Worst performing monitors for the last ${period} retrieved.`, data: rows }); } catch (error) { next(error); } });
analyticsRouter.get('/:monitorId/overview', async (req, res, next) => { try { const { monitorId } = req.params; const { period = '24h' } = req.query; const intervalMap = { '24h': '1 day', '7d': '7 days', '30d': '30 days' }; if (!intervalMap[period]) { return next(new AppError('Invalid period. Use 24h, 7d, or 30d.', 400)); } const statsQuery = `SELECT COUNT(*) AS "totalChecks", TRUNC(AVG(response_time_ms)) AS "averageLatency", TRUNC((COUNT(*) FILTER (WHERE was_successful) * 100.0 / NULLIF(COUNT(*), 0)), 2) AS "uptimePercentage", COUNT(*) FILTER (WHERE NOT was_successful) AS "totalFailures", TRUNC(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms)) AS "p95Latency", TRUNC(percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms)) AS "p99Latency" FROM health_checks WHERE monitor_id = $1 AND timestamp >= NOW() - $2::interval;`; const statusQuery = `SELECT status_code, COUNT(*) as count FROM health_checks WHERE monitor_id = $1 AND timestamp >= NOW() - $2::interval AND status_code IS NOT NULL GROUP BY status_code ORDER BY count DESC;`; const [statsResult, statusResult] = await Promise.all([ db.query(statsQuery, [monitorId, intervalMap[period]]), db.query(statusQuery, [monitorId, intervalMap[period]]) ]); res.status(200).json({ status: 'success', statusCode: 200, message: `Overview for the last ${period} retrieved.`, data: { ...statsResult.rows[0], statusCounts: statusResult.rows } }); } catch (error) { next(error); } });
analyticsRouter.get('/:monitorId/latency-series', async (req, res, next) => { try { const { monitorId } = req.params; const { period = '24h' } = req.query; const intervalMap = { '24h': '1 day', '7d': '7 days', '30d': '30 days' }; const granularityMap = { '24h': 'hour', '7d': 'day', '30d': 'day' }; if (!intervalMap[period]) { return next(new AppError('Invalid period.', 400)); } const query = `SELECT date_trunc($2, timestamp) as time_bucket, ROUND(AVG(response_time_ms)) as avg_latency FROM health_checks WHERE monitor_id = $1 AND timestamp >= NOW() - $3::interval AND was_successful = true GROUP BY time_bucket ORDER BY time_bucket ASC;`; const { rows } = await db.query(query, [monitorId, granularityMap[period], intervalMap[period]]); res.status(200).json({ status: 'success', statusCode: 200, message: `Latency series for the last ${period} retrieved.`, data: rows }); } catch (error) { next(error); } });
analyticsRouter.get('/:monitorId/incidents', async (req, res, next) => { try { const { monitorId } = req.params; const { period = '30d' } = req.query; const intervalMap = { '24h': '1 day', '7d': '7 days', '30d': '30 days' }; if (!intervalMap[period]) { return next(new AppError('Invalid period.', 400)); } const query = ` WITH incident_groups AS ( SELECT timestamp, was_successful, ROW_NUMBER() OVER (ORDER BY timestamp) - ROW_NUMBER() OVER (PARTITION BY was_successful ORDER BY timestamp) as group_id FROM health_checks WHERE monitor_id = $1 AND timestamp >= NOW() - $2::interval ) SELECT MIN(timestamp) as start_time, MAX(timestamp) as end_time, EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) as duration_seconds FROM incident_groups WHERE was_successful = false GROUP BY group_id ORDER BY start_time DESC; `; const { rows } = await db.query(query, [monitorId, intervalMap[period]]); res.status(200).json({ status: 'success', statusCode: 200, message: `Downtime incidents for the last ${period} retrieved.`, data: rows }); } catch (error) { next(error); } });
analyticsRouter.get('/:monitorId/checks', async (req, res, next) => { try { const { monitorId } = req.params; const limit = Math.min(parseInt(req.query.limit) || 25, 100); const page = parseInt(req.query.page) || 1; const offset = (page - 1) * limit; const query = `SELECT * FROM health_checks WHERE monitor_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3;`; const { rows } = await db.query(query, [monitorId, limit, offset]); res.status(200).json({ status: 'success', statusCode: 200, message: `Paginated checks log retrieved.`, data: rows }); } catch (error) { next(error); } });
analyticsRouter.get('/:monitorId/history', async (req, res, next) => { try { const { monitorId } = req.params; const query = ` WITH days AS ( SELECT generate_series( (NOW() - interval '89 days')::date, NOW()::date, '1 day'::interval )::date AS day ) SELECT d.day, COALESCE(s.status, 'no_data') AS status FROM days d LEFT JOIN ( SELECT date_trunc('day', timestamp)::date AS day, CASE WHEN COUNT(*) FILTER (WHERE was_successful = false) > 0 THEN 'downtime' ELSE 'all_up' END AS status FROM health_checks WHERE monitor_id = $1 AND timestamp >= NOW() - interval '90 days' GROUP BY 1 ) s ON d.day = s.day ORDER BY d.day ASC; `; const { rows } = await db.query(query, [monitorId]); res.status(200).json({ status: 'success', statusCode: 200, message: '90-day history retrieved.', data: rows }); } catch (error) { next(error); } });
analyticsRouter.get('/:monitorId/error-breakdown', async (req, res, next) => { try { const { monitorId } = req.params; const { period = '30d' } = req.query; const intervalMap = { '24h': '1 day', '7d': '7 days', '30d': '30 days' }; if (!intervalMap[period]) { return next(new AppError('Invalid period.', 400)); } const query = `SELECT SUBSTRING(error_message for 50) as error, COUNT(*) as count FROM health_checks WHERE was_successful = false AND monitor_id = $1 AND timestamp >= NOW() - $2::interval AND error_message IS NOT NULL GROUP BY error ORDER BY count DESC LIMIT 10;`; const { rows } = await db.query(query, [monitorId, intervalMap[period]]); res.status(200).json({ status: 'success', statusCode: 200, message: `Error breakdown for the last ${period} retrieved.`, data: rows }); } catch (error) { next(error); } });
app.use('/api/v1/analytics', analyticsRouter);

// =================================================================
// 7. ERROR HANDLING & SERVER START
// =================================================================
app.use((req, res, next) => { next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404)); });
app.use((err, req, res, next) => { err.statusCode = err.statusCode || 500; err.status = err.status || 'error'; console.error('💥 ERROR:', err); res.status(err.statusCode).json({ status: err.status, message: err.message }); });
const startServer = async () => { await ensureSchema(); const PORT = process.env.PORT || 8000; app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`)); };
startServer();