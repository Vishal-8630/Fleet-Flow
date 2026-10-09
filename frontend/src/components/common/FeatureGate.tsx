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
import { Lock, Sparkles } from 'lucide-react';
import { ModuleKey, CLIENT_MODULES } from '../../utils/featureCatalog';

interface FeatureGateProps {
  feature: ModuleKey;
  enabledFeatures?: ModuleKey[];
  children: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  enabledFeatures = [],
  children,
  showUpgradePrompt = true,
}) => {
  // If no enabledFeatures passed, assume enabled (or wait until loaded)
  const isUnlocked = enabledFeatures.length === 0 || enabledFeatures.includes(feature);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const moduleDef = CLIENT_MODULES[feature];

  return (
    <div className="feature-gate-locked-card">
      <div className="feature-gate-icon-wrapper">
        <Lock size={28} className="feature-gate-lock-icon" />
      </div>
      <div className="feature-gate-content">
        <div className="feature-gate-badge">
          <Sparkles size={12} />
          <span>Requires {moduleDef?.defaultTier ? moduleDef.defaultTier.toUpperCase() : 'PRO'} Tier</span>
        </div>
        <h3 className="feature-gate-title">{moduleDef?.name || feature}</h3>
        <p className="feature-gate-desc">
          {moduleDef?.description || 'This capability is available on an upgraded subscription tier.'}
        </p>
        <Link to="/settings/billing" className="btn btn-primary btn-sm feature-gate-cta">
          Upgrade Plan to Unlock
        </Link>
      </div>
    </div>
  );
};
