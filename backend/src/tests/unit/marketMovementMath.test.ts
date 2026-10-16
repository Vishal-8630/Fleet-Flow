import { describe, it, expect } from 'vitest';
import { roundMoney } from '../../utils/settlementCalculator.js';

export function calculateMarketNetBalance(params: {
  freight_amount: number;
  driver_cash_advance?: number;
  diesel_advance_amount?: number;
  dala_charges?: number;
  kamisan_amount?: number;
  halting_amount?: number;
}): number {
  const freight = roundMoney(Number(params.freight_amount) || 0);
  const cash = roundMoney(Number(params.driver_cash_advance) || 0);
  const diesel = roundMoney(Number(params.diesel_advance_amount) || 0);
  const dala = roundMoney(Number(params.dala_charges) || 0);
  const kamisan = roundMoney(Number(params.kamisan_amount) || 0);
  const halting = roundMoney(Number(params.halting_amount) || 0);

  return Math.max(0, roundMoney(freight - cash - diesel - dala - kamisan + halting));
}

describe('Unit: Market Movement Financial Math & Deduction Transparency (FF-ISSUE-050)', () => {
  it('correctly calculates net balance due accounting for Dala and Kamisan deductions', () => {
    // Audit scenario: Freight ₹50,000, Cash ₹5,000, Dala ₹2,000, Kamisan ₹2,000
    // Net balance due is ₹41,000
    const netDue = calculateMarketNetBalance({
      freight_amount: 50000,
      driver_cash_advance: 5000,
      diesel_advance_amount: 0,
      dala_charges: 2000,
      kamisan_amount: 2000,
      halting_amount: 0,
    });

    expect(netDue).toBe(41000);
    // Verifies that Freight (50,000) - Cash (5,000) - Dala (2,000) - Kamisan (2,000) = 41,000
    expect(50000 - 5000 - 2000 - 2000).toBe(netDue);
  });

  it('correctly incorporates Halting compensation additions', () => {
    const netDue = calculateMarketNetBalance({
      freight_amount: 40000,
      driver_cash_advance: 10000,
      diesel_advance_amount: 5000,
      dala_charges: 1000,
      kamisan_amount: 1500,
      halting_amount: 3000, // Demurrage addition
    });

    // 40,000 - 10,000 - 5,000 - 1,000 - 1,500 + 3,000 = 25,500
    expect(netDue).toBe(25500);
  });

  it('clamps net balance due to zero when deductions and advances exceed agreed freight', () => {
    const netDue = calculateMarketNetBalance({
      freight_amount: 20000,
      driver_cash_advance: 15000,
      diesel_advance_amount: 10000, // Total advance 25,000 exceeds freight 20,000
      dala_charges: 500,
      kamisan_amount: 1000,
      halting_amount: 0,
    });

    expect(netDue).toBe(0);
  });
});
