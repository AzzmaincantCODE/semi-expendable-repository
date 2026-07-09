/**
 * OFFLINE EXPERIMENT — syncEngine.ts (updated)
 *
 * Pushes pending local changes to Supabase with rich, categorized progress events.
 * Shows property numbers for each record being synced.
 */

import { inventoryDb, decrementPending, resetPendingCount } from './localDb';
import { simpleInventoryService } from '@/services/simpleInventoryService';

// ─── Progress event types ─────────────────────────────────────────────────────

export type SyncCategory =
  | 'Inventory Item'
  | 'Property Card'
  | 'Custodian Slip'
  | 'Purchase Order'
  | 'System';

export type SyncStatus = 'pending' | 'syncing' | 'success' | 'error' | 'skipped';

export interface SyncProgressEvent {
  id: string;               // unique key for this event (for React rendering)
  category: SyncCategory;
  propertyNumber?: string;  // e.g. "SPLV-2024-01-0001"
  description?: string;     // e.g. "Dell Laptop"
  operation?: 'create' | 'update' | 'delete';
  status: SyncStatus;
  message?: string;         // extra detail on error
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  errors: string[];
  events: SyncProgressEvent[];
}

export type SyncProgressCallback = (event: SyncProgressEvent) => void;

// ─── Main sync function ───────────────────────────────────────────────────────

export async function syncLocalToSupabase(
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
    errors: [],
    events: [],
  };

  const emit = (event: SyncProgressEvent) => {
    result.events.push(event);
    onProgress?.(event);
  };

  // ─ System start event ──────────────────────────────────────────────────────
  emit({
    id: `sys-start-${Date.now()}`,
    category: 'System',
    status: 'syncing',
    message: 'Starting sync…',
  });

  // ─ Inventory Items ─────────────────────────────────────────────────────────
  const pendingInventory = await inventoryDb.getPending();

  if (pendingInventory.length === 0) {
    emit({
      id: `sys-empty-${Date.now()}`,
      category: 'System',
      status: 'skipped',
      message: 'No pending changes to sync.',
    });
    return result;
  }

  for (const record of pendingInventory) {
    const { _offline, _pendingOp, id, createdAt, updatedAt, ...itemData } = record;
    const displayNum = record.propertyNumber || id.slice(0, 12);
    const eventId = `inv-${id}-${Date.now()}`;

    emit({
      id: eventId,
      category: 'Inventory Item',
      propertyNumber: displayNum,
      description: record.description,
      operation: _pendingOp,
      status: 'syncing',
    });

    try {
      if (_pendingOp === 'create') {
        const res = await simpleInventoryService.create(itemData as any);
        if (res.success && res.data) {
          await inventoryDb.remove(id);
          await inventoryDb.put({ ...record, id: res.data.id, _offline: false, _pendingOp: undefined });
          await decrementPending();
          result.created++;
          emit({ id: `${eventId}-ok`, category: 'Inventory Item', propertyNumber: displayNum, description: record.description, operation: 'create', status: 'success' });
        } else {
          throw new Error(res.error || 'Create failed');
        }
      } else if (_pendingOp === 'update') {
        const res = await simpleInventoryService.update(id, itemData as any);
        if (res.success) {
          await inventoryDb.put({ ...record, _offline: false, _pendingOp: undefined });
          await decrementPending();
          result.updated++;
          emit({ id: `${eventId}-ok`, category: 'Inventory Item', propertyNumber: displayNum, description: record.description, operation: 'update', status: 'success' });
        } else {
          throw new Error(res.error || 'Update failed');
        }
      } else if (_pendingOp === 'delete') {
        const res = await simpleInventoryService.delete(id);
        if (res.success) {
          await inventoryDb.remove(id);
          await decrementPending();
          result.deleted++;
          emit({ id: `${eventId}-ok`, category: 'Inventory Item', propertyNumber: displayNum, operation: 'delete', status: 'success' });
        } else {
          throw new Error(res.error || 'Delete failed');
        }
      }
    } catch (err) {
      result.failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${displayNum}: ${errMsg}`);
      emit({ id: `${eventId}-err`, category: 'Inventory Item', propertyNumber: displayNum, operation: _pendingOp, status: 'error', message: errMsg });
    }
  }

  // ─ System done event ───────────────────────────────────────────────────────
  if (result.failed === 0) {
    await resetPendingCount();
  }

  emit({
    id: `sys-done-${Date.now()}`,
    category: 'System',
    status: result.failed > 0 ? 'error' : 'success',
    message: `Done — ${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.failed} failed.`,
  });

  return result;
}
