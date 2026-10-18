/**
 * ============================================================================
 * PHASE H2 TEST SUITE: NUMERIC INPUT TRAPPING & SETTLEMENT CALCULATOR UX
 * (phase8BatchH2NumericInputsAndSettlement.test.ts)
 * ============================================================================
 * 
 * Verifies the specifications of Batch H Phase H2:
 * 1. FF-ISSUE-018 / FF-ISSUE-046:
 *    - Settlement form numeric inputs allow intermediate empty string typing states
 *      (rate_per_km, benchmark_mileage, diesel_price_per_litre, other_deductions)
 *      without immediate coercion to zero on every keystroke.
 *    - On blur, inputs normalize values, provide validation errors, or default gracefully.
 *    - Validation blocks non-positive wage rates (<= 0), non-positive benchmark mileage (<= 0),
 *      negative diesel prices (< 0), and negative other deductions (< 0).
 *    - Benchmark mileage calculation is guarded against division by zero.
 *    - Inclusion of missing other_deductions_notes input field in modal UI and mutation payload.
 * 2. FF-ISSUE-017 / FF-ISSUE-040:
 *    - Estimated Transit Days numeric input in NewJourneyPage allows intermediate empty string
 *      states on backspace without trapping at zero.
 *    - On blur, empty or invalid values default gracefully to 1.
 *    - Submission enforces minimum transit days >= 1 and safely coerces values.
 * 3. Backend Settlement Calculation & API Contract Integrity:
 *    - calculateDriverSettlement deterministic math with other_deductions_notes.
 *    - Division-by-zero safety when benchmark mileage is zero or non-positive.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateDriverSettlement, roundMoney } from '../../utils/settlementCalculator.js';

describe('Phase H2: Numeric Input Trapping & Settlement Calculator UX', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const settlementListPagePath = path.join(rootDir, 'frontend/src/pages/commercial/SettlementListPage.tsx');
  const newJourneyPagePath = path.join(rootDir, 'frontend/src/pages/operations/NewJourneyPage.tsx');
  const settlementModelPath = path.join(rootDir, 'backend/src/models/Settlement.ts');

  describe('1. Settlement Form Numeric Input State & Non-Trapping (FF-ISSUE-018 / FF-ISSUE-046)', () => {
    it('allows intermediate empty string states for rate_per_km on onChange', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      // Must allow e.target.value directly without Number(e.target.value) trapping
      expect(content).toContain('setSettlementForm({ ...settlementForm, rate_per_km: e.target.value })');
      expect(content).not.toMatch(/rate_per_km:\s*Number\(e\.target\.value\)/);
    });

    it('allows intermediate empty string states for benchmark_mileage on onChange', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      expect(content).toContain('setSettlementForm({ ...settlementForm, benchmark_mileage: e.target.value })');
      expect(content).not.toMatch(/benchmark_mileage:\s*Number\(e\.target\.value\)/);
    });

    it('allows intermediate empty string states for diesel_price_per_litre on onChange', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      expect(content).toContain('setSettlementForm({ ...settlementForm, diesel_price_per_litre: e.target.value })');
      expect(content).not.toMatch(/diesel_price_per_litre:\s*Number\(e\.target\.value\)/);
    });

    it('allows intermediate empty string states for other_deductions on onChange', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      expect(content).toContain('setSettlementForm({ ...settlementForm, other_deductions: e.target.value })');
      expect(content).not.toMatch(/other_deductions:\s*Number\(e\.target\.value\)/);
    });

    it('implements onBlur handlers that normalize values and gracefully handle empty states', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      // Empty other_deductions defaults to 0 on blur
      expect(content).toContain("if (settlementForm.other_deductions === '')");
      expect(content).toContain('other_deductions: 0');

      // Required fields trigger validation errors on blur when empty
      expect(content).toContain("Driver Wage Rate is required.");
      expect(content).toContain("Benchmark mileage is required.");
      expect(content).toContain("Diesel price cannot be empty.");
    });
  });

  describe('2. Settlement Form Validation & Division-by-Zero Safety', () => {
    it('guards benchmark mileage calculation against division by zero in live calculations', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      // Must verify validBenchmarkMileage > 0 before dividing
      expect(content).toContain('validBenchmarkMileage > 0');
      expect(content).toContain('const allowedLitres = totalDistanceKms / validBenchmarkMileage;');
    });

    it('validates non-positive wage rates and benchmark mileage before form submission', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      expect(content).toContain("Driver Wage Rate must be greater than 0.");
      expect(content).toContain("Benchmark Mileage must be greater than 0.");
      expect(content).toContain("Diesel Price must be 0 or greater.");
      expect(content).toContain("Other Deductions cannot be negative.");
    });

    it('includes other_deductions_notes input field in modal UI and mutation payload', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      // Modal UI input field
      expect(content).toContain('Other Deductions Notes / Reason');
      expect(content).toContain('value={settlementForm.other_deductions_notes}');
      expect(content).toContain('setSettlementForm({ ...settlementForm, other_deductions_notes: e.target.value })');

      // Mutation payload inclusion
      expect(content).toContain('other_deductions_notes: settlementForm.other_deductions_notes?.trim() || undefined');
    });

    it('displays other_deductions_notes in the real-time breakdown ribbon when present', () => {
      const content = fs.readFileSync(settlementListPagePath, 'utf8');

      expect(content).toContain('settlementForm.other_deductions_notes ? ` (${settlementForm.other_deductions_notes})` :');
    });
  });

  describe('3. Estimated Transit Days Non-Trapping & Validation (FF-ISSUE-017 / FF-ISSUE-040)', () => {
    it('allows backspace clearing of Estimated Transit Days in NewJourneyPage', () => {
      const content = fs.readFileSync(newJourneyPagePath, 'utf8');

      // Allows raw string value without immediate Number() coercion
      expect(content).toContain('setFormData({ ...formData, estimated_duration_days: e.target.value })');
      expect(content).not.toMatch(/estimated_duration_days:\s*Number\(e\.target\.value\)/);
    });

    it('defaults empty or invalid transit days to 1 on blur in NewJourneyPage', () => {
      const content = fs.readFileSync(newJourneyPagePath, 'utf8');

      expect(content).toContain("if (formData.estimated_duration_days === '')");
      expect(content).toContain('estimated_duration_days: 1');
      expect(content).toContain('if (isNaN(parsed) || parsed < 1)');
    });

    it('enforces minimum 1 transit day on form submission in NewJourneyPage', () => {
      const content = fs.readFileSync(newJourneyPagePath, 'utf8');

      expect(content).toContain("Estimated Transit Days must be at least 1 day.");
      expect(content).toContain('Math.max(1, parseInt(String(formData.estimated_duration_days), 10) || 1)');
    });
  });

  describe('4. Backend Settlement Calculation Engine Integration', () => {
    it('calculates driver settlement correctly with other_deductions and notes', () => {
      const result = calculateDriverSettlement({
        journeys: [
          {
            total_distance_kms: 1000,
            starting_cash_advance: 2000,
            advance_funded_diesel_cost: 500,
            total_driver_expenses: 300,
            total_diesel_litres: 200,
          },
        ],
        rate_per_km: 5.0,
        benchmark_mileage: 4.0,
        diesel_price_per_litre: 90.0,
        other_deductions: 250,
        other_deductions_notes: 'Cargo tarp damage penalty',
      });

      // Gross: (1000 * 5) + 300 = 5300
      expect(result.gross_earnings).toBe(5300);

      // Benchmark allowed: 1000 / 4 = 250 litres. Actual: 200 litres. No penalty.
      expect(result.fuel_variance_penalty).toBe(0);

      // Reconciled advances: 2000 - 500 = 1500
      // Deductions: 1500 (advances) + 0 (penalty) + 250 (other) = 1750
      expect(result.total_deductions).toBe(1750);

      // Net: 5300 - 1750 = 3550 payable to driver
      expect(result.net_amount).toBe(3550);
      expect(result.settlement_type).toBe('payable_to_driver');
      expect(result.other_deductions_notes).toBe('Cargo tarp damage penalty');
    });

    it('guards calculation against division by zero when benchmark_mileage is zero or negative', () => {
      const resultZeroBenchmark = calculateDriverSettlement({
        journeys: [{ total_distance_kms: 500, total_diesel_litres: 100 }],
        rate_per_km: 4.0,
        benchmark_mileage: 0,
      });

      // Should default or guard gracefully without Infinity or NaN
      expect(Number.isFinite(resultZeroBenchmark.fuel_variance_penalty)).toBe(true);
      expect(resultZeroBenchmark.fuel_variance_penalty).toBe(0);
      expect(Number.isFinite(resultZeroBenchmark.net_amount)).toBe(true);
    });

    it('verifies Settlement mongoose model supports other_deductions_notes', () => {
      const content = fs.readFileSync(settlementModelPath, 'utf8');

      expect(content).toContain('other_deductions_notes?: string;');
      expect(content).toContain('other_deductions_notes: { type: String, trim: true }');
    });
  });
});
