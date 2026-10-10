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

import 'dotenv/config'; // Loads .env including Gmail SMTP transport configuration
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import truckRoutes from './routes/truckRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import partyRoutes from './routes/partyRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import journeyRoutes from './routes/journeyRoutes.js';
import vehicleEntryRoutes from './routes/vehicleEntryRoutes.js';
import entryRoutes from './routes/entryRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import customFieldRoutes from './routes/customFieldRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { noSqlSanitizer } from './middleware/securityMiddleware.js';

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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        /^http:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+(:[0-9]+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, process.env.CLIENT_ORIGIN || 'http://localhost:5173');
    },
    credentials: true,
  })
);

// Cookie parser parses cookies attached to client requests (for HttpOnly JWT)
app.use(cookieParser());

// Express body parsers support JSON and URL-encoded bodies up to 10MB
// Retains raw request body buffer for cryptographic HMAC webhook signature validation
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize request data against NoSQL injection
app.use(noSqlSanitizer);

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
app.use('/api/fleet/trucks', truckRoutes);
app.use('/api/fleet/drivers', driverRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/operations/journeys', journeyRoutes);
app.use('/api/operations/vehicle-entries', vehicleEntryRoutes);
app.use('/api/commercial/entries', entryRoutes);
app.use('/api/commercial/invoices', invoiceRoutes);
app.use('/api/commercial/settlements', settlementRoutes);
app.use('/api/commercial/ledger', ledgerRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/settings/custom-fields', customFieldRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/public/track', trackingRoutes);
app.use('/api/dashboard', dashboardRoutes);

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

/**
 * Strict Environment Verification Guard
 * Enforces that critical production secrets are defined before accepting traffic.
 */
function assertProductionEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = ['JWT_SECRET', 'MONGODB_URI', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      console.error(`❌ FATAL: Missing mandatory production environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }
    if (process.env.JWT_SECRET === 'dev_secret_fallback_key') {
      console.error('❌ FATAL: JWT_SECRET cannot use insecure default fallback in production mode.');
      process.exit(1);
    }
  }
}

// ----------------------------------------------------------------------------
// 5. Database Connection & Server Initialization
// ----------------------------------------------------------------------------
export async function startServer() {
  try {
    assertProductionEnvironment();

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
