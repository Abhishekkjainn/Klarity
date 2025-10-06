// // index.js (All-in-One with Polling Engine)

// // =================================================================
// // 1. IMPORTS & SETUP
// // =================================================================
// require('dotenv').config();
// const express = require('express');
// const { Pool } = require('pg');
// const cors = require('cors');
// const cookieParser = require('cookie-parser');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const axios = require('axios'); // --- NEW ---
// const cron = require('node-cron'); // --- NEW ---

// const app = express();

// // =================================================================
// // 2. DATABASE CONNECTION & SCHEMA
// // =================================================================

// // --- Database Connection Pool ---
// const db = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// db.on('connect', () => {
//   console.log('🔗 Database connected successfully!');
// });

// // --- Schema Creation Logic ---
// const ensureSchema = async () => {
//   console.log('Ensuring database schema exists...');
  
//   const createUsersTableQuery = `
//     CREATE TABLE IF NOT EXISTS users (
//       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//       email VARCHAR(255) UNIQUE NOT NULL,
//       password_hash VARCHAR(255) NOT NULL,
//       created_at TIMESTAMPTZ DEFAULT NOW(),
//       updated_at TIMESTAMPTZ DEFAULT NOW(),
//       last_login_at TIMESTAMPTZ NULL
//     );
//   `;
  
//   const createMonitorsTableQuery = `
//     CREATE TABLE IF NOT EXISTS monitors (
//       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//       name VARCHAR(255) NOT NULL,
//       http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
//       base_url TEXT NOT NULL,
//       endpoint TEXT NOT NULL,
//       check_interval_seconds INTEGER NOT NULL DEFAULT 300,
//       is_active BOOLEAN NOT NULL DEFAULT true,
//       current_status VARCHAR(50) NOT NULL DEFAULT 'pending',
//       created_at TIMESTAMPTZ DEFAULT NOW(),
//       updated_at TIMESTAMPTZ DEFAULT NOW(),
//       last_checked_at TIMESTAMPTZ NULL -- --- NEW ---
//     );
//   `;

//   // --- NEW --- Health Checks Table
//   const createHealthChecksTableQuery = `
//     CREATE TABLE IF NOT EXISTS health_checks (
//         id BIGSERIAL PRIMARY KEY,
//         monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
//         timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         status_code INTEGER,
//         response_time_ms INTEGER,
//         was_successful BOOLEAN NOT NULL,
//         error_message TEXT
//     );
//   `;
  
//   try {
//     await db.query(createUsersTableQuery);
//     console.log('✅ "users" table is ready.');
//     await db.query(createMonitorsTableQuery);
//     console.log('✅ "monitors" table is ready.');
//     await db.query(createHealthChecksTableQuery); // --- NEW ---
//     console.log('✅ "health_checks" table is ready.'); // --- NEW ---
//     console.log('Schema setup complete.');
//   } catch (err) {
//     console.error('Error ensuring schema:', err);
//     process.exit(1);
//   }
// };

// // =================================================================
// // 3. POLLING ENGINE (CRON JOB) --- NEW SECTION ---
// // =================================================================

// const runHealthChecks = async () => {
//     console.log(`[${new Date().toISOString()}] Running health checks...`);
    
//     try {
//         // 1. Fetch all active monitors that are due for a check
//         const query = `
//             SELECT * FROM monitors 
//             WHERE is_active = true 
//             AND (last_checked_at IS NULL OR last_checked_at <= NOW() - (check_interval_seconds * '1 second'::interval));
//         `;
//         const { rows: dueMonitors } = await db.query(query);

//         if (dueMonitors.length === 0) {
//             console.log('No monitors due for a check.');
//             return;
//         }

//         console.log(`Found ${dueMonitors.length} monitor(s) to check.`);

//         // 2. Execute all checks concurrently
//         await Promise.all(dueMonitors.map(async (monitor) => {
//             const startTime = Date.now();
//             let checkResult = {
//                 statusCode: null,
//                 responseTime: null,
//                 wasSuccessful: false,
//                 errorMessage: null,
//             };

