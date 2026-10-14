/**
 * ============================================================================
 * HEALTH ROUTES (healthRoutes.ts)
 * ============================================================================
 * Liveness and deep readiness probes for container orchestrators (Kubernetes / AWS ECS),
 * load balancers (AWS ALB / Nginx), and SRE monitoring systems.
 * These endpoints do NOT require authentication.
 * 
 * OPS-005 Compliance:
 * - /health/live: Ultra-lightweight process responsiveness check.
 * - /health/ready: Deep active dependency connectivity check with:
 *     1. Active MongoDB round-trip ping (admin().ping()) with latency & 2s timeout.
 *     2. Conditional Redis check (only if REDIS_URL is configured).
 *     3. Memory usage metrics (heap_used_mb, heap_total_mb, heap_usage_percent).
 *     4. HTTP 503 when critical dependencies fail or time out.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import net from 'net';
import tls from 'tls';

const router = Router();

const PING_TIMEOUT_MS = 2000;

// Pluggable dependency checkers for deterministic testing and future driver modules
export type MongoChecker = () => Promise<{ healthy: boolean; latency_ms: number; error?: string }>;
export type RedisChecker = () => Promise<{ healthy: boolean; latency_ms?: number; error?: string }>;

let customMongoChecker: MongoChecker | null = null;
let customRedisChecker: RedisChecker | null = null;

export function setCustomMongoChecker(checker: MongoChecker | null): void {
  customMongoChecker = checker;
}

export function setCustomRedisChecker(checker: RedisChecker | null): void {
  customRedisChecker = checker;
}

/**
 * Executes an active round-trip ping to MongoDB using the current Mongoose connection.
 * Applies a strict timeout of PING_TIMEOUT_MS (2000ms).
 * 
 * Driver Timeout Semantics (MongoDB Node.js Driver 6.20.0):
 * - Admin.prototype.ping forwards options to Admin.prototype.command.
 * - In mongodb@6.20.0, Admin.prototype.command explicitly forwards timeoutMS via CSOT
 *   (Client-Side Operation Timeout): `timeoutMS: options?.timeoutMS ?? this.s.db.timeoutMS`.
 *   It does NOT forward AbortSignal `signal`.
 * - timeoutMS triggers driver-level socket/selection timeouts, closing timed-out connections.
 * - Promise.race with an application-level setTimeout serves as a deterministic failsafe boundary.
 */
async function pingMongoWithTimeout(timeoutMs = PING_TIMEOUT_MS): Promise<{
  healthy: boolean;
  latency_ms: number;
  error?: string;
}> {
  if (customMongoChecker) {
    return customMongoChecker();
  }

  const db = mongoose.connection.db;
  const readyState = mongoose.connection.readyState;

  if (!db || readyState !== 1) {
    return {
      healthy: false,
      latency_ms: -1,
      error: readyState === 2 ? 'CONNECTING' : 'DISCONNECTED',
    };
  }

  const startTime = Date.now();
  let timer: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, timeoutMs);
    });

    // Active MongoDB round-trip ping using driver CSOT timeoutMS option
    const pingPromise = (db.admin() as any).ping({
      timeoutMS: timeoutMs,
      maxTimeMS: timeoutMs,
    });

    await Promise.race([pingPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    const latency_ms = Math.max(0, Date.now() - startTime);
    return { healthy: true, latency_ms };
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    const latency_ms = Math.max(0, Date.now() - startTime);
    const errorMsg =
      err?.message === 'TIMEOUT' ||
      err?.name === 'MongoOperationTimeoutError' ||
      err?.message?.includes('timed out') ||
      err?.message?.includes('timeout')
        ? 'TIMEOUT'
        : 'PING_FAILED';
    return { healthy: false, latency_ms, error: errorMsg };
  }
}

/**
 * Performs a lightweight RESP (REdis Serialization Protocol) handshake over TCP or TLS
 * to the configured REDIS_URL using Node's standard net / tls modules.
 * 
 * Semantics & Authentication Compatibility:
 * - Supports redis:// and rediss:// (TLS) URL schemes.
 * - Supports legacy password authentication (redis://:password@host:port).
 * - Supports Redis 6+ ACL authentication with username and password (redis://user:password@host:port).
 * - Handles URL-encoded credentials (e.g. p%40ssword -> p@ssword).
 * - Accurately categorizes AUTH_REQUIRED, AUTH_FAILED, CONNECTION_FAILED, TIMEOUT, INVALID_URL, INVALID_RESPONSE.
 * - Guarantees deterministic resource cleanup (removes socket listeners, clears timer, destroys socket).
 * - Avoids external dependencies or persistent connection pools.
 */
