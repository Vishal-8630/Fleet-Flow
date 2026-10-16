import { describe, it, expect } from 'vitest';
import { roundMoney, calculateDriverSettlement, IJourneyTripData } from '../../utils/settlementCalculator.js';

describe('Unit: Settlement Calculations & Cash Fuel Advance Deductions (FF-ISSUE-043)', () => {
  it('preserves backward compatibility when no cash fuel is logged', () => {
    const journey: IJourneyTripData = {
      journey_number: 'JRN-001',
      total_distance_kms: 1000,
      starting_cash_advance: 5000,
      total_driver_expenses: 1500,
      total_diesel_litres: 250, // 4.0 km/l exactly matches benchmark
    };

    const res = calculateDriverSettlement({
      journeys: [journey],
      rate_per_km: 4.5,
      benchmark_mileage: 4.0,
      diesel_price_per_litre: 92,
    });

    expect(res.base_earnings).toBe(4500); // 1000 * 4.5
    expect(res.total_reimbursements).toBe(1500);
    expect(res.gross_earnings).toBe(6000);
    expect(res.total_advances).toBe(5000);
    expect(res.advance_funded_diesel_cost).toBe(0);
    expect(res.reconciled_advances).toBe(5000);
    expect(res.fuel_variance_penalty).toBe(0);
    expect(res.total_deductions).toBe(5000);
    expect(res.net_amount).toBe(1000); // 6000 - 5000
    expect(res.settlement_type).toBe('payable_to_driver');
    expect(res.amount_company_owes_driver).toBe(1000);
  });

  it('deducts advance-funded cash fuel from advance deductions so driver is not docked wages', () => {
    // Driver received ₹10,000 advance.
    // Driver spent ₹9,000 on cash diesel and ₹3,360 on toll/parking.
    // Distance 2,000 kms @ ₹4.5/km = ₹9,000 base earnings.
    const journey: IJourneyTripData = {
      journey_number: 'JRN-002',
      total_distance_kms: 2000,
      starting_cash_advance: 10000,
      total_driver_expenses: 3360,
      advance_funded_diesel_cost: 9000,
      total_diesel_litres: 500, // 4.0 km/l
    };

    const res = calculateDriverSettlement({
      journeys: [journey],
      rate_per_km: 4.5,
      benchmark_mileage: 4.0,
      diesel_price_per_litre: 92,
    });

    expect(res.base_earnings).toBe(9000);
    expect(res.total_reimbursements).toBe(3360);
    expect(res.gross_earnings).toBe(12360);
    expect(res.total_advances).toBe(10000);
    expect(res.advance_funded_diesel_cost).toBe(9000);
    expect(res.reconciled_advances).toBe(1000); // 10000 - 9000
    expect(res.total_deductions).toBe(1000);
    expect(res.net_amount).toBe(11360); // 12360 - 1000
    expect(res.settlement_type).toBe('payable_to_driver');
    expect(res.amount_company_owes_driver).toBe(11360);
  });

  it('properly reimburses driver when cash diesel spend exceeds starting cash advance', () => {
    // Driver received ₹10,000 advance.
    // Driver spent ₹12,000 on cash diesel out of pocket and ₹2,000 on toll expenses.
    // Net out of pocket fuel spend = 12,000 - 10,000 = 2,000 owed to driver.
    const journey: IJourneyTripData = {
      journey_number: 'JRN-003',
      total_distance_kms: 2000,
      starting_cash_advance: 10000,
      total_driver_expenses: 2000,
      advance_funded_diesel_cost: 12000,
      total_diesel_litres: 500,
    };

    const res = calculateDriverSettlement({
      journeys: [journey],
      rate_per_km: 4.5,
      benchmark_mileage: 4.0,
      diesel_price_per_litre: 92,
    });

    expect(res.base_earnings).toBe(9000);
    expect(res.total_reimbursements).toBe(2000);
    expect(res.gross_earnings).toBe(11000);
    expect(res.total_advances).toBe(10000);
    expect(res.advance_funded_diesel_cost).toBe(12000);
    expect(res.reconciled_advances).toBe(-2000); // Company owes driver ₹2,000 for advance deficit
    expect(res.total_deductions).toBe(-2000);
    expect(res.net_amount).toBe(13000); // 11000 - (-2000) = 13000
    expect(res.settlement_type).toBe('payable_to_driver');
    expect(res.amount_company_owes_driver).toBe(13000);
  });

  it('accurately isolates cash fuel across multiple reconciled journeys', () => {
    const journey1: IJourneyTripData = {
      journey_number: 'JRN-004A',
      total_distance_kms: 1000,
      starting_cash_advance: 5000,
      total_driver_expenses: 1000,
      advance_funded_diesel_cost: 3000,
      total_diesel_litres: 250,
    };

    const journey2: IJourneyTripData = {
      journey_number: 'JRN-004B',
      total_distance_kms: 1500,
      starting_cash_advance: 7000,
      total_driver_expenses: 1500,
      advance_funded_diesel_cost: 4500,
      total_diesel_litres: 375,
    };

    const res = calculateDriverSettlement({
      journeys: [journey1, journey2],
      rate_per_km: 4.0,
    });

    expect(res.total_kms).toBe(2500);
    expect(res.total_advances).toBe(12000);
    expect(res.advance_funded_diesel_cost).toBe(7500);
    expect(res.reconciled_advances).toBe(4500);
    expect(res.total_reimbursements).toBe(2500);
    expect(res.base_earnings).toBe(10000);
    expect(res.gross_earnings).toBe(12500);
    expect(res.total_deductions).toBe(4500);
    expect(res.net_amount).toBe(8000);
  });

  it('safely handles zero-distance, empty trips, and zero advances without division by zero', () => {
    const res = calculateDriverSettlement({
      journeys: [
        {
          journey_number: 'JRN-CANCELLED',
          total_distance_kms: 0,
          starting_cash_advance: 0,
          total_driver_expenses: 0,
          advance_funded_diesel_cost: 0,
          total_diesel_litres: 0,
        },
      ],
      rate_per_km: 4.5,
    });

    expect(res.total_kms).toBe(0);
    expect(res.net_amount).toBe(0);
    expect(res.actual_mileage).toBe(0);
    expect(res.settlement_type).toBe('settled_even');
  });
});
