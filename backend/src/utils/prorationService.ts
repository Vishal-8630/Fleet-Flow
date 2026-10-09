/**
 * ============================================================================
 * FLEET FLOW — MATHEMATICAL PRORATION & BILLING CALCULUS (prorationService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Computes exact down-to-the-second financial proration credits and charges
 * for mid-cycle subscription tier changes.
 * 
 * THE FORMULA:
 * ------------
 * For an active billing period between `periodStart` and `periodEnd`:
 * 1. Total Cycle Seconds: T = (periodEnd - periodStart) / 1000
 * 2. Unused Seconds Remaining: R = max(0, (periodEnd - now) / 1000)
 * 3. Fractional Ratio: fraction = R / T
 * 4. Unused Current Plan Credit: credit = Math.floor(currentPlanPricePaise * fraction)
 * 5. New Plan Prorated Cost: cost = Math.ceil(newPlanPricePaise * fraction)
 * 6. Net Upgrade Payable (Paise): netAmount = max(0, cost - credit)
 * 
 * WHY USE SECOND-PRECISION INTEGER PAISE?
 * ---------------------------------------
 * Millisecond or second precision ensures fairness for the customer while
 * preventing any fractional rounding leakage across multi-tenant billing accounts.
 * ============================================================================
 */

export interface ProrationCalculation {
  total_cycle_seconds: number;
  remaining_seconds: number;
  fraction_remaining: number;
  current_plan_credit_paise: number;
  new_plan_charge_paise: number;
  net_payable_paise: number;
  net_payable_rupees: number;
  is_upgrade: boolean;
}

/**
 * Calculates mid-cycle proration between two pricing tiers.
 */
export function calculateProration(
  currentPlanPricePaise: number,
  newPlanPricePaise: number,
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date()
): ProrationCalculation {
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const nowMs = Math.min(Math.max(new Date(now).getTime(), startMs), endMs);

  const totalCycleSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
  const remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));

  const fractionRemaining = remainingSeconds / totalCycleSeconds;

  const currentPlanCreditPaise = Math.floor(currentPlanPricePaise * fractionRemaining);
  const newPlanChargePaise = Math.ceil(newPlanPricePaise * fractionRemaining);

  const isUpgrade = newPlanPricePaise > currentPlanPricePaise;
  const netPayablePaise = isUpgrade
    ? Math.max(0, newPlanChargePaise - currentPlanCreditPaise)
    : 0;

  return {
    total_cycle_seconds: totalCycleSeconds,
    remaining_seconds: remainingSeconds,
    fraction_remaining: Math.round(fractionRemaining * 10000) / 10000,
    current_plan_credit_paise: currentPlanCreditPaise,
    new_plan_charge_paise: newPlanChargePaise,
    net_payable_paise: netPayablePaise,
    net_payable_rupees: netPayablePaise / 100,
    is_upgrade: isUpgrade,
  };
}
