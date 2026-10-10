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
import { Lock, Sparkles, Check, ArrowRight, Zap } from 'lucide-react';
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
  const storeFeatures = useAuthStore((state) => state.enabledFeatures);
  const effectiveFeatures = propFeatures !== undefined ? propFeatures : storeFeatures;

  const isUnlocked = effectiveFeatures.includes(feature);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const moduleDef = CLIENT_MODULES[feature];
  const requiredTier = moduleDef?.defaultTier ? moduleDef.defaultTier.toUpperCase() : 'PRO';

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