//             try {
//                 const response = await axios({
//                     method: monitor.http_method,
//                     url: `${monitor.base_url}${monitor.endpoint}`,
//                     timeout: 5000, // 5 second timeout
//                 });
//                 checkResult.statusCode = response.status;
//                 checkResult.wasSuccessful = response.status >= 200 && response.status < 300;
//             } catch (error) {
//                 if (error.response) {
//                     checkResult.statusCode = error.response.status;
//                 }
//                 checkResult.errorMessage = error.message;
//                 checkResult.wasSuccessful = false;
//             }
            
//             checkResult.responseTime = Date.now() - startTime;

//             // 3. Save the results
//             await db.query(
//                 'INSERT INTO health_checks (monitor_id, status_code, response_time_ms, was_successful, error_message) VALUES ($1, $2, $3, $4, $5)',
//                 [monitor.id, checkResult.statusCode, checkResult.responseTime, checkResult.wasSuccessful, checkResult.errorMessage]
//             );

//             await db.query(
//                 'UPDATE monitors SET current_status = $1, last_checked_at = NOW() WHERE id = $2',
//                 [checkResult.wasSuccessful ? 'up' : 'down', monitor.id]
//             );
//         }));

//         console.log('Health checks completed.');
//     } catch (error) {
//         console.error('💥 Error running health checks:', error);
//     }
// };


// // =================================================================
// // 4. MIDDLEWARE & UTILITIES
// // =================================================================

// // --- Custom Error Class ---
// class AppError extends Error {
//   constructor(message, statusCode) {
//     super(message);
//     this.statusCode = statusCode;
//     this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
//     this.isOperational = true;
//     Error.captureStackTrace(this, this.constructor);
//   }
// }

// // ... (The rest of your middleware, routes, and error handlers are unchanged)
// // --- Global Middleware ---
// app.use(cors({
//   origin: 'http://localhost:3000',
//   credentials: true,
// }));
// app.use(express.json());
// app.use(cookieParser());

// // --- Authentication 'protect' Middleware ---
// const protect = async (req, res, next) => {
//   try {
//     let token;
//     if (req.cookies.jwt) {
//       token = req.cookies.jwt;
//     }

//     if (!token) {
//       return next(new AppError('You are not logged in. Please log in to get access.', 401));
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const { rows } = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [decoded.user.id]);
//     const currentUser = rows[0];

//     if (!currentUser) {
//       return next(new AppError('The user belonging to this token no longer exists.', 401));
//     }

//     req.user = currentUser;
//     next();
//   } catch (error) {
//     next(new AppError('Invalid token or session has expired.', 401));
//   }
// };

// // =================================================================
// // 5. API ROUTES & LOGIC
// // =================================================================

// // --- Health Check Route ---
// app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok' }));

// // --- Authentication Routes ---
// const authRouter = express.Router();

// const signAndSendToken = (user, statusCode, res) => {
//     const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, {
//       expiresIn: process.env.JWT_EXPIRES_IN,
//     });
  
//     const cookieOptions = {
//       expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'lax',
//     };
  
//     res.cookie('jwt', token, cookieOptions);
//     user.password_hash = undefined;
  
//     res.status(statusCode).json({
//       status: 'success',
//       token,
//       data: { user },
//     });
// };

// authRouter.post('/register', async (req, res, next) => {
//     try {
//         const { email, password } = req.body;
//         if (!email || !password || password.length < 8) {
//             return next(new AppError('Please provide a valid email and a password of at least 8 characters.', 400));
//         }
        
//         const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
//         if (userCheck.rows.length > 0) {
//             return next(new AppError('A user with this email already exists.', 409));
//         }

//         const salt = await bcrypt.genSalt(10);
//         const passwordHash = await bcrypt.hash(password, salt);

//         const newUserQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at';
//         const { rows } = await db.query(newUserQuery, [email, passwordHash]);
        
//         signAndSendToken(rows[0], 201, res);
//     } catch (error) {
//         next(error);
//     }
// });

// authRouter.post('/login', async (req, res, next) => {
//     try {
//         const { email, password } = req.body;
//         if (!email || !password) {
//             return next(new AppError('Please provide email and password.', 400));
//         }

//         const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email]);
//         const user = userQuery.rows[0];

//         if (!user || !(await bcrypt.compare(password, user.password_hash))) {
//             return next(new AppError('Invalid credentials.', 401));
//         }

