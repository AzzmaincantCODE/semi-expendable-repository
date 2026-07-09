/**
 * OFFLINE EXPERIMENT — offlineLookupService.ts
 *
 * Serves lookup data (custodians, fund sources, suppliers, categories)
 * from the local snapshot when in offline mode.
 *
 * Called by lookupService.ts when isOfflineMode is true.
 */

import {
  custodianLocalDb,
  fundSourceLocalDb,
  supplierLocalDb,
  categoryLocalDb,
} from './localDb';
import type { LookupItem } from '@/services/lookupService';

export const offlineLookupService = {
  async getSuppliers(): Promise<LookupItem[]> {
    const rows = await supplierLocalDb.getAll();
    return rows.map((r: any) => ({ id: r.id, name: r.name, address: r.address }));
  },

  async getCustodians(): Promise<LookupItem[]> {
    const rows = await custodianLocalDb.getAll();
    return rows.map((r: any) => ({ id: r.id, name: r.name, code: r.code, position: r.position }));
  },

  async getFundSources(): Promise<LookupItem[]> {
    const rows = await fundSourceLocalDb.getAll();
    return rows.map((r: any) => ({ id: r.id, name: r.name, code: r.code }));
  },

  async getSemiExpandableCategories(): Promise<LookupItem[]> {
    const rows = await categoryLocalDb.getAll();
    return rows.map((r: any) => ({ id: r.id, name: r.name, code: r.code }));
  },
};
