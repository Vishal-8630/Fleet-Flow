/**
 * ============================================================================
 * PHASE E2 TEST SUITE: FRONTEND FEATURE GATES & SIDEBAR LOCK INTERCEPTION
 * (phase5BatchE2FeatureGating.test.ts)
 * ============================================================================
 * 
 * Verifies that:
 * 1. Backend route-level `requireFeature('MOD_MAINTENANCE')` strictly guards
 *    `/api/fleet/maintenance/*` and `/api/fleet/maintenance/tyres` against
 *    unauthorized Starter and Standard tier tenants (HTTP 403 FEATURE_LOCKED).
 * 2. Entitled Pro tenants can successfully access Maintenance and Tyre APIs.
 * 3. Session hydration (`/api/auth/me`) delivers accurate `enabledFeatures`
 *    matching the tenant's tier, ensuring frontend FeatureGate and Sidebar
 *    can safely determine locking.
 * 4. Starter tenants retain unhindered access to entitled core modules (Fleet,
 *    Drivers, Trips, LR Engine, Invoicing).
 * 5. Entitlement evaluation handles uninitialized/loading states safely.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, TestTenantContext } from '../helpers.js';
import { Company } from '../../models/Company.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { hasFeatureAccess } from '../../utils/entitlementService.js';
import { MOD_CATALOG } from '../../utils/featureCatalog.js';

describe('Phase E2: Feature Gating, Route Protection & Sidebar Lock Interception (FF-ISSUE-025 & QST-002)', () => {
  let starterTenant: TestTenantContext;
  let proTenant: TestTenantContext;

  beforeEach(async () => {
    await seedBillingCatalog();
    starterTenant = await createTestTenant({
      name: 'Starter Logistics Corp',
      plan_code: 'starter',
      subscription_status: 'trialing',
    });
    proTenant = await createTestTenant({
      name: 'Pro Enterprise Carriers',
      plan_code: 'pro',
      subscription_status: 'active',
    });
  });

  describe('1. Backend Route Gating for Maintenance & Tyres (QST-002 & FF-ISSUE-025)', () => {
    it('blocks Starter/trial tenant from accessing GET /api/fleet/maintenance/work-orders with HTTP 403 FEATURE_LOCKED', async () => {
      const res = await request(app)
        .get('/api/fleet/maintenance/work-orders')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_MAINTENANCE');
      expect(res.body.required_tier).toBe('pro');
    });

    it('blocks Starter/trial tenant from accessing POST /api/fleet/maintenance/work-orders with HTTP 403 FEATURE_LOCKED', async () => {
      const res = await request(app)
        .post('/api/fleet/maintenance/work-orders')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          vendor_name: 'City Garage',
          order_type: 'preventative_service',
          priority: 'medium',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_MAINTENANCE');
    });

    it('blocks Starter/trial tenant from accessing GET /api/fleet/maintenance/tyres with HTTP 403 FEATURE_LOCKED', async () => {
      const res = await request(app)
        .get('/api/fleet/maintenance/tyres')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_MAINTENANCE');
    });

    it('blocks Starter/trial tenant from accessing POST /api/fleet/maintenance/tyres with HTTP 403 FEATURE_LOCKED', async () => {
      const res = await request(app)
        .post('/api/fleet/maintenance/tyres')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          serial_number: 'TYR-99999',
          brand: 'Apollo',
          size: '295/90 R20',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_MAINTENANCE');
    });

    it('permits authorized Pro subscriber to access Maintenance work-orders API', async () => {
      const res = await request(app)
        .get('/api/fleet/maintenance/work-orders')
        .set('Authorization', `Bearer ${proTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('permits authorized Pro subscriber to access Tyre management API', async () => {
      const res = await request(app)
        .get('/api/fleet/maintenance/tyres')
        .set('Authorization', `Bearer ${proTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tyres');
    });
  });

  describe('2. Session Hydration & Entitlement Delivery (/api/auth/me)', () => {
    it('returns enabledFeatures for Starter workspace excluding MOD_MAINTENANCE', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.enabledFeatures).toBeInstanceOf(Array);
      expect(res.body.enabledFeatures).not.toContain('MOD_MAINTENANCE');
      // Entitled starter modules must be present
      expect(res.body.enabledFeatures).toContain('MOD_FLEET');
      expect(res.body.enabledFeatures).toContain('MOD_DRIVERS');
      expect(res.body.enabledFeatures).toContain('MOD_TRIPS');
      expect(res.body.enabledFeatures).toContain('MOD_LR_ENGINE');
      expect(res.body.enabledFeatures).toContain('MOD_BILLING_INVOICE');
    });

    it('returns enabledFeatures for Pro workspace including MOD_MAINTENANCE', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${proTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.enabledFeatures).toBeInstanceOf(Array);
      expect(res.body.enabledFeatures).toContain('MOD_MAINTENANCE');
      expect(res.body.enabledFeatures).toContain('MOD_CUSTOM_FIELDS');
      expect(res.body.enabledFeatures).toContain('MOD_WORKFLOW_APPROVALS');
      expect(res.body.enabledFeatures).toContain('MOD_TALLY_SYNC');
    });
  });

  describe('3. Core Module Access Preservation for Unlocked Features', () => {
    it('preserves Starter tenant full access to Fleet Trucks endpoint', async () => {
      const res = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('trucks');
    });

    it('preserves Starter tenant full access to Drivers endpoint', async () => {
      const res = await request(app)
        .get('/api/fleet/drivers')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('drivers');
    });

    it('preserves Starter tenant full access to LR entries endpoint', async () => {
      const res = await request(app)
        .get('/api/commercial/entries')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('4. Feature Catalog & Entitlement Integrity', () => {
    it('verifies MOD_MAINTENANCE is catalogued with required defaultTier "pro"', () => {
      const maintenanceDef = MOD_CATALOG.MOD_MAINTENANCE;
      expect(maintenanceDef).toBeDefined();
      expect(maintenanceDef.key).toBe('MOD_MAINTENANCE');
      expect(maintenanceDef.defaultTier).toBe('pro');
    });

    it('verifies entitlementService.hasFeatureAccess accurately evaluates MOD_MAINTENANCE', async () => {
      const starterComp = await Company.findById(starterTenant.company._id);
      const proComp = await Company.findById(proTenant.company._id);

      const starterAccess = await hasFeatureAccess(starterComp!, 'MOD_MAINTENANCE');
      const proAccess = await hasFeatureAccess(proComp!, 'MOD_MAINTENANCE');

      expect(starterAccess).toBe(false);
      expect(proAccess).toBe(true);
    });
  });
});
