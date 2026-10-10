/**
 * ============================================================================
 * FLEET FLOW — SETTLEMENT CALCULATOR & FINANCIAL PRECISION (settlementCalculator.ts)
 * ============================================================================
 * 
 * WHAT IS THIS FILE?
 * ------------------
 * A deterministic, decimal-safe financial calculation engine for driver trip
 * settlements, diesel mileage variance penalties, and monetary rounding.
 * 
 * WHY ARE WE DOING THIS?
 * ----------------------
 * Commercial freight accounting cannot tolerate floating-point rounding drift
 * (e.g., 0.1 + 0.2 = 0.30000000000000004). This utility enforces:
 * 1. Strict half-up two-decimal mathematical rounding (`roundMoney`).
 * 2. Formalized mathematical settlement equation:
 *    Gross Earnings = (Total KMs × Rate Per KM) + Approved En-Route Reimbursements
 *    Total Deductions = Starting Advances + Fuel Variance Penalty + Other Deductions
 *    Net Driver Payable = Gross Earnings - Total Deductions
 * 3. Formal rollover rules:
 *    If Net > 0: Transport company owes driver (`payable_to_driver`).
 *    If Net < 0: Driver owes transport company (`receivable_from_driver`).
 * ============================================================================
 */

/**
 * Mathematically safe half-up two-decimal monetary rounding.
 * Prevents IEEE 754 precision drift across all financial calculations.
 */
export function roundMoney(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface IJourneyTripData {
  _id?: any;
  journey_number?: string;
  total_distance_kms?: number;
  starting_cash_advance?: number;
  total_driver_expenses?: number;
  total_diesel_litres?: number;
  actual_mileage_km_per_litre?: number;
  from_location?: { city?: string };
  to_location?: { city?: string };
  start_date?: Date;
  actual_end_date?: Date;
}

export interface IDriverSettlementParams {
  journeys: IJourneyTripData[];
  rate_per_km: number;
  benchmark_mileage?: number;
  diesel_price_per_litre?: number;
  other_deductions?: number;
  other_deductions_notes?: string;
}

export interface IDriverSettlementResult {
  total_kms: number;
  rate_per_km: number;
  base_earnings: number;
  total_reimbursements: number;
  gross_earnings: number;
  total_advances: number;
  benchmark_mileage: number;
  actual_diesel_litres: number;
  actual_mileage: number;
  fuel_variance_penalty: number;
  other_deductions: number;
  other_deductions_notes?: string;
  total_deductions: number;
  net_amount: number;
  settlement_type: 'payable_to_driver' | 'receivable_from_driver' | 'settled_even';
  amount_company_owes_driver: number;
  amount_driver_owes_company: number;
}

/**
 * Evaluates the driver trip settlement math with deterministic precision.
 */
export function calculateDriverSettlement(params: IDriverSettlementParams): IDriverSettlementResult {
  const {
    journeys = [],
    rate_per_km,
    benchmark_mileage = 4.0,
    diesel_price_per_litre = 92.0,
    other_deductions = 0,
    other_deductions_notes,
  } = params;

  const validRatePerKm = Math.max(0, Number(rate_per_km) || 0);
  const validBenchmark = Math.max(0, Number(benchmark_mileage) || 4.0);
  const validDieselPrice = Math.max(0, Number(diesel_price_per_litre) || 92.0);
  const validOtherDeductions = roundMoney(Math.max(0, Number(other_deductions) || 0));

  // 1. Aggregations across reconciled trips
  const total_kms = roundMoney(
    journeys.reduce((sum, j) => sum + (Number(j.total_distance_kms) || 0), 0)
  );
  const total_advances = roundMoney(
    journeys.reduce((sum, j) => sum + (Number(j.starting_cash_advance) || 0), 0)
  );
  const total_reimbursements = roundMoney(
    journeys.reduce((sum, j) => sum + (Number(j.total_driver_expenses) || 0), 0)
  );
  const total_diesel_litres = roundMoney(
    journeys.reduce((sum, j) => sum + (Number(j.total_diesel_litres) || 0), 0)
  );

  // 2. Earnings Math
  const base_earnings = roundMoney(total_kms * validRatePerKm);
  const gross_earnings = roundMoney(base_earnings + total_reimbursements);

  // 3. Diesel Fuel Variance Penalty Math:
  // If actual fleet fuel consumption exceeds benchmark allowance, penalize excess litres
  let fuel_variance_penalty = 0;
  if (total_kms > 0 && validBenchmark > 0) {
    const allowedLitres = total_kms / validBenchmark;
    if (total_diesel_litres > allowedLitres) {
      const excessLitres = total_diesel_litres - allowedLitres;
      fuel_variance_penalty = roundMoney(excessLitres * validDieselPrice);
    }
  }

  // 4. Deductions Math
  const total_deductions = roundMoney(total_advances + fuel_variance_penalty + validOtherDeductions);

  // 5. Net Amount Math
  const net_amount = roundMoney(gross_earnings - total_deductions);

  // 6. Direction & Settlement Type
  let settlement_type: 'payable_to_driver' | 'receivable_from_driver' | 'settled_even' = 'settled_even';
  let amount_company_owes_driver = 0;
  let amount_driver_owes_company = 0;

  if (net_amount > 0) {
    settlement_type = 'payable_to_driver';
    amount_company_owes_driver = net_amount;
  } else if (net_amount < 0) {
    settlement_type = 'receivable_from_driver';
    amount_driver_owes_company = Math.abs(net_amount);
  }

  const actual_mileage = total_diesel_litres > 0 ? roundMoney(total_kms / total_diesel_litres) : 0;

  return {
    total_kms,
    rate_per_km: validRatePerKm,
    base_earnings,
    total_reimbursements,
    gross_earnings,
    total_advances,
    benchmark_mileage: validBenchmark,
    actual_diesel_litres: total_diesel_litres,
    actual_mileage,
    fuel_variance_penalty,
    other_deductions: validOtherDeductions,
    other_deductions_notes,
    total_deductions,
    net_amount,
    settlement_type,
    amount_company_owes_driver,
    amount_driver_owes_company,
  };
}
