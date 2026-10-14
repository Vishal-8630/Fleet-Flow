/**
 * ============================================================================
 * PHASE 6A INTEGRATION SUITE: DASHBOARD RELIABILITY & DEEP HEALTH PROBES
 * ============================================================================
 * 
 * Verifies:
 * - ISS-015: Dashboard maintenance truck counter enum alignment ('in_maintenance')
 *            and inclusion of maintenance_trucks in summary payload.
 * - OPS-005: Deep readiness (/health/ready) and lightweight liveness (/health/live)
 *            probes with active round-trip MongoDB ping, latency instrumentation,
 *            strict timeout, conditional Redis checking, and memory metrics.
 * - Route compatibility: /health and /api/health path aliases.
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import { createTestTenant } from '../helpers.js';
import { Truck } from '../../models/Truck.js';
import { setCustomMongoChecker, setCustomRedisChecker } from '../../routes/healthRoutes.js';

describe('Phase 6A: Dashboard Reliability & Deep Health Probes (ISS-015 & OPS-005)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setCustomMongoChecker(null);
    setCustomRedisChecker(null);
    delete process.env.REDIS_URL;
  });

  // ==========================================================================
  // SUITE 1: ISS-015 Dashboard Maintenance Truck KPI & Tenant Isolation
  // ==========================================================================
  describe('1. ISS-015: Dashboard Maintenance KPI Counter', () => {
    it('counts vehicles with status: in_maintenance accurately in dashboard summary', async () => {
      const tenantA = await createTestTenant({ name: 'Alpha Logistics' });

      // Create trucks with diverse statuses in Tenant A
      await Truck.create([
        {
          company_id: tenantA.company._id,
          truck_no: 'MH04AB1001',
          make: 'Tata',
          model: 'Prima 5530',
          body_type: 'Container',
          tonnage_capacity: 40,
          status: 'in_maintenance', // In maintenance 1
        },
        {
          company_id: tenantA.company._id,
          truck_no: 'MH04AB1002',
          make: 'BharatBenz',
          model: '2823R',
          body_type: 'Open',
          tonnage_capacity: 28,
          status: 'in_maintenance', // In maintenance 2
        },
        {
          company_id: tenantA.company._id,
          truck_no: 'MH04AB1003',
          make: 'Ashok Leyland',
          model: '4220',
          body_type: 'Trailer',
          tonnage_capacity: 42,
          status: 'available', // Available
        },
        {
          company_id: tenantA.company._id,
          truck_no: 'MH04AB1004',
          make: 'Eicher',
          model: 'Pro 6028',
          body_type: 'Container',
          tonnage_capacity: 28,
          status: 'on_trip', // On trip
        },
      ]);

      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();

      const summary = res.body.summary;
      expect(summary.total_trucks).toBe(4);
      expect(summary.available_trucks).toBe(1);
      expect(summary.on_trip_trucks).toBe(1);
      expect(summary.maintenance_trucks).toBe(2);
      // availability ratio = (1 available / 4 total) * 100 = 25%
      expect(summary.fleet_availability_ratio).toBe(25);
    });

    it('returns zero maintenance_trucks when no vehicles are in maintenance', async () => {
      const tenantB = await createTestTenant({ name: 'Beta Freight' });

      await Truck.create([
        {
          company_id: tenantB.company._id,
          truck_no: 'KA01CD2001',
          make: 'Tata',
          model: 'Signa 4825',
          body_type: 'Open',
          tonnage_capacity: 35,
          status: 'available',
        },
        {
          company_id: tenantB.company._id,
          truck_no: 'KA01CD2002',
          make: 'Volvo',
          model: 'FM 420',
          body_type: 'Container',
          tonnage_capacity: 45,
          status: 'on_trip',
        },
      ]);

      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantB.token}`);

      expect(res.status).toBe(200);
      const summary = res.body.summary;
      expect(summary.total_trucks).toBe(2);
      expect(summary.available_trucks).toBe(1);
      expect(summary.on_trip_trucks).toBe(1);
      expect(summary.maintenance_trucks).toBe(0);
    });

    it('enforces strict tenant isolation and deleted-truck filtering on maintenance counts', async () => {
      const tenantX = await createTestTenant({ name: 'Tenant X Fleet' });
      const tenantY = await createTestTenant({ name: 'Tenant Y Fleet' });

      // Create 3 maintenance trucks in Tenant X, 1 of which is soft-deleted
      await Truck.create([
        {
          company_id: tenantX.company._id,
          truck_no: 'DL01EF3001',
          make: 'Tata',
          model: 'Signa',
          body_type: 'Open',
          tonnage_capacity: 25,
          status: 'in_maintenance',
          is_deleted: false,
        },
        {
          company_id: tenantX.company._id,
          truck_no: 'DL01EF3002',
          make: 'Tata',
          model: 'Signa',
          body_type: 'Open',
          tonnage_capacity: 25,
          status: 'in_maintenance',
          is_deleted: false,
        },
        {
          company_id: tenantX.company._id,
          truck_no: 'DL01EF3003',
          make: 'Tata',
          model: 'Signa',
          body_type: 'Open',
          tonnage_capacity: 25,
          status: 'in_maintenance',
          is_deleted: true, // Soft-deleted: must be excluded from active count
        },
      ]);

      // Tenant Y has 0 trucks
      const resY = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantY.token}`);

      expect(resY.status).toBe(200);
      expect(resY.body.summary.maintenance_trucks).toBe(0);
      expect(resY.body.summary.total_trucks).toBe(0);

      // Tenant X has 2 active maintenance trucks (excluding the soft-deleted one)
      const resX = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${tenantX.token}`);

      expect(resX.status).toBe(200);
      expect(resX.body.summary.maintenance_trucks).toBe(2);
      expect(resX.body.summary.total_trucks).toBe(2);
    });
  });

  // ==========================================================================
  // SUITE 2: OPS-005 Liveness Health Probe
  // ==========================================================================
  describe('2. OPS-005: Liveness Probe (/health/live & /api/health/live)', () => {
    it('returns HTTP 200 with ok status and valid uptime on /health/live', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.timestamp).toBe('string');
      expect(typeof res.body.uptime_seconds).toBe('number');
      expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    });

    it('supports route aliases /health/liveness, /api/health/live, and /api/health/liveness', async () => {
      const endpoints = [
        '/health/liveness',
        '/api/health/live',
        '/api/health/liveness',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime_seconds).toBe('number');
      }
    });

    it('does not query downstream database and succeeds even when database is disconnected', async () => {
      // Mock readyState as disconnected
      const readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0 as any);

      try {
        const res = await request(app).get('/health/live');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
      } finally {
        readyStateSpy.mockRestore();
      }
    });
  });

  // ==========================================================================
  // SUITE 3: OPS-005 Deep Readiness Health Probe
  // ==========================================================================
  describe('3. OPS-005: Deep Readiness Probe (/health/ready & /api/health/ready)', () => {
    it('returns HTTP 200 with UP status and non-negative MongoDB ping latency when healthy', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.database).toBe('CONNECTED');
      expect(res.body.database_state).toBe('connected');

      // Checks sub-structure
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.mongodb).toBeDefined();
      expect(res.body.checks.mongodb.status).toBe('CONNECTED');
      expect(typeof res.body.checks.mongodb.latency_ms).toBe('number');
      expect(res.body.checks.mongodb.latency_ms).toBeGreaterThanOrEqual(0);

      // Redis skipped by default
      expect(res.body.checks.redis).toBeDefined();
      expect(res.body.checks.redis.status).toBe('SKIPPED');
    });

    it('supports route aliases /health/readiness, /api/health/ready, and /api/health/readiness', async () => {
      const endpoints = [
        '/health/readiness',
        '/api/health/ready',
        '/api/health/readiness',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UP');
        expect(res.body.checks.mongodb.status).toBe('CONNECTED');
      }
    });

    it('reports numeric, non-negative memory metrics in both root and checks objects', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      const { memory, checks } = res.body;

      expect(typeof memory.heap_used_mb).toBe('number');
      expect(memory.heap_used_mb).toBeGreaterThan(0);
      expect(typeof memory.heap_total_mb).toBe('number');
      expect(memory.heap_total_mb).toBeGreaterThan(0);
      expect(typeof memory.heap_usage_percent).toBe('number');
      expect(memory.heap_usage_percent).toBeGreaterThanOrEqual(0);
      expect(memory.heap_usage_percent).toBeLessThanOrEqual(100);

      // Legacy compatibility
      expect(checks.memory.heap_used_mb).toBe(memory.heap_used_mb);
      expect(checks.memory.heap_total_mb).toBe(memory.heap_total_mb);
      expect(checks.memory.heap_usage_percent).toBe(memory.heap_usage_percent);
    });

    it('returns HTTP 503 DEGRADED when MongoDB ping fails', async () => {
      setCustomMongoChecker(async () => ({
        healthy: false,
        latency_ms: 15,
        error: 'PING_FAILED',
      }));

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.database).toBe('DISCONNECTED');
      expect(res.body.checks.mongodb.status).toBe('PING_FAILED');

      // Verify no sensitive connection strings or raw stack traces are exposed in response
      expect(res.body.checks.mongodb.error).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/MongoNetworkError/);
    });

    it('returns HTTP 503 DEGRADED when MongoDB ping times out (>2000ms)', async () => {
      setCustomMongoChecker(async () => ({
        healthy: false,
        latency_ms: 2005,
        error: 'TIMEOUT',
      }));

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.database).toBe('DISCONNECTED');
      expect(res.body.checks.mongodb.status).toBe('TIMEOUT');
    });

    it('returns HTTP 503 when mongoose readyState indicates disconnected', async () => {
      const readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0 as any);

      try {
        const res = await request(app).get('/health/ready');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('DEGRADED');
        expect(res.body.database).toBe('DISCONNECTED');
        expect(res.body.checks.mongodb.status).toBe('DISCONNECTED');
      } finally {
        readyStateSpy.mockRestore();
      }
    });

    it('correctly reflects Redis readiness without leaking credentials when configured', async () => {
      // 1. Healthy Redis simulation
      setCustomRedisChecker(async () => ({
        healthy: true,
        latency_ms: 1,
      }));

      const resHealthy = await request(app).get('/health/ready');
      expect(resHealthy.status).toBe(200);
      expect(resHealthy.body.status).toBe('UP');
      expect(resHealthy.body.checks.redis.status).toBe('CONNECTED');
      expect(resHealthy.body.checks.redis.latency_ms).toBe(1);

      // 2. Degraded Redis simulation
      setCustomRedisChecker(async () => ({
        healthy: false,
        error: 'CONNECTION_REFUSED',
      }));

      const resDegraded = await request(app).get('/health/ready');
      expect(resDegraded.status).toBe(503);
      expect(resDegraded.body.status).toBe('DEGRADED');
      expect(resDegraded.body.checks.redis.status).toBe('CONNECTION_REFUSED');

      // Verify no sensitive connection strings or passwords leaked
      expect(JSON.stringify(resDegraded.body)).not.toMatch(/redis:\/\//i);
      expect(JSON.stringify(resDegraded.body)).not.toMatch(/password/i);

      setCustomRedisChecker(null);
    });

    it('returns HTTP 503 DEGRADED and CONNECTION_FAILED when real REDIS_URL points to an unreachable port', async () => {
      // Configure an unreachable port on localhost
      process.env.REDIS_URL = 'redis://127.0.0.1:59998';

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.checks.redis.status).toBe('CONNECTION_FAILED');

      // Assert zero credentials or URL leaked
      expect(JSON.stringify(res.body)).not.toMatch(/127\.0\.0\.1:59998/);
      expect(JSON.stringify(res.body)).not.toMatch(/redis:\/\//i);

      delete process.env.REDIS_URL;
    });

    it('returns HTTP 503 DEGRADED and INVALID_URL when REDIS_URL is malformed', async () => {
      process.env.REDIS_URL = '://invalid-redis-uri';

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.checks.redis.status).toBe('INVALID_URL');

      delete process.env.REDIS_URL;
    });

    it('returns HTTP 503 DEGRADED and AUTH_FAILED when Redis authentication fails', async () => {
      setCustomRedisChecker(async () => ({
        healthy: false,
        error: 'AUTH_FAILED',
      }));

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.checks.redis.status).toBe('AUTH_FAILED');

      setCustomRedisChecker(null);
    });

    it('handles Redis ACL URLs with username and URL-encoded credentials without leaking them on failure', async () => {
      process.env.REDIS_URL = 'redis://fleet_user:p%40ss%23word123@127.0.0.1:59997';

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.checks.redis.status).toBe('CONNECTION_FAILED');

      // Zero credential leakage
      expect(JSON.stringify(res.body)).not.toMatch(/fleet_user/);
      expect(JSON.stringify(res.body)).not.toMatch(/p%40ss/);
      expect(JSON.stringify(res.body)).not.toMatch(/p@ss#word/);

      delete process.env.REDIS_URL;
    });

    it('supports rediss:// TLS scheme and reports CONNECTION_FAILED without crash on unreachable TLS port', async () => {
      process.env.REDIS_URL = 'rediss://127.0.0.1:59996';

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.checks.redis.status).toBe('CONNECTION_FAILED');

      delete process.env.REDIS_URL;
    });

    it('rejects unsupported URI protocols (e.g. http://) with INVALID_URL', async () => {
      process.env.REDIS_URL = 'http://127.0.0.1:6379';

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.checks.redis.status).toBe('INVALID_URL');

      delete process.env.REDIS_URL;
    });

    it('preserves existing root GET /health endpoint compatibility', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.dbConnected).toBe(true);
      expect(typeof res.body.uptime).toBe('number');
    });
  });
});
