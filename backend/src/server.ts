/**
 * ============================================================================
 * FLEET FLOW — EXPRESS SERVER ENTRYPOINT (server.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * This is the primary entry point for the Fleet Flow backend REST API. It
 * configures Express 5, security middleware (Helmet, CORS, Cookie Parser),
 * global routing, centralized error handling, and the MongoDB Atlas database
 * connection.
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * - Centralizes HTTP server configuration and environment loading in one place.
 * - Secures HTTP headers using `helmet` against cross-site scripting and sniffing.
 * - Enables CORS with `credentials: true` so the Vite React frontend can transmit
 *   and receive secure `HttpOnly` session cookies across origins.
 * - Exports the configured `app` and `startServer()` function for both standalone
 *   execution and automated testing harnesses without port collisions.
 * ============================================================================
 */

import 'dotenv/config'; // MUST be first import so process.env is initialized before any ESM module evaluation
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_saas';

// ----------------------------------------------------------------------------
// 1. Security & Body Parsing Middleware
// ----------------------------------------------------------------------------

// Helmet adds secure HTTP response headers
app.use(helmet());

// Cross-Origin Resource Sharing (CORS) configured for cookie exchange with frontend
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Cookie parser parses cookies attached to client requests (for HttpOnly JWT)
app.use(cookieParser());

// Express body parsers support JSON and URL-encoded bodies up to 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger in development mode
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ----------------------------------------------------------------------------
// 2. Health Check & Diagnostics
// ----------------------------------------------------------------------------
/**
 * GET /health
 * Lightweight endpoint used by cloud container health checks, load balancers,
 * and uptime monitors to verify system and database liveness.
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1,
  });
});

// ----------------------------------------------------------------------------
// 3. API Route Mounts
// ----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);

// ----------------------------------------------------------------------------
// 4. Centralized Global Error Handler
// Catches unhandled exceptions thrown anywhere in the controller chain
// ----------------------------------------------------------------------------
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ----------------------------------------------------------------------------
// 5. Database Connection & Server Initialization
// ----------------------------------------------------------------------------
export async function startServer() {
  try {
    if (MONGODB_URI && !MONGODB_URI.includes('<password>')) {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB Atlas / Database successfully.');
    } else {
      console.log('⚠️ MongoDB URI contains placeholders. Server starting in offline DB mode.');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Fleet Flow SaaS Backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection failure:', error);
  }
}

// Automatically start listening unless running inside a test runner
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