//         const updateLoginQuery = 'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *';
//         const { rows } = await db.query(updateLoginQuery, [user.id]);
        
//         signAndSendToken(rows[0], 200, res);
//     } catch (error) {
//         next(error);
//     }
// });

// authRouter.post('/logout', (req, res) => {
//     res.cookie('jwt', 'loggedout', {
//         expires: new Date(Date.now() + 10 * 1000),
//         httpOnly: true,
//     });
//     res.status(200).json({ status: 'success' });
// });

// authRouter.get('/me', protect, (req, res) => {
//     res.status(200).json({
//         status: 'success',
//         data: { user: req.user },
//     });
// });

// app.use('/api/v1/auth', authRouter);

// // --- Monitors Routes ---
// const monitorRouter = express.Router();

// // Protect all monitor routes
// monitorRouter.use(protect);

// monitorRouter.post('/', async (req, res, next) => {
//     try {
//         const { name, http_method, base_url, endpoint, check_interval_seconds } = req.body;
//         const query = `
//             INSERT INTO monitors (user_id, name, http_method, base_url, endpoint, check_interval_seconds)
//             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
//         `;
//         const { rows } = await db.query(query, [req.user.id, name, http_method, base_url, endpoint, check_interval_seconds]);
//         res.status(201).json({ status: 'success', data: { monitor: rows[0] } });
//     } catch (error) {
//         next(error);
//     }
// });

// monitorRouter.get('/', async (req, res, next) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC;', [req.user.id]);
//         res.status(200).json({ status: 'success', results: rows.length, data: { monitors: rows } });
//     } catch (error) {
//         next(error);
//     }
// });

// monitorRouter.get('/:id', async (req, res, next) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
//         if (rows.length === 0) {
//             return next(new AppError('Monitor not found.', 404));
//         }
//         res.status(200).json({ status: 'success', data: { monitor: rows[0] } });
//     } catch (error) {
//         next(error);
//     }
// });

// monitorRouter.put('/:id', async (req, res, next) => {
//     try {
//         const { name, http_method, base_url, endpoint, check_interval_seconds, is_active } = req.body;
//         const query = `
//             UPDATE monitors
//             SET name = $1, http_method = $2, base_url = $3, endpoint = $4, check_interval_seconds = $5, is_active = $6, updated_at = NOW()
//             WHERE id = $7 AND user_id = $8 RETURNING *;
//         `;
//         const { rows } = await db.query(query, [name, http_method, base_url, endpoint, check_interval_seconds, is_active, req.params.id, req.user.id]);
//         if (rows.length === 0) {
//             return next(new AppError('Monitor not found.', 404));
//         }
//         res.status(200).json({ status: 'success', data: { monitor: rows[0] } });
//     } catch (error) {
//         next(error);
//     }
// });

// monitorRouter.delete('/:id', async (req, res, next) => {
//     try {
//         const result = await db.query('DELETE FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
//         if (result.rowCount === 0) {
//             return next(new AppError('Monitor not found.', 404));
//         }
//         res.status(204).json({ status: 'success', data: null });
//     } catch (error) {
//         next(error);
//     }
// });

// app.use('/api/v1/monitors', monitorRouter);

// // =================================================================
// // 6. ERROR HANDLING & SERVER START
// // =================================================================

// // --- Not Found Route ---
// app.use((req, res, next) => {
//   next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

// // --- Global Error Handler ---
// app.use((err, req, res, next) => {
//   err.statusCode = err.statusCode || 500;
//   err.status = err.status || 'error';
//   console.error('💥 ERROR:', err);
//   res.status(err.statusCode).json({
//     status: err.status,
//     message: err.message,
//   });
// });

// // --- Server Startup ---
// const startServer = async () => {
//   await ensureSchema();
  
//   // --- NEW --- Start the cron job
//   cron.schedule('* * * * *', runHealthChecks, {
//     scheduled: true,
//     timezone: "UTC"
//   });
//   console.log('⏰ Cron job for health checks scheduled to run every minute.');

//   const PORT = process.env.PORT || 8000;
//   app.listen(PORT, () => {
//     console.log(`🚀 Server is running on port ${PORT}`);
//   });
// };

