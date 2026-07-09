/**
 * OFFLINE EXPERIMENT — localDb.ts (expanded)
 *
 * Local database using localforage (IndexedDB).
 * Stores a full snapshot of all Supabase data needed to run the app offline:
 *   - inventory_items
 *   - purchase_orders + purchase_order_items
 *   - property_cards + property_card_entries
 *   - custodian_slips + custodian_slip_items
 *   - custodians, fund_sources, suppliers, semi_expandable_categories (lookups)
 */

import localforage from 'localforage';

// ─── Factory helper ───────────────────────────────────────────────────────────

function store(name: string) {
  return localforage.createInstance({ name: 'semiproperty-offline', storeName: name });
}

// ─── Store instances ──────────────────────────────────────────────────────────

const stores = {
  inventory_items:              store('inventory_items'),
  purchase_orders:              store('purchase_orders'),
  purchase_order_items:         store('purchase_order_items'),
  property_cards:               store('property_cards'),
  property_card_entries:        store('property_card_entries'),
  custodian_slips:              store('custodian_slips'),
  custodian_slip_items:         store('custodian_slip_items'),
  custodians:                   store('custodians'),
  fund_sources:                 store('fund_sources'),
  suppliers:                    store('suppliers'),
  semi_expandable_categories:   store('semi_expandable_categories'),
  _meta:                        store('_meta'),
};

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function getAllFrom<T>(s: LocalForage): Promise<T[]> {
  const results: T[] = [];
  await s.iterate<T, void>((v) => { results.push(v); });
  return results;
}

async function getByIdFrom<T>(s: LocalForage, id: string): Promise<T | null> {
  return s.getItem<T>(id);
}

async function putInto<T extends { id: string }>(s: LocalForage, record: T): Promise<T> {
  await s.setItem(record.id, record);
  return record;
}

async function removeFrom(s: LocalForage, id: string): Promise<void> {
  await s.removeItem(id);
}

async function clearAll(s: LocalForage): Promise<void> {
  await s.clear();
}

/** Bulk-seed a store — wipes existing data first */
async function seedStore<T extends { id: string }>(s: LocalForage, rows: T[]): Promise<void> {
  await s.clear();
  await Promise.all(rows.map((r) => s.setItem(r.id, r)));
}

// ─── Pending-change counter ───────────────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  return (await stores._meta.getItem<number>('pendingCount')) ?? 0;
}

export async function incrementPending(): Promise<void> {
  const c = await getPendingCount();
  await stores._meta.setItem('pendingCount', c + 1);
}

export async function decrementPending(by = 1): Promise<void> {
  const c = await getPendingCount();
  await stores._meta.setItem('pendingCount', Math.max(0, c - by));
}

export async function resetPendingCount(): Promise<void> {
  await stores._meta.setItem('pendingCount', 0);
}

/** Snapshot timestamp — when we last seeded from Supabase */
export async function getSnapshotAge(): Promise<Date | null> {
  const ts = await stores._meta.getItem<string>('snapshotAt');
  return ts ? new Date(ts) : null;
}

export async function setSnapshotTimestamp(): Promise<void> {
  await stores._meta.setItem('snapshotAt', new Date().toISOString());
}

// ─── Inventory Items ──────────────────────────────────────────────────────────

export interface LocalInventoryItem {
  id: string;
  propertyNumber?: string;
  description?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  unitOfMeasure?: string;
  quantity?: number;
  unitCost?: number;
  totalCost?: number;
  dateAcquired?: string;
  condition?: string;
  status?: string;
  semiExpandableCategory?: string;
  subCategory?: string;
  estimatedUsefulLife?: string;
  remarks?: string;
  custodian?: string;
  custodianPosition?: string;
  assignmentStatus?: string;
  createdAt: string;
  updatedAt: string;
  _offline?: boolean;
  _pendingOp?: 'create' | 'update' | 'delete';
}

