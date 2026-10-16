import { describe, it, expect } from 'vitest';
import { roundMoney } from '../../utils/settlementCalculator.js';

export function calculateOpeningBalanceDelta(params: {
  current_balance: number;
  old_opening_balance: number;
  new_opening_balance: number;
}): { delta: number; updated_current_balance: number } {
  const oldOpening = roundMoney(Number(params.old_opening_balance) || 0);
  const newOpening = roundMoney(Number(params.new_opening_balance) || 0);
  const current = roundMoney(Number(params.current_balance) || 0);

  const delta = roundMoney(newOpening - oldOpening);
  const updated_current_balance = roundMoney(current + delta);

  return {
    delta,
    updated_current_balance,
  };
}

describe('Unit: Party Opening Balance Delta Calculation (FF-ISSUE-042)', () => {
  it('correctly sets current balance equal to new opening balance when no historical transactions exist', () => {
    const res = calculateOpeningBalanceDelta({
      current_balance: 0,
      old_opening_balance: 0,
      new_opening_balance: 25000,
    });

    expect(res.delta).toBe(25000);
    expect(res.updated_current_balance).toBe(25000);
  });

  it('correctly shifts current balance by delta when party already has posted transactions', () => {
    // Vendor originally had ₹10,000 opening balance.
    // Vendor accumulated ₹15,000 in transactions, bringing current balance to ₹25,000.
    // Operator corrects opening balance to ₹15,000 (+₹5,000 delta).
    // Current balance must become ₹25,000 + ₹5,000 = ₹30,000.
    const res = calculateOpeningBalanceDelta({
      current_balance: 25000,
      old_opening_balance: 10000,
      new_opening_balance: 15000,
    });

    expect(res.delta).toBe(5000);
    expect(res.updated_current_balance).toBe(30000);
  });

  it('correctly reduces current balance when opening balance is revised downward', () => {
    const res = calculateOpeningBalanceDelta({
      current_balance: 40000,
      old_opening_balance: 20000,
      new_opening_balance: 5000,
    });

    expect(res.delta).toBe(-15000);
    expect(res.updated_current_balance).toBe(25000);
  });

  it('handles negative opening balances cleanly', () => {
    const res = calculateOpeningBalanceDelta({
      current_balance: -5000,
      old_opening_balance: -5000,
      new_opening_balance: 2000,
    });

    expect(res.delta).toBe(7000);
    expect(res.updated_current_balance).toBe(2000);
  });
});
