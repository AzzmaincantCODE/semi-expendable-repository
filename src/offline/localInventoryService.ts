/**
 * OFFLINE EXPERIMENT — localInventoryService.ts
 *
 * Mirrors the public API of simpleInventoryService but stores
 * data in localDb (IndexedDB) instead of Supabase.
 *
 * Import from '@/offline/localInventoryService' — never replaces
 * the original service, just runs side-by-side.
 */

import {
  inventoryDb,
  LocalInventoryItem,
  incrementPending,
} from './localDb';

// ─── Types (mirror simpleInventoryService) ────────────────────────────────────

export interface LocalServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const localInventoryService = {
  async getAll(): Promise<LocalServiceResponse<LocalInventoryItem[]>> {
    try {
      const data = await inventoryDb.getAll();
      // Sort by createdAt desc to match Supabase ordering
      data.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return { data, error: null, success: true };
    } catch (err) {
      return { data: null, error: String(err), success: false };
    }
  },

  async getById(id: string): Promise<LocalServiceResponse<LocalInventoryItem>> {
    try {
      const data = await inventoryDb.getById(id);
      return { data, error: null, success: !!data };
    } catch (err) {
      return { data: null, error: String(err), success: false };
    }
  },

  async create(
    item: Omit<LocalInventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<LocalServiceResponse<LocalInventoryItem>> {
    try {
      const now = new Date().toISOString();
      const record: LocalInventoryItem = {
        ...item,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: now,
        updatedAt: now,
        _offline: true,
        _pendingOp: 'create',
      };
      await inventoryDb.put(record);
      await incrementPending();
      return { data: record, error: null, success: true };
    } catch (err) {
      return { data: null, error: String(err), success: false };
    }
  },

  async update(
    id: string,
    updates: Partial<LocalInventoryItem>
  ): Promise<LocalServiceResponse<LocalInventoryItem>> {
    try {
      const existing = await inventoryDb.getById(id);
      if (!existing) return { data: null, error: 'Item not found', success: false };

      const updated: LocalInventoryItem = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
        _offline: true,
        _pendingOp: existing._pendingOp === 'create' ? 'create' : 'update',
      };
      await inventoryDb.put(updated);
      if (!existing._offline) await incrementPending();
      return { data: updated, error: null, success: true };
    } catch (err) {
      return { data: null, error: String(err), success: false };
    }
  },

  async delete(id: string): Promise<LocalServiceResponse<void>> {
    try {
      const existing = await inventoryDb.getById(id);
      if (existing && existing._offline && existing._pendingOp === 'create') {
        // If we never synced this record, just remove it entirely — no sync needed
        await inventoryDb.remove(id);
      } else {
        // Mark as pending delete so sync engine can delete it from Supabase
        await inventoryDb.put({
          ...(existing ?? { id, createdAt: '', updatedAt: '' }),
          id,
          updatedAt: new Date().toISOString(),
          _offline: true,
          _pendingOp: 'delete',
        });
        if (!existing?._offline) await incrementPending();
      }
      return { data: null, error: null, success: true };
    } catch (err) {
      return { data: null, error: String(err), success: false };
    }
  },

  /** Clear the local store and replace with a fresh snapshot from Supabase */
  async seedFromLive(items: LocalInventoryItem[]): Promise<void> {
    await inventoryDb.seedFromLive(items);
  },
};
