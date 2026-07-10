/**
 * OFFLINE EXPERIMENT — snapshotEngine.ts
 *
 * Downloads the FULL Supabase database into localDb before going offline.
 * This makes every feature (ICS, Property Cards, Custodians, etc.) available offline.
 */

import { supabase } from '@/lib/supabase';
import {
  inventoryDb,
  purchaseOrderDb,
  purchaseOrderItemDb,
  propertyCardDb,
  propertyCardEntryDb,
  custodianSlipDb,
  custodianSlipItemDb,
  custodianLocalDb,
  fundSourceLocalDb,
  supplierLocalDb,
  categoryLocalDb,
  setSnapshotTimestamp,
} from './localDb';

export interface SnapshotStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  count?: number;
  error?: string;
}

export type SnapshotProgressCallback = (steps: SnapshotStep[]) => void;

const STEPS: SnapshotStep[] = [
  { label: 'Inventory Items',             status: 'pending' },
  { label: 'Purchase Orders',             status: 'pending' },
  { label: 'Property Cards',              status: 'pending' },
  { label: 'Inventory Custodian Slips',   status: 'pending' },
  { label: 'Custodians',                  status: 'pending' },
  { label: 'Fund Sources & Categories',   status: 'pending' },
];

async function safeQuery(
  query: PromiseLike<{ data: any; error: any }>
): Promise<any[]> {
  try {
    const { data, error } = await query;
    if (error) { 
      console.warn('[snapshotEngine] Query error:', error); 
      throw error; 
    }
    return (Array.isArray(data) ? data : []);
  } catch (e) {
    console.warn('[snapshotEngine] Network error:', e);
    throw e;
  }
}

export async function takeFullSnapshot(
  onProgress?: SnapshotProgressCallback
): Promise<boolean> {
  const steps: SnapshotStep[] = STEPS.map((s) => ({ ...s }));
  const report = () => onProgress?.([...steps]);
  report();

  try {
    // ── 0: Inventory Items ────────────────────────────────────────────────────
    steps[0].status = 'loading'; report();
    const inventoryRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('inventory_items').select('*').order('created_at', { ascending: false }) as any
    );
    // Map DB snake_case → camelCase used by localInventoryService
    const mappedInventory = inventoryRows.map((r: any) => ({
      id: r.id,
      propertyNumber: r.property_number,
      description: r.description || '',
      brand: r.brand || '',
      model: r.model || '',
      serialNumber: r.serial_number || '',
      unitOfMeasure: r.unit_of_measure,
      quantity: r.quantity,
      unitCost: r.unit_cost,
      totalCost: r.total_cost,
      dateAcquired: r.date_acquired,
      warrantyEndDate: r.warranty_end_date,
      lifespanEndDate: r.lifespan_end_date,
      condition: r.condition,
      status: r.status,
      semiExpandableCategory: r.semi_expandable_category,
      subCategory: r.sub_category,
      estimatedUsefulLife: r.estimated_useful_life,
      remarks: r.remarks,
      custodian: r.custodian,
      custodianPosition: r.custodian_position,
      assignmentStatus: r.assignment_status,
      fundSource: r.fund_source_id,
      supplier: r.supplier_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      _offline: false,
    }));
    await inventoryDb.seed(mappedInventory as any);
    steps[0].status = 'done'; steps[0].count = mappedInventory.length; report();

    // ── 1: Purchase Orders ────────────────────────────────────────────────────
    steps[1].status = 'loading'; report();
    const poRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('purchase_orders').select('*, purchase_order_items(*)').order('created_at', { ascending: false }) as any
    );
    // Seed POs (with items embedded)
    await purchaseOrderDb.seed(poRows.map((r: any) => ({ ...r, id: r.id })));
    // Also seed items flat for cross-lookups
    const allPoItems = poRows.flatMap((po: any) =>
      (po.purchase_order_items || []).map((item: any) => ({ ...item, purchase_order_id: po.id }))
    );
    await purchaseOrderItemDb.seed(allPoItems);
    steps[1].status = 'done'; steps[1].count = poRows.length; report();

    // ── 2: Property Cards ─────────────────────────────────────────────────────
    steps[2].status = 'loading'; report();
    const cardRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('property_cards').select('*').order('created_at', { ascending: false }) as any
    );
    await propertyCardDb.seed(cardRows);
    const entryRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('property_card_entries').select('*') as any
    );
    await propertyCardEntryDb.seed(entryRows);
    steps[2].status = 'done'; steps[2].count = cardRows.length; report();

    // ── 3: Custodian Slips ────────────────────────────────────────────────────
    steps[3].status = 'loading'; report();
    const slipRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('custodian_slips').select('*').order('created_at', { ascending: false }) as any
    );
    await custodianSlipDb.seed(slipRows);
    const slipItemRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('custodian_slip_items').select('*') as any
    );
    await custodianSlipItemDb.seed(slipItemRows);
    steps[3].status = 'done'; steps[3].count = slipRows.length; report();

    // ── 4: Custodians ─────────────────────────────────────────────────────────
    steps[4].status = 'loading'; report();
    const custodianRows = await safeQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('custodians').select('id, name, custodian_no, position, department_id').order('name') as any
    );
    await custodianLocalDb.seed(custodianRows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.custodian_no,
      position: r.position,
      departmentId: r.department_id,
    })));
    steps[4].status = 'done'; steps[4].count = custodianRows.length; report();

    // ── 5: Lookups ────────────────────────────────────────────────────────────
    steps[5].status = 'loading'; report();
    const [fundSources, suppliers, categories] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      safeQuery(supabase.from('fund_sources').select('id, name, code').eq('is_active', true).order('name') as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      safeQuery(supabase.from('suppliers').select('id, name, address').eq('is_active', true).order('name') as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      safeQuery(supabase.from('semi_expandable_categories').select('id, name, code').eq('is_active', true).order('name') as any),
    ]);
    await Promise.all([
      fundSourceLocalDb.seed(fundSources),
      supplierLocalDb.seed(suppliers),
      categoryLocalDb.seed(categories),
    ]);
    steps[5].status = 'done';
    steps[5].count = fundSources.length + suppliers.length + categories.length;
    report();

    // ── Done ──────────────────────────────────────────────────────────────────
    await setSnapshotTimestamp();
    return true;

  } catch (err) {
    console.error('[snapshotEngine] Fatal error:', err);
    const failedIdx = steps.findIndex((s) => s.status === 'loading');
    if (failedIdx >= 0) {
      steps[failedIdx].status = 'error';
      steps[failedIdx].error = err instanceof Error ? err.message : String(err);
      report();
    }
    return false;
  }
}
