/**
 * ============================================================================
 * HEALTH ROUTES (healthRoutes.ts)
 * ============================================================================
 * Liveness and readiness probes for container orchestrators and load balancers.
 * These endpoints do NOT require authentication.
 * ============================================================================
 */

import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /health/live
 * Fast liveness probe — verifies the process is running.
 * Returns 200 immediately without checking downstream dependencies.
 */
router.get('/live', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

/**
 * GET /health/ready
 * Readiness probe — verifies database connectivity before accepting traffic.
 * Returns 200 when all systems are operational, 503 when degraded.
 */
router.get('/ready', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbConnected = dbState === 1;
  
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapUsagePercent = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;

  const isHealthy = dbConnected && heapUsagePercent < 90;

  const payload = {
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
    database_state: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      heap_usage_percent: heapUsagePercent,
    },
  };

  res.status(isHealthy ? 200 : 503).json(payload);
});

export default router;
