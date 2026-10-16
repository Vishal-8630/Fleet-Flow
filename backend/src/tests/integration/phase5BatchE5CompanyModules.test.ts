/**
 * ============================================================================
 * PHASE E5 TEST SUITE: COMPANY-LEVEL MODULE PREFERENCES & ENTITLEMENT SERVICE
 * (phase5BatchE5CompanyModules.test.ts)
 * ============================================================================
 * 
 * Verifies Phase 1 Data Model & Entitlement Evaluation:
 * 1. Default Inheritance: When company.settings.enabled_modules is undefined,
 *    the tenant inherits 100% of plan-eligible modules.
 * 2. Explicit Preferences: When company.settings.enabled_modules is an array,
 *    effective access is strictly: EffectiveAccess = PlanEntitlements ∩ CompanyEnabledModules.
 * 3. Plan Ceiling Defense: Storing unentitled modules in company preferences
 *    does not grant access (e.g. Starter tenant cannot gain Pro features).
 * 4. Core Module Disablement: Company Admins can disable ANY module in their
 *    plan (including MOD_FLEET, MOD_DRIVERS, MOD_TRIPS, etc.).
 * 5. Plan Downgrade: Downgrading a subscription immediately removes access to
 *    modules no longer included in the plan, even if previously enabled.
 * 6. Plan Upgrade with Defaults: When upgrading from Starter to Pro without
 *    explicit preferences, new Pro modules activate automatically.
 * 7. Plan Upgrade with Explicit Preferences: When upgrading with explicit
 *    preferences, existing intentional disablements remain disabled, and newly
 *    entitled modules do not silently activate.
 * 8. Add-on Entitlements: Active add-on modules are included in plan_features
 *    and effective access.
 * 9. Route Gating Differentiation: requireFeature returns HTTP 403 FEATURE_LOCKED
 *    for plan-locked features, and HTTP 403 MODULE_DISABLED for company-disabled features.
 * 10. Expired Subscriptions: Expired/suspended subscriptions retain is_read_only = true.
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { createTestTenant, createSuperAdmin, TestTenantContext } from '../helpers.js';
import { Company } from '../../models/Company.js';
import { Subscription } from '../../models/Subscription.js';
import { Plan } from '../../models/Plan.js';
import { AddOn } from '../../models/AddOn.js';
import { AuditLog } from '../../models/AuditLog.js';
import { seedBillingCatalog } from '../../utils/billingSeedService.js';
import { getTenantEntitlements, hasFeatureAccess } from '../../utils/entitlementService.js';
import { ModuleKey } from '../../utils/featureCatalog.js';

describe('Phase E5: Company Module Preferences & Entitlement Service (FF-ISSUE-024)', () => {
  let starterTenant: TestTenantContext;
  let proTenant: TestTenantContext;

  beforeEach(async () => {
    await seedBillingCatalog();

    starterTenant = await createTestTenant({
      name: 'Starter Logistics Corp',
      plan_code: 'starter',
      subscription_status: 'active',
    });

    proTenant = await createTestTenant({
      name: 'Pro Transport Fleet',
      plan_code: 'pro',
      subscription_status: 'active',
    });
  });

  describe('1. Default Plan Inheritance (enabled_modules === undefined)', () => {
    it('inherits 100% of eligible plan modules by default when enabled_modules is undefined', async () => {
      const company = await Company.findById(starterTenant.company._id);
      expect(company?.settings?.enabled_modules).toBeUndefined();

      const profile = await getTenantEntitlements(company!);
      expect(profile.plan_features).toContain('MOD_FLEET');
      expect(profile.plan_features).toContain('MOD_TRIPS');
      expect(profile.plan_features).toContain('MOD_LR_ENGINE');
      expect(profile.plan_features).toContain('MOD_BILLING_INVOICE');
      expect(profile.plan_features).not.toContain('MOD_MAINTENANCE'); // Pro only

      // Effective access matches plan_features exactly
      expect(profile.enabled_features).toEqual(profile.plan_features);
      expect(await hasFeatureAccess(company!, 'MOD_FLEET')).toBe(true);
      expect(await hasFeatureAccess(company!, 'MOD_LR_ENGINE')).toBe(true);
      expect(await hasFeatureAccess(company!, 'MOD_MAINTENANCE')).toBe(false);
    });
  });

  describe('2. Explicit Company Preferences (EffectiveAccess = Plan ∩ Company)', () => {
    it('restricts effective access to the intersection of plan entitlements and company preferences', async () => {
      // Company admin voluntarily disables Market Vehicles and Billing Invoice
      const explicitModules: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_PARTIES', 'MOD_DOCUMENT_VAULT', 'MOD_TRIPS', 'MOD_LR_ENGINE'];
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: { 'settings.enabled_modules': explicitModules },
      });

      const updatedCompany = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(updatedCompany!);

      // Plan features still contains all starter modules
      expect(profile.plan_features).toContain('MOD_MARKET_VEHICLES');
      expect(profile.plan_features).toContain('MOD_BILLING_INVOICE');

      // Effective features contains ONLY the explicitly chosen subset
      expect(profile.enabled_features).toContain('MOD_FLEET');
      expect(profile.enabled_features).toContain('MOD_LR_ENGINE');
      expect(profile.enabled_features).not.toContain('MOD_MARKET_VEHICLES');
      expect(profile.enabled_features).not.toContain('MOD_BILLING_INVOICE');

      expect(await hasFeatureAccess(updatedCompany!, 'MOD_LR_ENGINE')).toBe(true);
      expect(await hasFeatureAccess(updatedCompany!, 'MOD_MARKET_VEHICLES')).toBe(false);
      expect(await hasFeatureAccess(updatedCompany!, 'MOD_BILLING_INVOICE')).toBe(false);
    });

    it('enforces commercial ceiling defense: company preferences cannot grant unentitled modules', async () => {
      // Starter tenant maliciously/mistakenly adds Pro-tier MOD_MAINTENANCE and MOD_CUSTOM_FIELDS to enabled_modules
      const attemptedModules: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_MAINTENANCE', 'MOD_CUSTOM_FIELDS'];
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: { 'settings.enabled_modules': attemptedModules },
      });

      const company = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(company!);

      // Starter plan does not include maintenance or custom fields
      expect(profile.plan_features).not.toContain('MOD_MAINTENANCE');
      expect(profile.plan_features).not.toContain('MOD_CUSTOM_FIELDS');

      // Effective access strictly excludes unentitled modules
      expect(profile.enabled_features).not.toContain('MOD_MAINTENANCE');
      expect(profile.enabled_features).not.toContain('MOD_CUSTOM_FIELDS');
      expect(await hasFeatureAccess(company!, 'MOD_MAINTENANCE')).toBe(false);
      expect(await hasFeatureAccess(company!, 'MOD_CUSTOM_FIELDS')).toBe(false);
    });
  });

  describe('3. Core Module Flexibility (Full Administrator Discretion)', () => {
    it('honors Company Admin disablement of foundational modules (e.g. MOD_FLEET, MOD_TRIPS)', async () => {
      // A transport agency that only generates LRs without tracking fleet or trips
      const specializedModules: ModuleKey[] = ['MOD_PARTIES', 'MOD_DOCUMENT_VAULT', 'MOD_LR_ENGINE'];
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: { 'settings.enabled_modules': specializedModules },
      });

      const company = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(company!);

      expect(profile.enabled_features).not.toContain('MOD_FLEET');
      expect(profile.enabled_features).not.toContain('MOD_DRIVERS');
      expect(profile.enabled_features).not.toContain('MOD_TRIPS');
      expect(profile.enabled_features).toContain('MOD_LR_ENGINE');

      expect(await hasFeatureAccess(company!, 'MOD_FLEET')).toBe(false);
      expect(await hasFeatureAccess(company!, 'MOD_TRIPS')).toBe(false);
      expect(await hasFeatureAccess(company!, 'MOD_LR_ENGINE')).toBe(true);
    });
  });

  describe('4. Plan Upgrade and Downgrade Dynamics', () => {
    it('immediately removes effective access upon plan downgrade, even if module remains in company preferences', async () => {
      // Pro tenant has MOD_MAINTENANCE enabled in company settings
      await Company.findByIdAndUpdate(proTenant.company._id, {
        $set: { 'settings.enabled_modules': ['MOD_FLEET', 'MOD_MAINTENANCE', 'MOD_LR_ENGINE'] },
      });

      let company = await Company.findById(proTenant.company._id);
      let profile = await getTenantEntitlements(company!);
      expect(profile.enabled_features).toContain('MOD_MAINTENANCE');

      // Tenant downgrades to Starter
      const starterPlan = await Plan.findOne({ code: 'starter' });
      await Subscription.findOneAndUpdate(
        { company_id: proTenant.company._id },
        { $set: { plan_id: starterPlan!._id } }
      );

      company = await Company.findById(proTenant.company._id);
      profile = await getTenantEntitlements(company!);

      // Even though settings.enabled_modules still contains 'MOD_MAINTENANCE', plan ceiling immediately drops it
      expect(profile.plan_features).not.toContain('MOD_MAINTENANCE');
      expect(profile.enabled_features).not.toContain('MOD_MAINTENANCE');
      expect(await hasFeatureAccess(company!, 'MOD_MAINTENANCE')).toBe(false);
    });

    it('automatically enables new modules upon upgrade if company has no explicit preferences (undefined)', async () => {
      // Starter tenant has no explicit settings (inherits defaults)
      const company = await Company.findById(starterTenant.company._id);
      expect(company?.settings?.enabled_modules).toBeUndefined();

      // Upgrade to Pro
      const proPlan = await Plan.findOne({ code: 'pro' });
      await Subscription.findOneAndUpdate(
        { company_id: starterTenant.company._id },
        { $set: { plan_id: proPlan!._id } }
      );

      const upgradedCompany = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(upgradedCompany!);

      // Newly eligible Pro features automatically appear in effective access
      expect(profile.plan_features).toContain('MOD_MAINTENANCE');
      expect(profile.plan_features).toContain('MOD_CUSTOM_FIELDS');
      expect(profile.enabled_features).toContain('MOD_MAINTENANCE');
      expect(profile.enabled_features).toContain('MOD_CUSTOM_FIELDS');
      expect(await hasFeatureAccess(upgradedCompany!, 'MOD_MAINTENANCE')).toBe(true);
    });

    it('preserves intentional disablements upon plan upgrade when company has explicit preferences', async () => {
      // Starter tenant explicitly disabled Market Vehicles and only enabled Fleet + LR Engine
      const explicit: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_PARTIES', 'MOD_DOCUMENT_VAULT', 'MOD_TRIPS', 'MOD_LR_ENGINE'];
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: { 'settings.enabled_modules': explicit },
      });

      // Upgrade to Pro
      const proPlan = await Plan.findOne({ code: 'pro' });
      await Subscription.findOneAndUpdate(
        { company_id: starterTenant.company._id },
        { $set: { plan_id: proPlan!._id } }
      );

      const upgradedCompany = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(upgradedCompany!);

      // Plan features now contains maintenance, but company preferences do NOT
      expect(profile.plan_features).toContain('MOD_MAINTENANCE');
      // Pro modules are not silently enabled because explicit preferences exist
      expect(profile.enabled_features).not.toContain('MOD_MAINTENANCE');
      // Market Vehicles remains intentionally disabled
      expect(profile.enabled_features).not.toContain('MOD_MARKET_VEHICLES');
      // Fleet & LR Engine remain enabled
      expect(profile.enabled_features).toContain('MOD_FLEET');
      expect(profile.enabled_features).toContain('MOD_LR_ENGINE');

      expect(await hasFeatureAccess(upgradedCompany!, 'MOD_MAINTENANCE')).toBe(false);
      expect(await hasFeatureAccess(upgradedCompany!, 'MOD_MARKET_VEHICLES')).toBe(false);
    });
  });

  describe('5. Active Add-On Module Entitlement Integration', () => {
    it('grants add-on features when enabled or default-inherited', async () => {
      // Create an active standalone add-on for GPS sync
      let gpsAddon = await AddOn.findOne({ code: 'ADDON_GPS_SYNC' });
      if (!gpsAddon) {
        gpsAddon = await AddOn.create({
          name: 'GPS Telematics Addon',
          code: 'ADDON_GPS_SYNC',
          description: 'Live GPS module',
          type: 'module',
          feature_key: 'MOD_GPS_SYNC',
          monthly_price_paise: 99900,
          annual_price_paise: 999900,
          is_active: true,
        });
      }

      // Attach add-on to starter subscription
      await Subscription.findOneAndUpdate(
        { company_id: starterTenant.company._id },
        {
          $set: {
            active_addons: [{ code: 'ADDON_GPS_SYNC', activated_at: new Date() }],
          },
        }
      );

      const company = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(company!);

      // Plan features includes the add-on feature key
      expect(profile.plan_features).toContain('MOD_GPS_SYNC');
      // Inherited default gives access
      expect(profile.enabled_features).toContain('MOD_GPS_SYNC');
      expect(await hasFeatureAccess(company!, 'MOD_GPS_SYNC')).toBe(true);
    });
  });

  describe('6. Route Gating Middleware Differentiation (FEATURE_LOCKED vs MODULE_DISABLED)', () => {
    it('returns HTTP 403 FEATURE_LOCKED when module is not entitled by the subscription plan', async () => {
      const res = await request(app)
        .get('/api/fleet/maintenance/work-orders')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_LOCKED');
      expect(res.body.module).toBe('MOD_MAINTENANCE');
    });

    it('returns HTTP 403 MODULE_DISABLED when module is entitled by plan but disabled by company preferences', async () => {
      // Pro tenant explicitly disables Maintenance
      await Company.findByIdAndUpdate(proTenant.company._id, {
        $set: { 'settings.enabled_modules': ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_TRIPS', 'MOD_LR_ENGINE'] },
      });

      const res = await request(app)
        .get('/api/fleet/maintenance/work-orders')
        .set('Authorization', `Bearer ${proTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MODULE_DISABLED');
      expect(res.body.module).toBe('MOD_MAINTENANCE');
      expect(res.body.error).toContain('disabled for your company in Workspace Settings');
    });
  });

  describe('7. Subscription Status Security Lockdown', () => {
    it('enforces is_read_only = true and status = expired when trial has ended, regardless of enabled_modules', async () => {
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: {
          subscription_status: 'trialing',
          trial_ends_at: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
          'settings.enabled_modules': ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_TRIPS'],
        },
      });
      await Subscription.findOneAndUpdate(
        { company_id: starterTenant.company._id },
        { $set: { status: 'trialing' } }
      );

      const company = await Company.findById(starterTenant.company._id);
      const profile = await getTenantEntitlements(company!);

      expect(profile.status).toBe('expired');
      expect(profile.is_read_only).toBe(true);
      expect(profile.days_remaining_in_trial).toBe(0);
    });
  });

  describe('8. Company Module Preferences API (GET /api/company/modules & PUT /api/company/modules)', () => {
    it('allows Company Admin to read their module preferences and catalog breakdown', async () => {
      const res = await request(app)
        .get('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBeDefined();
      expect(res.body.plan.code).toBe('starter');
      expect(Array.isArray(res.body.plan_features)).toBe(true);
      expect(res.body.plan_features).toContain('MOD_FLEET');
      expect(res.body.is_customized).toBe(false);
      expect(res.body.enabled_modules).toEqual(res.body.plan_features);
      expect(res.body.effective_features).toEqual(res.body.plan_features);

      // Verify module breakdown
      const fleetMod = res.body.modules.find((m: any) => m.key === 'MOD_FLEET');
      expect(fleetMod).toBeDefined();
      expect(fleetMod.is_entitled).toBe(true);
      expect(fleetMod.is_enabled).toBe(true);
      expect(fleetMod.status).toBe('enabled');

      const maintenanceMod = res.body.modules.find((m: any) => m.key === 'MOD_MAINTENANCE');
      expect(maintenanceMod).toBeDefined();
      expect(maintenanceMod.is_entitled).toBe(false);
      expect(maintenanceMod.is_enabled).toBe(false);
      expect(maintenanceMod.status).toBe('plan_locked');
    });

    it('allows Company Admin to update preferences and update effective access', async () => {
      // Starter tenant enables fleet, drivers, parties, document vault, and trips, but disables lr engine and invoice
      const desiredModules: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_PARTIES', 'MOD_DOCUMENT_VAULT', 'MOD_TRIPS'];

      const putRes = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({ enabled_modules: desiredModules });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.enabled_modules).toEqual(desiredModules);
      expect(putRes.body.effective_features).toEqual(expect.arrayContaining(desiredModules));
      expect(putRes.body.effective_features.length).toBe(desiredModules.length);

      // Verify GET returns updated status
      const getRes = await request(app)
        .get('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.is_customized).toBe(true);
      expect(getRes.body.enabled_modules).toEqual(desiredModules);

      const lrMod = getRes.body.modules.find((m: any) => m.key === 'MOD_LR_ENGINE');
      expect(lrMod.is_entitled).toBe(true);
      expect(lrMod.is_enabled).toBe(false);
      expect(lrMod.status).toBe('disabled_by_company');

      // Subsequent access to LR entry route returns HTTP 403 MODULE_DISABLED
      const routeRes = await request(app)
        .get('/api/commercial/entries')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(routeRes.status).toBe(403);
      expect(routeRes.body.code).toBe('MODULE_DISABLED');
      expect(routeRes.body.module).toBe('MOD_LR_ENGINE');
    });

    it('permits Company Admins to disable foundational modules like MOD_FLEET', async () => {
      // Keep only drivers, parties, market vehicles (omitting MOD_FLEET, MOD_TRIPS, and MOD_DOCUMENT_VAULT which requires MOD_FLEET)
      const nonFleetModules: ModuleKey[] = ['MOD_DRIVERS', 'MOD_PARTIES', 'MOD_MARKET_VEHICLES'];

      const putRes = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({ enabled_modules: nonFleetModules });

      expect(putRes.status).toBe(200);
      expect(putRes.body.enabled_modules).toEqual(nonFleetModules);
      expect(putRes.body.effective_features).not.toContain('MOD_FLEET');

      // Gated fleet route is now disabled
      const truckRes = await request(app)
        .get('/api/fleet/trucks')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(truckRes.status).toBe(403);
      expect(truckRes.body.code).toBe('MODULE_DISABLED');
      expect(truckRes.body.module).toBe('MOD_FLEET');
    });
  });

  describe('9. RBAC & Tenant Isolation Enforcement', () => {
    it('rejects PUT /api/company/modules from unauthorized roles (e.g. viewer)', async () => {
      const viewerTenant = await createTestTenant({
        name: 'Viewer Logistics',
        plan_code: 'starter',
        role: 'viewer',
        subscription_status: 'active',
      });

      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${viewerTenant.token}`)
        .send({ enabled_modules: ['MOD_FLEET', 'MOD_DRIVERS'] });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('prevents cross-tenant reads and modifications via x-company-id headers', async () => {
      // Starter tenant tries to read Pro tenant modules via header injection
      const readRes = await request(app)
        .get('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .set('x-company-id', proTenant.company._id.toString());

      expect(readRes.status).toBe(403);
      expect(readRes.body.error).toContain('Forbidden');

      // Starter tenant tries to write Pro tenant modules via header injection
      const writeRes = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .set('x-company-id', proTenant.company._id.toString())
        .send({ enabled_modules: ['MOD_FLEET'] });

      expect(writeRes.status).toBe(403);
      expect(writeRes.body.error).toContain('Forbidden');
    });

    it('ignores untrusted request-body company IDs and updates only authenticated tenant', async () => {
      const targetModules: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_PARTIES'];

      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          company_id: proTenant.company._id.toString(),
          companyId: proTenant.company._id.toString(),
          enabled_modules: targetModules,
        });

      expect(res.status).toBe(200);

      // Starter tenant updated
      const starterComp = await Company.findById(starterTenant.company._id);
      expect(starterComp?.settings?.enabled_modules).toEqual(targetModules);

      // Pro tenant unaffected
      const proComp = await Company.findById(proTenant.company._id);
      expect(proComp?.settings?.enabled_modules).toBeUndefined();
    });
  });

  describe('10. Plan Ceiling Defense & Request Validation', () => {
    it('rejects attempts to enable modules outside current plan with UNENTITLED_MODULE (HTTP 422)', async () => {
      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          enabled_modules: ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_MAINTENANCE'], // MOD_MAINTENANCE is Pro only
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('UNENTITLED_MODULE');
      expect(res.body.unentitled_modules).toContain('MOD_MAINTENANCE');
    });

    it('rejects invalid module keys with INVALID_MODULE_KEY (HTTP 400)', async () => {
      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          enabled_modules: ['MOD_FLEET', 'MOD_INVALID_FOO_BAR'],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_MODULE_KEY');
    });

    it('rejects non-array request body with INVALID_REQUEST_BODY (HTTP 400)', async () => {
      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          enabled_modules: 'MOD_FLEET',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST_BODY');
    });

    it('rejects missing module dependencies with DEPENDENCY_MISSING (HTTP 422)', async () => {
      // MOD_TRIPS requires MOD_FLEET and MOD_DRIVERS. Providing MOD_TRIPS without MOD_FLEET fails.
      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${proTenant.token}`)
        .send({
          enabled_modules: ['MOD_TRIPS', 'MOD_DRIVERS'],
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('DEPENDENCY_MISSING');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ module: 'MOD_TRIPS', requires: ['MOD_FLEET'] }),
        ])
      );
    });

    it('prevents expired subscriptions from regaining access or performing module updates', async () => {
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: {
          subscription_status: 'expired',
          trial_ends_at: new Date(Date.now() - 1000 * 60),
        },
      });
      await Subscription.findOneAndUpdate(
        { company_id: starterTenant.company._id },
        { $set: { status: 'expired' } }
      );

      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({
          enabled_modules: ['MOD_FLEET', 'MOD_DRIVERS'],
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
    });
  });

  describe('11. Immutable Audit Logging & Persistence Rollback Protection', () => {
    it('records immutable AuditLog entry upon successful module preference changes', async () => {
      const initialModules: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_PARTIES'];
      await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({ enabled_modules: initialModules });

      const logs = await AuditLog.find({
        company_id: starterTenant.company._id,
        entity_type: 'company_settings',
      });

      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[logs.length - 1];
      expect(latestLog.action).toBe('UPDATE');
      expect(latestLog.actor_id?.toString()).toBe(starterTenant.user._id.toString());
      expect(latestLog.actor_role).toBe('admin');
      expect(latestLog.after_snapshot).toBeDefined();
      expect(latestLog.after_snapshot?.enabled_modules).toEqual(initialModules);
    });

    it('rolls back settings and does not produce false success when AuditLog persistence fails', async () => {
      // Set baseline state
      const baselineModules: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS'];
      await Company.findByIdAndUpdate(starterTenant.company._id, {
        $set: { 'settings.enabled_modules': baselineModules },
      });

      // Mock AuditLog.create failure
      const auditSpy = vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('Simulated audit disk failure'));

      const res = await request(app)
        .put('/api/company/modules')
        .set('Authorization', `Bearer ${starterTenant.token}`)
        .send({ enabled_modules: ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_PARTIES'] });

      auditSpy.mockRestore();

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Audit log persistence failed');

      // Verify database rolled back to baseline
      const company = await Company.findById(starterTenant.company._id);
      expect(company?.settings?.enabled_modules).toEqual(baselineModules);
    });
  });

  describe('12. Super Admin Multi-Company Read-Only Overview (GET /api/super-admin/tenants/modules-overview)', () => {
    it('allows Super Admin to view multi-company module overview with reliable usage indicator', async () => {
      const superAdmin = await createSuperAdmin();

      const res = await request(app)
        .get('/api/super-admin/tenants/modules-overview')
        .set('Authorization', `Bearer ${superAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.tenants)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(2);

      // Verify tenant entry schema
      const starterEntry = res.body.tenants.find((t: any) => t.company_id === starterTenant.company._id.toString());
      expect(starterEntry).toBeDefined();
      expect(starterEntry.company_name).toBe(starterTenant.company.name);
      expect(starterEntry.subscription_plan.code).toBe('starter');
      expect(starterEntry.subscription_status).toBe('active');
      expect(Array.isArray(starterEntry.eligible_modules)).toBe(true);
      expect(Array.isArray(starterEntry.effective_modules)).toBe(true);
      expect(starterEntry.usage).toEqual({
        is_instrumented: false,
        status: 'usage_not_tracked',
        note: 'Operational module usage telemetry is not instrumented.',
      });
    });

    it('blocks non-Super Admin users from accessing modules-overview with SUPER_ADMIN_REQUIRED (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/super-admin/tenants/modules-overview')
        .set('Authorization', `Bearer ${starterTenant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPER_ADMIN_REQUIRED');
    });

    it('accurately distinguishes plan eligibility, saved preferences, and effective access in overview', async () => {
      const superAdmin = await createSuperAdmin();

      // Customize pro tenant preferences
      const proCustom: ModuleKey[] = ['MOD_FLEET', 'MOD_DRIVERS', 'MOD_TRIPS'];
      await Company.findByIdAndUpdate(proTenant.company._id, {
        $set: { 'settings.enabled_modules': proCustom },
      });

      const res = await request(app)
        .get('/api/super-admin/tenants/modules-overview')
        .set('Authorization', `Bearer ${superAdmin.token}`);

      expect(res.status).toBe(200);

      const proEntry = res.body.tenants.find((t: any) => t.company_id === proTenant.company._id.toString());
      expect(proEntry).toBeDefined();
      expect(proEntry.is_customized).toBe(true);
      expect(proEntry.saved_preferences).toEqual(proCustom);
      expect(proEntry.effective_modules).toEqual(proCustom);
      expect(proEntry.eligible_modules).toContain('MOD_MAINTENANCE'); // Pro eligible
      expect(proEntry.effective_modules).not.toContain('MOD_MAINTENANCE'); // Not in custom preference
    });
  });
});