// startServer();


// index.js (All-in-One with Vercel-Ready Polling Engine)

// =================================================================
// 1. IMPORTS & SETUP
// =================================================================
// require('dotenv').config();
// const express = require('express');
// const { Pool } = require('pg');
// const cors = require('cors');
// const cookieParser = require('cookie-parser');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const axios = require('axios'); // We still need axios

// const app = express();

// // =================================================================
// // 2. DATABASE CONNECTION & SCHEMA
// // =================================================================

// // --- Database Connection Pool ---
// const db = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// db.on('connect', () => {
//   console.log('🔗 Database connected successfully!');
// });

// // --- Schema Creation Logic ---
// const ensureSchema = async () => {
//   console.log('Ensuring database schema exists...');
  
//   const createUsersTableQuery = `
//     CREATE TABLE IF NOT EXISTS users (
//       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//       email VARCHAR(255) UNIQUE NOT NULL,
//       password_hash VARCHAR(255) NOT NULL,
//       created_at TIMESTAMPTZ DEFAULT NOW(),
//       updated_at TIMESTAMPTZ DEFAULT NOW(),
//       last_login_at TIMESTAMPTZ NULL
//     );
//   `;
  
//   const createMonitorsTableQuery = `
//     CREATE TABLE IF NOT EXISTS monitors (
//       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//       name VARCHAR(255) NOT NULL,
//       http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
//       base_url TEXT NOT NULL,
//       endpoint TEXT NOT NULL,
//       check_interval_seconds INTEGER NOT NULL DEFAULT 300,
//       is_active BOOLEAN NOT NULL DEFAULT true,
//       current_status VARCHAR(50) NOT NULL DEFAULT 'pending',
//       created_at TIMESTAMPTZ DEFAULT NOW(),
//       updated_at TIMESTAMPTZ DEFAULT NOW(),
//       last_checked_at TIMESTAMPTZ NULL
//     );
//   `;

//   const createHealthChecksTableQuery = `
//     CREATE TABLE IF NOT EXISTS health_checks (
//         id BIGSERIAL PRIMARY KEY,
//         monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
//         timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         status_code INTEGER,
//         response_time_ms INTEGER,
//         was_successful BOOLEAN NOT NULL,
//         error_message TEXT
//     );
//   `;
  
//   try {
//     await db.query(createUsersTableQuery);
//     console.log('✅ "users" table is ready.');
//     await db.query(createMonitorsTableQuery);
//     console.log('✅ "monitors" table is ready.');
//     await db.query(createHealthChecksTableQuery);
//     console.log('✅ "health_checks" table is ready.');
//     console.log('Schema setup complete.');
//   } catch (err) {
//     console.error('Error ensuring schema:', err);
//     process.exit(1);
//   }
// };

// // =================================================================
// // 3. POLLING ENGINE LOGIC (To be triggered by Vercel)
// // =================================================================

// const runHealthChecks = async () => {
//     console.log(`[${new Date().toISOString()}] Running health checks...`);
    
//     try {
//         const query = `
//             SELECT * FROM monitors 
//             WHERE is_active = true 
//             AND (last_checked_at IS NULL OR last_checked_at <= NOW() - (check_interval_seconds * '1 second'::interval));
//         `;
//         const { rows: dueMonitors } = await db.query(query);

//         if (dueMonitors.length === 0) {
//             console.log('No monitors due for a check.');
//             return;
//         }

//         console.log(`Found ${dueMonitors.length} monitor(s) to check.`);

//         await Promise.all(dueMonitors.map(async (monitor) => {
//             const startTime = Date.now();
//             let checkResult = {
//                 statusCode: null,
//                 responseTime: null,
//                 wasSuccessful: false,
//                 errorMessage: null,
//             };

//             try {
//                 const response = await axios({
//                     method: monitor.http_method,
//                     url: `${monitor.base_url}${monitor.endpoint}`,
//                     timeout: 5000,
//                 });
//                 checkResult.statusCode = response.status;
//                 checkResult.wasSuccessful = response.status >= 200 && response.status < 300;
//             } catch (error) {
//                 if (error.response) {
//                     checkResult.statusCode = error.response.status;
//                 }
//                 checkResult.errorMessage = error.message;
//                 checkResult.wasSuccessful = false;
//             }
            