export const inventoryDb = {
  getAll: () => getAllFrom<LocalInventoryItem>(stores.inventory_items),
  getById: (id: string) => getByIdFrom<LocalInventoryItem>(stores.inventory_items, id),
  put: (r: LocalInventoryItem) => putInto(stores.inventory_items, r),
  remove: (id: string) => removeFrom(stores.inventory_items, id),
  clear: () => clearAll(stores.inventory_items),
  seed: (rows: LocalInventoryItem[]) => seedStore(stores.inventory_items, rows),
  getPending: async () => {
    const all = await getAllFrom<LocalInventoryItem>(stores.inventory_items);
    return all.filter((r) => r._offline === true);
  },
  seedFromLive: (rows: LocalInventoryItem[]) => seedStore(stores.inventory_items, rows),
};

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export const purchaseOrderDb = {
  getAll: () => getAllFrom<any>(stores.purchase_orders),
  getById: (id: string) => getByIdFrom<any>(stores.purchase_orders, id),
  put: (r: any) => putInto(stores.purchase_orders, r),
  clear: () => clearAll(stores.purchase_orders),
  seed: (rows: any[]) => seedStore(stores.purchase_orders, rows),
  seedFromLive: (rows: any[]) => seedStore(stores.purchase_orders, rows),
};

export const purchaseOrderItemDb = {
  getAll: () => getAllFrom<any>(stores.purchase_order_items),
  getByPoId: async (poId: string) => {
    const all = await getAllFrom<any>(stores.purchase_order_items);
    return all.filter((r) => r.purchase_order_id === poId);
  },
  seed: (rows: any[]) => seedStore(stores.purchase_order_items, rows),
};

// ─── Property Cards ───────────────────────────────────────────────────────────

export const propertyCardDb = {
  getAll: () => getAllFrom<any>(stores.property_cards),
  getById: (id: string) => getByIdFrom<any>(stores.property_cards, id),
  put: (r: any) => putInto(stores.property_cards, r),
  clear: () => clearAll(stores.property_cards),
  seed: (rows: any[]) => seedStore(stores.property_cards, rows),
  seedFromLive: (rows: any[]) => seedStore(stores.property_cards, rows),
};

export const propertyCardEntryDb = {
  getAll: () => getAllFrom<any>(stores.property_card_entries),
  getByCardId: async (cardId: string) => {
    const all = await getAllFrom<any>(stores.property_card_entries);
    return all.filter((r) => r.property_card_id === cardId);
  },
  seed: (rows: any[]) => seedStore(stores.property_card_entries, rows),
};

// ─── Custodian Slips ──────────────────────────────────────────────────────────

export const custodianSlipDb = {
  getAll: () => getAllFrom<any>(stores.custodian_slips),
  getById: (id: string) => getByIdFrom<any>(stores.custodian_slips, id),
  put: (r: any) => putInto(stores.custodian_slips, r),
  clear: () => clearAll(stores.custodian_slips),
  seed: (rows: any[]) => seedStore(stores.custodian_slips, rows),
  seedFromLive: (rows: any[]) => seedStore(stores.custodian_slips, rows),
};

export const custodianSlipItemDb = {
  getAll: () => getAllFrom<any>(stores.custodian_slip_items),
  getBySlipId: async (slipId: string) => {
    const all = await getAllFrom<any>(stores.custodian_slip_items);
    return all.filter((r) => r.custodian_slip_id === slipId);
  },
  seed: (rows: any[]) => seedStore(stores.custodian_slip_items, rows),
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const custodianLocalDb = {
  getAll: () => getAllFrom<any>(stores.custodians),
  seed: (rows: any[]) => seedStore(stores.custodians, rows),
};

export const fundSourceLocalDb = {
  getAll: () => getAllFrom<any>(stores.fund_sources),
  seed: (rows: any[]) => seedStore(stores.fund_sources, rows),
};

export const supplierLocalDb = {
  getAll: () => getAllFrom<any>(stores.suppliers),
  seed: (rows: any[]) => seedStore(stores.suppliers, rows),
};

export const categoryLocalDb = {
  getAll: () => getAllFrom<any>(stores.semi_expandable_categories),
  seed: (rows: any[]) => seedStore(stores.semi_expandable_categories, rows),
};