function probeRedisRESP(redisUrl: string, timeoutMs = PING_TIMEOUT_MS): Promise<{
  healthy: boolean;
  latency_ms: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    let settled = false;
    let socket: net.Socket | tls.TLSSocket | null = null;
    const startTime = Date.now();

    const cleanupAndResolve = (result: {
      healthy: boolean;
      latency_ms: number;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
        socket = null;
      }

      resolve(result);
    };

    try {
      const parsed = new URL(redisUrl);
      if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
        return cleanupAndResolve({
          healthy: false,
          latency_ms: Math.max(0, Date.now() - startTime),
          error: 'INVALID_URL',
        });
      }

      const host = parsed.hostname || 'localhost';
      const port = Number(parsed.port) || 6379;
      const username = parsed.username ? decodeURIComponent(parsed.username) : null;
      const password = parsed.password ? decodeURIComponent(parsed.password) : null;

      // Connect via TLS for rediss:// or plaintext TCP for redis://
      if (parsed.protocol === 'rediss:') {
        socket = tls.connect({
          host,
          port,
          servername: net.isIP(host) ? undefined : host,
        });
      } else {
        socket = net.createConnection({ host, port });
      }

      timer = setTimeout(() => {
        cleanupAndResolve({
          healthy: false,
          latency_ms: Math.max(0, Date.now() - startTime),
          error: 'TIMEOUT',
        });
      }, timeoutMs);

      const onConnected = () => {
        // Redis ACL support: if username is present and not 'default', send AUTH <username> <password>
        if (username && username !== 'default' && password) {
          socket!.write(`AUTH ${username} ${password}\r\nPING\r\n`);
        } else if (password) {
          socket!.write(`AUTH ${password}\r\nPING\r\n`);
        } else {
          socket!.write('PING\r\n');
        }
      };

      if (parsed.protocol === 'rediss:') {
        socket.on('secureConnect', onConnected);
      } else {
        socket.on('connect', onConnected);
      }

      socket.on('data', (data) => {
        const latency_ms = Math.max(0, Date.now() - startTime);
        const response = data.toString();

        if (response.includes('+PONG') || response.includes('PONG')) {
          cleanupAndResolve({ healthy: true, latency_ms });
        } else if (response.includes('-NOAUTH')) {
          // Redis rejected because password was missing or required
          cleanupAndResolve({ healthy: false, latency_ms, error: 'AUTH_REQUIRED' });
        } else if (response.includes('-WRONGPASS') || response.includes('-ERR') || response.includes('invalid password')) {
          // Redis authentication failed with wrong credentials or invalid arguments
          cleanupAndResolve({ healthy: false, latency_ms, error: 'AUTH_FAILED' });
        } else {
          // Non-RESP or unrecognized payload
          cleanupAndResolve({ healthy: false, latency_ms, error: 'INVALID_RESPONSE' });
        }
      });

      socket.on('timeout', () => {
        cleanupAndResolve({
          healthy: false,
          latency_ms: Math.max(0, Date.now() - startTime),
          error: 'TIMEOUT',
        });
      });

      socket.on('error', () => {
        cleanupAndResolve({
          healthy: false,
          latency_ms: Math.max(0, Date.now() - startTime),
          error: 'CONNECTION_FAILED',
        });
      });
    } catch {
      cleanupAndResolve({
        healthy: false,
        latency_ms: Math.max(0, Date.now() - startTime),
        error: 'INVALID_URL',
      });
    }
  });
}

/**
 * GET /health/live & /health/liveness
 * Fast, lightweight liveness probe — verifies the Node.js event loop is responsive.
 * Returns 200 immediately without querying downstream dependencies.
 */
export function handleLiveness(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
}

/**
 * GET /health/ready & /health/readiness
 * Deep readiness probe — actively verifies downstream database and cache connectivity.
 * Returns HTTP 200 when all systems are operational, HTTP 503 when degraded.
 */
export async function handleReadiness(_req: Request, res: Response): Promise<void> {
  const dbState = mongoose.connection.readyState;
  const mongoCheck = await pingMongoWithTimeout(PING_TIMEOUT_MS);

  // Redis check: conditional upon REDIS_URL or custom checker
  let redisCheck: { healthy: boolean; latency_ms?: number; status: string } | null = null;
  const redisUrl = process.env.REDIS_URL;

  if (customRedisChecker) {
    const customRes = await customRedisChecker();
    redisCheck = {
      healthy: customRes.healthy,
      status: customRes.healthy ? 'CONNECTED' : (customRes.error || 'DISCONNECTED'),
      latency_ms: customRes.latency_ms,
    };
  } else if (redisUrl) {
    const redisRes = await probeRedisRESP(redisUrl, PING_TIMEOUT_MS);
    redisCheck = {
      healthy: redisRes.healthy,
      status: redisRes.healthy ? 'CONNECTED' : (redisRes.error || 'DISCONNECTED'),
      latency_ms: redisRes.latency_ms >= 0 ? redisRes.latency_ms : undefined,
    };
  } else {
    // Redis is not configured; skip without penalizing readiness
    redisCheck = {
      healthy: true,
      status: 'SKIPPED',
    };
  }

  // Memory metrics
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapUsagePercent = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;

  // Determine overall readiness
  const isHealthy = mongoCheck.healthy && redisCheck.healthy && heapUsagePercent < 95;

  const payload = {
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: mongoCheck.healthy ? 'CONNECTED' : 'DISCONNECTED',
    database_state: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
    checks: {
      mongodb: {
        status: mongoCheck.healthy ? 'CONNECTED' : (mongoCheck.error || 'DISCONNECTED'),
        latency_ms: mongoCheck.latency_ms >= 0 ? mongoCheck.latency_ms : undefined,
      },
      redis: {
        status: redisCheck.status,
        ...(redisCheck.latency_ms !== undefined ? { latency_ms: redisCheck.latency_ms } : {}),
      },
      memory: {
        heap_used_mb: heapUsedMB,
        heap_total_mb: heapTotalMB,
        heap_usage_percent: heapUsagePercent,
      },
    },
    memory: {
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      heap_usage_percent: heapUsagePercent,
    },
  };

  res.status(isHealthy ? 200 : 503).json(payload);
}

// Routes registration with aliases
router.get(['/live', '/liveness'], handleLiveness);
router.get(['/ready', '/readiness'], handleReadiness);

export default router;
