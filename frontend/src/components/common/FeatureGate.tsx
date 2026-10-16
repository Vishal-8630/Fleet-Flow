/**
 * ============================================================================
 * FLEET FLOW — FEATURE GATE COMPONENT (FeatureGate.tsx)
 * ============================================================================
 * 
 * WHAT IS THIS COMPONENT?
 * -----------------------
 * Conditional wrapper that checks if a module feature is unlocked in the
 * company's current active subscription.
 * If locked, it either hides the content or renders an upgrade teaser card.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, Check, ArrowRight, Zap, Sliders } from 'lucide-react';
import { ModuleKey, CLIENT_MODULES } from '../../utils/featureCatalog';
import { useAuthStore } from '../../stores/authStore';

interface FeatureGateProps {
  feature: ModuleKey;
  enabledFeatures?: ModuleKey[];
  children: React.ReactNode;
  showUpgradePrompt?: boolean;
  pageMode?: boolean;
  titleOverride?: string;
  descOverride?: string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  enabledFeatures: propFeatures,
  children,
  showUpgradePrompt = true,
  pageMode = false,
  titleOverride,
  descOverride,
}) => {
  const { enabledFeatures: storeFeatures, planFeatures: storePlanFeatures = [], role, isLoading } = useAuthStore();
  const effectiveFeatures = propFeatures !== undefined ? propFeatures : storeFeatures;
  const isAdmin = role === 'admin';

  // Safe loading handling: while authentication or entitlement state is still resolving,
  // do not briefly flash or render protected content.
  if (isLoading && propFeatures === undefined) {
    if (pageMode) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--color-primary-200)', borderTopColor: 'var(--color-primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Verifying subscription access...</div>
          </div>
        </div>
      );
    }
    return null;
  }

  const isUnlocked = effectiveFeatures.includes(feature);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const moduleDef = CLIENT_MODULES[feature];
  const requiredTier = moduleDef?.defaultTier ? moduleDef.defaultTier.toUpperCase() : 'PRO';

  // Differentiate MODULE_DISABLED (plan entitled, disabled by company) vs FEATURE_LOCKED (plan ceiling)
  const isEntitledByPlan = storePlanFeatures.includes(feature);

  if (isEntitledByPlan) {
    return (
      <div className={`feature-gate-locked-card ${pageMode ? 'page-mode' : ''}`} style={{ borderColor: 'var(--color-amber-300)' }}>
        <div className="feature-gate-glow-backdrop" style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)' }} />

        <div className="feature-gate-badge" style={{ backgroundColor: 'var(--color-amber-50)', color: 'var(--color-amber-800)', borderColor: 'var(--color-amber-300)' }}>
          <Sliders size={13} />
          <span>DEACTIVATED IN WORKSPACE SETTINGS</span>
        </div>

        <div className="feature-gate-icon-wrapper">
          <div className="feature-gate-icon-ring" style={{ backgroundColor: 'var(--color-amber-100)', color: 'var(--color-amber-700)' }}>
            <Sliders size={32} />
          </div>
        </div>

        <h3 className="feature-gate-title">
          {titleOverride || `${moduleDef?.name || feature} is Deactivated`}
        </h3>

        <p className="feature-gate-desc">
          {descOverride ||
            `This module is included in your company's subscription plan, but has been deactivated in Workspace Settings.`}
        </p>

        <div className="feature-gate-perks">
          <div className="feature-gate-perk-item">
            <Check size={14} className="perk-check" />
            <span>Included in your active subscription plan</span>
          </div>
          <div className="feature-gate-perk-item">
            <Check size={14} className="perk-check" />
            <span>Zero additional cost to reactivate</span>
          </div>
          <div className="feature-gate-perk-item">
            <Check size={14} className="perk-check" />
            <span>Customizes team workflow without altering billing</span>
          </div>
        </div>

        <div className="feature-gate-actions">
          {isAdmin ? (
            <Link to="/settings/company?tab=modules" className="btn btn-primary feature-gate-cta">
              <Sliders size={15} /> Configure Workspace Modules <ArrowRight size={15} />
            </Link>
          ) : (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
              Contact your company administrator to activate this module in Workspace Settings.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`feature-gate-locked-card ${pageMode ? 'page-mode' : ''}`}>
      <div className="feature-gate-glow-backdrop" />
      
      <div className="feature-gate-badge">
        <Sparkles size={13} />
        <span>REQUIRES {requiredTier} TIER OR HIGHER</span>
      </div>

      <div className="feature-gate-icon-wrapper">
        <div className="feature-gate-icon-ring">
          <Lock size={32} />
        </div>
      </div>

      <h3 className="feature-gate-title">
        {titleOverride || `${moduleDef?.name || feature} is Locked`}
      </h3>
      
      <p className="feature-gate-desc">
        {descOverride ||
          moduleDef?.description ||
          'This capability is available on an upgraded subscription tier. Upgrade your workspace to unlock immediate full access.'}
      </p>

      <div className="feature-gate-perks">
        <div className="feature-gate-perk-item">
          <Check size={14} className="perk-check" />
          <span>Server-enforced enterprise isolation & tier limits</span>
        </div>
        <div className="feature-gate-perk-item">
          <Check size={14} className="perk-check" />
          <span>Instant real-time access with zero downtime</span>
        </div>
        <div className="feature-gate-perk-item">
          <Check size={14} className="perk-check" />
          <span>Switch, upgrade, or cancel your plan anytime</span>
        </div>
      </div>

      <div className="feature-gate-actions">
        <Link to="/settings/billing" className="btn btn-primary feature-gate-cta">
          <Zap size={15} /> Upgrade to {requiredTier} to Unlock <ArrowRight size={15} />
        </Link>
        <Link to="/settings/billing" className="btn btn-secondary feature-gate-secondary-btn">
          Compare All Plans
        </Link>
      </div>
    </div>
  );
};
