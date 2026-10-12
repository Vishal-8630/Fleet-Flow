import { describe, it, expect } from 'vitest';
import { VehicleLocationLog } from '../../models/VehicleLocationLog.js';
import { Ledger } from '../../models/Ledger.js';
import { TruckJourney } from '../../models/TruckJourney.js';
import { Invoice } from '../../models/Invoice.js';
import { Entry } from '../../models/Entry.js';

describe('Phase 2.2: Compound Multi-Tenant Indexes (IMP-004)', () => {
  function hasIndex(indexes: any[], targetFields: Record<string, number>): boolean {
    return indexes.some(([fields]) => {
      const keys = Object.keys(fields);
      const targetKeys = Object.keys(targetFields);
      if (keys.length !== targetKeys.length) return false;
      return targetKeys.every((k) => fields[k] === targetFields[k]);
    });
  }

  it('declares compound time-series index on VehicleLocationLog', () => {
    const indexes = VehicleLocationLog.schema.indexes();
    const exists = hasIndex(indexes, { company_id: 1, truck_id: 1, recorded_at: -1 });
    expect(exists).toBe(true);
  });

  it('declares compound party statement indexes on Ledger', () => {
    const indexes = Ledger.schema.indexes();
    const hasBalanceParty = hasIndex(indexes, { company_id: 1, balance_party_id: 1, transaction_date: -1 });
    const hasBillingParty = hasIndex(indexes, { company_id: 1, billing_party_id: 1, transaction_date: -1 });
    expect(hasBalanceParty).toBe(true);
    expect(hasBillingParty).toBe(true);
  });

  it('declares compound dispatch and truck history indexes on TruckJourney', () => {
    const indexes = TruckJourney.schema.indexes();
    const hasStatus = hasIndex(indexes, { company_id: 1, status: 1, start_date: -1 });
    const hasTruck = hasIndex(indexes, { company_id: 1, truck_id: 1, start_date: -1 });
    expect(hasStatus).toBe(true);
    expect(hasTruck).toBe(true);
  });

  it('upgrades Invoice status index to compound due_date and removes redundant prefix', () => {
    const indexes = Invoice.schema.indexes();
    const hasCompoundDueDate = hasIndex(indexes, { company_id: 1, status: 1, due_date: 1 });
    const hasRedundantPrefix = hasIndex(indexes, { company_id: 1, status: 1 });
    expect(hasCompoundDueDate).toBe(true);
    expect(hasRedundantPrefix).toBe(false);
  });

  it('declares compound dispatch list index on Entry', () => {
    const indexes = Entry.schema.indexes();
    const hasStatusDate = hasIndex(indexes, { company_id: 1, status: 1, lr_date: -1 });
    expect(hasStatusDate).toBe(true);
  });

  it('synchronizes all indexes to MongoDB without duplicate index errors', async () => {
    await Promise.all([
      VehicleLocationLog.syncIndexes(),
      Ledger.syncIndexes(),
      TruckJourney.syncIndexes(),
      Invoice.syncIndexes(),
      Entry.syncIndexes(),
    ]);

    // Verify index list directly from MongoDB database
    const invoiceDbIndexes = await Invoice.collection.indexes();
    const hasDbIndex = invoiceDbIndexes.some((idx: any) =>
      idx.key && idx.key.company_id === 1 && idx.key.status === 1 && idx.key.due_date === 1
    );
    expect(hasDbIndex).toBe(true);
  });

  it('verifies that tenant queries use IXSCAN via MongoDB query explain plan', async () => {
    await Promise.all([
      VehicleLocationLog.syncIndexes(),
      Ledger.syncIndexes(),
      TruckJourney.syncIndexes(),
      Invoice.syncIndexes(),
      Entry.syncIndexes(),
    ]);

    const fakeCompanyId = new Entry.base.Types.ObjectId();
    const fakePartyId = new Entry.base.Types.ObjectId();
    const fakeTruckId = new Entry.base.Types.ObjectId();

    // 1. Invoice explain plan
    const invoiceExplain: any = await Invoice.find({
      company_id: fakeCompanyId,
      status: 'issued',
    })
      .sort({ due_date: 1 })
      .explain('executionStats');

    const invoiceStage = JSON.stringify(invoiceExplain);
    expect(invoiceStage).toContain('IXSCAN');
    expect(invoiceStage).toContain('company_id_1_status_1_due_date_1');

    // 2. Entry explain plan
    const entryExplain: any = await Entry.find({
      company_id: fakeCompanyId,
      status: 'active',
    })
      .sort({ lr_date: -1 })
      .explain('executionStats');

    const entryStage = JSON.stringify(entryExplain);
    expect(entryStage).toContain('IXSCAN');
    expect(entryStage).toContain('company_id_1_status_1_lr_date_-1');

    // 3. TruckJourney explain plan
    const journeyExplain: any = await TruckJourney.find({
      company_id: fakeCompanyId,
      status: 'active',
    })
      .sort({ start_date: -1 })
      .explain('executionStats');

    const journeyStage = JSON.stringify(journeyExplain);
    expect(journeyStage).toContain('IXSCAN');
    expect(journeyStage).toContain('company_id_1_status_1_start_date_-1');

    // 4. Ledger explain plan
    const ledgerExplain: any = await Ledger.find({
      company_id: fakeCompanyId,
      balance_party_id: fakePartyId,
    })
      .sort({ transaction_date: -1 })
      .explain('executionStats');

    const ledgerStage = JSON.stringify(ledgerExplain);
    expect(ledgerStage).toContain('IXSCAN');
    expect(ledgerStage).toContain('company_id_1_balance_party_id_1_transaction_date_-1');

    // 5. VehicleLocationLog explain plan
    const logExplain: any = await VehicleLocationLog.find({
      company_id: fakeCompanyId,
      truck_id: fakeTruckId,
    })
      .sort({ recorded_at: -1 })
      .explain('executionStats');

    const logStage = JSON.stringify(logExplain);
    expect(logStage).toContain('IXSCAN');
    expect(logStage).toContain('company_id_1_truck_id_1_recorded_at_-1');
  });
});