//             checkResult.responseTime = Date.now() - startTime;

//             await db.query(
//                 'INSERT INTO health_checks (monitor_id, status_code, response_time_ms, was_successful, error_message) VALUES ($1, $2, $3, $4, $5)',
//                 [monitor.id, checkResult.statusCode, checkResult.responseTime, checkResult.wasSuccessful, checkResult.errorMessage]
//             );

//             await db.query(
//                 'UPDATE monitors SET current_status = $1, last_checked_at = NOW() WHERE id = $2',
//                 [checkResult.wasSuccessful ? 'up' : 'down', monitor.id]
//             );
//         }));

//         console.log('Health checks completed.');
//     } catch (error) {
//         console.error('💥 Error running health checks:', error);
//     }
// };


// // =================================================================
// // 4. MIDDLEWARE & UTILITIES
// // =================================================================

// class AppError extends Error {
//   constructor(message, statusCode) {
//     super(message);
//     this.statusCode = statusCode;
//     this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
//     this.isOperational = true;
//     Error.captureStackTrace(this, this.constructor);
//   }
// }

// app.use(cors({
//   origin: 'http://localhost:3000',
//   credentials: true,
// }));
// app.use(express.json());
// app.use(cookieParser());

// const protect = async (req, res, next) => {
//   try {
//     let token;
//     if (req.cookies.jwt) { token = req.cookies.jwt; }
//     if (!token) { return next(new AppError('You are not logged in.', 401)); }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const { rows } = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [decoded.user.id]);
//     const currentUser = rows[0];
//     if (!currentUser) { return next(new AppError('The user for this token no longer exists.', 401)); }
//     req.user = currentUser;
//     next();
//   } catch (error) {
//     next(new AppError('Invalid token or session expired.', 401));
//   }
// };

// // =================================================================
// // 5. API ROUTES & LOGIC
// // =================================================================

// app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok' }));

// // --- NEW --- Secure Endpoint for Vercel Cron Job
// app.get('/api/v1/scheduler/run-checks', async (req, res) => {
//     const authHeader = req.headers.authorization;
//     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
//         return res.status(401).json({ status: 'error', message: 'Unauthorized' });
//     }

//     // Await the health checks to ensure they complete before the serverless function times out
//     await runHealthChecks();

//     res.status(200).json({ status: 'success', message: 'Health checks executed.' });
// });

// // --- Authentication Routes ---
// const authRouter = express.Router();
// // ... (Your auth routes code remains exactly the same)
// const signAndSendToken = (user, statusCode, res) => {
//     const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, {
//       expiresIn: process.env.JWT_EXPIRES_IN,
//     });
  
//     const cookieOptions = {
//       expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'lax',
//     };
  
//     res.cookie('jwt', token, cookieOptions);
//     user.password_hash = undefined;
  
//     res.status(statusCode).json({
//       status: 'success',
//       token,
//       data: { user },
//     });
// };
// authRouter.post('/register', async (req, res, next) => {
//     try {
//         const { email, password } = req.body;
//         if (!email || !password || password.length < 8) { return next(new AppError('Please provide a valid email and a password of at least 8 characters.', 400)); }
//         const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
//         if (userCheck.rows.length > 0) { return next(new AppError('A user with this email already exists.', 409));}
//         const salt = await bcrypt.genSalt(10);
//         const passwordHash = await bcrypt.hash(password, salt);
//         const newUserQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at';
//         const { rows } = await db.query(newUserQuery, [email, passwordHash]);
//         signAndSendToken(rows[0], 201, res);
//     } catch (error) { next(error); }
// });
// authRouter.post('/login', async (req, res, next) => {
//     try {
//         const { email, password } = req.body;
//         if (!email || !password) { return next(new AppError('Please provide email and password.', 400));}
//         const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email]);
//         const user = userQuery.rows[0];
//         if (!user || !(await bcrypt.compare(password, user.password_hash))) { return next(new AppError('Invalid credentials.', 401)); }
//         const updateLoginQuery = 'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *';
//         const { rows } = await db.query(updateLoginQuery, [user.id]);
//         signAndSendToken(rows[0], 200, res);
//     } catch (error) { next(error); }
// });
// authRouter.post('/logout', (req, res) => {
//     res.cookie('jwt', 'loggedout', {
//         expires: new Date(Date.now() + 10 * 1000),
//         httpOnly: true,
//     });
//     res.status(200).json({ status: 'success' });
// });
// authRouter.get('/me', protect, (req, res) => {
//     res.status(200).json({ status: 'success', data: { user: req.user } });
// });
// app.use('/api/v1/auth', authRouter);

