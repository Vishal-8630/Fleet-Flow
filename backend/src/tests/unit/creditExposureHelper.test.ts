import { describe, it, expect } from 'vitest';
import { computeExposureMath } from '../../services/creditExposureService.js';

describe('Unit: Customer Credit Exposure Math & DEC-007 Policy Boundaries (FF-ISSUE-045)', () => {
  it('correctly calculates total exposure across invoices and dispatched unbilled freight', () => {
    const res = computeExposureMath({
      open_invoices_balance: 70000,
      dispatched_unbilled_freight: 25000,
      unallocated_credits: 5000,
      credit_limit: 100000,
      enforce_credit_limit: true,
      planned_freight: 5000,
    });

    expect(res.current_exposure).toBe(90000); // 70k + 25k - 5k
    expect(res.planned_freight).toBe(5000);
    expect(res.projected_exposure).toBe(95000);
    expect(res.is_breached).toBe(false);
    expect(res.overage_amount).toBe(0);
    expect(res.is_unrestricted).toBe(false);
  });

  it('detects credit breach when projected exposure exceeds credit limit', () => {
    const res = computeExposureMath({
      open_invoices_balance: 70000,
      dispatched_unbilled_freight: 25000,
      unallocated_credits: 0,
      credit_limit: 100000,
      enforce_credit_limit: true,
      planned_freight: 20000,
    });

    expect(res.current_exposure).toBe(95000);
    expect(res.projected_exposure).toBe(115000);
    expect(res.is_breached).toBe(true);
    expect(res.overage_amount).toBe(15000); // 115000 - 100000
  });

  it('unconfigured credit limit (enforce_credit_limit === false) is unrestricted and never breaches', () => {
    const res = computeExposureMath({
      open_invoices_balance: 500000,
      dispatched_unbilled_freight: 300000,
      unallocated_credits: 0,
      credit_limit: 0,
      enforce_credit_limit: false,
      planned_freight: 200000,
    });

    expect(res.current_exposure).toBe(800000);
    expect(res.projected_exposure).toBe(1000000);
    expect(res.is_unrestricted).toBe(true);
    expect(res.is_breached).toBe(false);
    expect(res.overage_amount).toBe(0);
  });

  it('explicitly configured zero credit limit (enforce_credit_limit === true && credit_limit === 0) strictly permits zero credit', () => {
    // Cash-only shipper: zero credit allowed.
    const res = computeExposureMath({
      open_invoices_balance: 0,
      dispatched_unbilled_freight: 0,
      unallocated_credits: 0,
      credit_limit: 0,
      enforce_credit_limit: true,
      planned_freight: 15000,
    });

    expect(res.current_exposure).toBe(0);
    expect(res.projected_exposure).toBe(15000);
    expect(res.is_unrestricted).toBe(false);
    expect(res.is_breached).toBe(true);
    expect(res.overage_amount).toBe(15000);
  });

  it('allows negative current exposure from advance deposits to provide credit headroom', () => {
    const res = computeExposureMath({
      open_invoices_balance: 10000,
      dispatched_unbilled_freight: 0,
      unallocated_credits: 30000, // ₹30,000 advance receipt from customer
      credit_limit: 50000,
      enforce_credit_limit: true,
      planned_freight: 40000,
    });

    expect(res.current_exposure).toBe(-20000); // 10k - 30k
    expect(res.projected_exposure).toBe(20000); // -20k + 40k = 20k
    expect(res.is_breached).toBe(false);
    expect(res.overage_amount).toBe(0);
  });
});
