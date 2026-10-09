import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_saas';

// Security & Parsing Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1,
  });
});

// API Routes
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Database Connection & Server Startup
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

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