// // --- Monitors Routes ---
// const monitorRouter = express.Router();
// // ... (Your monitor routes code remains exactly the same)
// monitorRouter.use(protect);
// monitorRouter.post('/', async (req, res, next) => {
//     try {
//         const { name, http_method, base_url, endpoint, check_interval_seconds } = req.body;
//         const query = `INSERT INTO monitors (user_id, name, http_method, base_url, endpoint, check_interval_seconds) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
//         const { rows } = await db.query(query, [req.user.id, name, http_method, base_url, endpoint, check_interval_seconds]);
//         res.status(201).json({ status: 'success', data: { monitor: rows[0] } });
//     } catch (error) { next(error); }
// });
// monitorRouter.get('/', async (req, res, next) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC;', [req.user.id]);
//         res.status(200).json({ status: 'success', results: rows.length, data: { monitors: rows } });
//     } catch (error) { next(error); }
// });
// monitorRouter.get('/:id', async (req, res, next) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
//         if (rows.length === 0) { return next(new AppError('Monitor not found.', 404)); }
//         res.status(200).json({ status: 'success', data: { monitor: rows[0] } });
//     } catch (error) { next(error); }
// });
// monitorRouter.put('/:id', async (req, res, next) => {
//     try {
//         const { name, http_method, base_url, endpoint, check_interval_seconds, is_active } = req.body;
//         const query = `UPDATE monitors SET name = $1, http_method = $2, base_url = $3, endpoint = $4, check_interval_seconds = $5, is_active = $6, updated_at = NOW() WHERE id = $7 AND user_id = $8 RETURNING *;`;
//         const { rows } = await db.query(query, [name, http_method, base_url, endpoint, check_interval_seconds, is_active, req.params.id, req.user.id]);
//         if (rows.length === 0) { return next(new AppError('Monitor not found.', 404));}
//         res.status(200).json({ status: 'success', data: { monitor: rows[0] } });
//     } catch (error) { next(error); }
// });
// monitorRouter.delete('/:id', async (req, res, next) => {
//     try {
//         const result = await db.query('DELETE FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
//         if (result.rowCount === 0) { return next(new AppError('Monitor not found.', 404));}
//         res.status(204).json({ status: 'success', data: null });
//     } catch (error) { next(error); }
// });
// app.use('/api/v1/monitors', monitorRouter);

// // =================================================================
// // 6. ERROR HANDLING & SERVER START
// // =================================================================

// app.use((req, res, next) => {
//   next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

// app.use((err, req, res, next) => {
//   err.statusCode = err.statusCode || 500;
//   err.status = err.status || 'error';
//   console.error('💥 ERROR:', err);
//   res.status(err.statusCode).json({
//     status: err.status,
//     message: err.message,
//   });
// });

// const startServer = async () => {
//   await ensureSchema();
//   // --- REMOVED THE OLD CRON JOB STARTUP ---
//   const PORT = process.env.PORT || 8000;
//   app.listen(PORT, () => {
//     console.log(`🚀 Server is running on port ${PORT}`);
//   });
// };

// startServer();



// index.js (All-in-One with Detailed Responses)

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

const app = express();

// ... (Database, Schema, Polling Engine, and Middleware sections are unchanged)
// =================================================================
// 2. DATABASE CONNECTION & SCHEMA
// =================================================================
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});
db.on('connect', () => {
  console.log('🔗 Database connected successfully!');
});
const ensureSchema = async () => {
  console.log('Ensuring database schema exists...');
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NULL
    );
  `;
  const createMonitorsTableQuery = `
    CREATE TABLE IF NOT EXISTS monitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
      base_url TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      check_interval_seconds INTEGER NOT NULL DEFAULT 300,
      is_active BOOLEAN NOT NULL DEFAULT true,
      current_status VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_checked_at TIMESTAMPTZ NULL
    );
  `;
  const createHealthChecksTableQuery = `
    CREATE TABLE IF NOT EXISTS health_checks (
        id BIGSERIAL PRIMARY KEY,
        monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status_code INTEGER,
        response_time_ms INTEGER,
        was_successful BOOLEAN NOT NULL,
        error_message TEXT
    );
  `;
  try {
    await db.query(createUsersTableQuery);
    console.log('✅ "users" table is ready.');
    await db.query(createMonitorsTableQuery);
    console.log('✅ "monitors" table is ready.');
    await db.query(createHealthChecksTableQuery);
    console.log('✅ "health_checks" table is ready.');
    console.log('Schema setup complete.');
  } catch (err) {
    console.error('Error ensuring schema:', err);
    process.exit(1);
  }
};
// =================================================================
// 3. POLLING ENGINE LOGIC (To be triggered by Vercel)
// =================================================================
const runHealthChecks = async () => {
    console.log(`[${new Date().toISOString()}] Running health checks...`);
    try {
        const query = `
            SELECT * FROM monitors 
            WHERE is_active = true 
            AND (last_checked_at IS NULL OR last_checked_at <= NOW() - (check_interval_seconds * '1 second'::interval));
        `;
        const { rows: dueMonitors } = await db.query(query);
        if (dueMonitors.length === 0) {
            console.log('No monitors due for a check.');
            return;
        }
        console.log(`Found ${dueMonitors.length} monitor(s) to check.`);
        await Promise.all(dueMonitors.map(async (monitor) => {
            const startTime = Date.now();
            let checkResult = { statusCode: null, responseTime: null, wasSuccessful: false, errorMessage: null };
            try {
                const response = await axios({ method: monitor.http_method, url: `${monitor.base_url}${monitor.endpoint}`, timeout: 5000 });
                checkResult.statusCode = response.status;
                checkResult.wasSuccessful = response.status >= 200 && response.status < 300;
            } catch (error) {
                if (error.response) { checkResult.statusCode = error.response.status; }
                checkResult.errorMessage = error.message;
                checkResult.wasSuccessful = false;
            }
            checkResult.responseTime = Date.now() - startTime;
            await db.query('INSERT INTO health_checks (monitor_id, status_code, response_time_ms, was_successful, error_message) VALUES ($1, $2, $3, $4, $5)', [monitor.id, checkResult.statusCode, checkResult.responseTime, checkResult.wasSuccessful, checkResult.errorMessage]);
            await db.query('UPDATE monitors SET current_status = $1, last_checked_at = NOW() WHERE id = $2', [checkResult.wasSuccessful ? 'up' : 'down', monitor.id]);
        }));
        console.log('Health checks completed.');
    } catch (error) {
        console.error('💥 Error running health checks:', error);
    }
};
// =================================================================
// 4. MIDDLEWARE & UTILITIES
// =================================================================
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.cookies.jwt) { token = req.cookies.jwt; }
    if (!token) { return next(new AppError('You are not logged in.', 401)); }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [decoded.user.id]);
    const currentUser = rows[0];
    if (!currentUser) { return next(new AppError('The user for this token no longer exists.', 401)); }
    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Invalid token or session expired.', 401));
  }
};
// =================================================================
// 5. API ROUTES & LOGIC
// =================================================================

// --- Health Check Route ---
app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok', statusCode: 200, message: 'API is healthy and running.' })); // --- UPDATED ---

// --- Secure Endpoint for Vercel Cron Job ---
app.get('/api/v1/scheduler/run-checks', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    await runHealthChecks();
    res.status(200).json({ status: 'success', statusCode: 200, message: 'Health check scheduler triggered successfully.' }); // --- UPDATED ---
});

// --- Authentication Routes ---
const authRouter = express.Router();

const signAndSendToken = (user, statusCode, res) => {
    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  
    const cookieOptions = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    };
  
    res.cookie('jwt', token, cookieOptions);
    user.password_hash = undefined;
  
    // --- UPDATED --- This entire response object is now more detailed
    res.status(statusCode).json({
      status: 'success',
      statusCode: statusCode,
      message: statusCode === 201 ? 'User registered successfully.' : 'User logged in successfully.',
      token,
      data: { user },
    });
};

authRouter.post('/register', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password || password.length < 8) { return next(new AppError('Please provide a valid email and a password of at least 8 characters.', 400)); }
        const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) { return next(new AppError('A user with this email already exists.', 409));}
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const newUserQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at';
        const { rows } = await db.query(newUserQuery, [email, passwordHash]);
        signAndSendToken(rows[0], 201, res);
    } catch (error) { next(error); }
});

authRouter.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) { return next(new AppError('Please provide email and password.', 400));}
        const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userQuery.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) { return next(new AppError('Invalid credentials.', 401)); }
        const updateLoginQuery = 'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *';
        const { rows } = await db.query(updateLoginQuery, [user.id]);
        signAndSendToken(rows[0], 200, res);
    } catch (error) { next(error); }
});

authRouter.post('/logout', (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ status: 'success', statusCode: 200, message: 'User logged out successfully.' }); // --- UPDATED ---
});

authRouter.get('/me', protect, (req, res) => {
    res.status(200).json({ // --- UPDATED ---
        status: 'success',
        statusCode: 200,
        message: 'User profile retrieved successfully.',
        data: { user: req.user },
    });
});

app.use('/api/v1/auth', authRouter);

// --- Monitors Routes ---
const monitorRouter = express.Router();
monitorRouter.use(protect);

monitorRouter.post('/', async (req, res, next) => {
    try {
        const { name, http_method, base_url, endpoint, check_interval_seconds } = req.body;
        const query = `INSERT INTO monitors (user_id, name, http_method, base_url, endpoint, check_interval_seconds) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`;
        const { rows } = await db.query(query, [req.user.id, name, http_method, base_url, endpoint, check_interval_seconds]);
        res.status(201).json({ status: 'success', statusCode: 201, message: 'Monitor created successfully.', data: { monitor: rows[0] } }); // --- UPDATED ---
    } catch (error) { next(error); }
});

monitorRouter.get('/', async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC;', [req.user.id]);
        res.status(200).json({ status: 'success', statusCode: 200, message: 'Monitors retrieved successfully.', results: rows.length, data: { monitors: rows } }); // --- UPDATED ---
    } catch (error) { next(error); }
});

monitorRouter.get('/:id', async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT * FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
        if (rows.length === 0) { return next(new AppError('Monitor not found.', 404)); }
        res.status(200).json({ status: 'success', statusCode: 200, message: 'Monitor retrieved successfully.', data: { monitor: rows[0] } }); // --- UPDATED ---
    } catch (error) { next(error); }
});

monitorRouter.put('/:id', async (req, res, next) => {
    try {
        const { name, http_method, base_url, endpoint, check_interval_seconds, is_active } = req.body;
        const query = `UPDATE monitors SET name = $1, http_method = $2, base_url = $3, endpoint = $4, check_interval_seconds = $5, is_active = $6, updated_at = NOW() WHERE id = $7 AND user_id = $8 RETURNING *;`;
        const { rows } = await db.query(query, [name, http_method, base_url, endpoint, check_interval_seconds, is_active, req.params.id, req.user.id]);
        if (rows.length === 0) { return next(new AppError('Monitor not found.', 404));}
        res.status(200).json({ status: 'success', statusCode: 200, message: 'Monitor updated successfully.', data: { monitor: rows[0] } }); // --- UPDATED ---
    } catch (error) { next(error); }
});

monitorRouter.delete('/:id', async (req, res, next) => {
    try {
        const result = await db.query('DELETE FROM monitors WHERE id = $1 AND user_id = $2;', [req.params.id, req.user.id]);
        if (result.rowCount === 0) { return next(new AppError('Monitor not found.', 404));}
        res.status(204).send(); // --- UPDATED ---
    } catch (error) { next(error); }
});

app.use('/api/v1/monitors', monitorRouter);

// =================================================================
// 6. ERROR HANDLING & SERVER START
// =================================================================
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  console.error('💥 ERROR:', err);
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
});
const startServer = async () => {
  await ensureSchema();
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
};
startServer();