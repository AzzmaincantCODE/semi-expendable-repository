/**
 * Browser-side restore service.
 *
 * Reads snapshot JSON files (picked by the user from a mirror/backup folder)
 * and writes them back into Supabase THROUGH THE LOGGED-IN USER'S SESSION.
 * No service key is used — writes are subject to the same RLS as normal app
 * use, so this can only ever do what the current admin could do by hand.
 *
 * Pairs with scripts/restore-supabase.mjs (the terminal version). This one
 * trades the terminal's --wipe superpower for zero-setup, works-everywhere
 * convenience.
 */

import { supabase } from '@/lib/supabase';

/** Views cannot be written to — skip them silently if present in a snapshot. */
export const KNOWN_VIEWS = new Set<string>([
  'available_inventory_items',
  'available_inventory_items_with_property_cards',
  'deletable_custodian_slips',
  'inventory_acquisitions_by_year',
  'inventory_lifecycle_status',
  'inventory_summary',
  'items_by_department',
  'custodian_accountability',
  'expiring_warranties',
  'low_stock_items',
]);

export interface ParsedSnapshot {
  /** table name -> array of row objects */
  tables: Record<string, any[]>;
  /** file names that could not be parsed */
  errors: { file: string; error: string }[];
  /** manifest metadata if _manifest.json was included */
  manifest: { finishedAt?: string; totalRows?: number } | null;
  totalRows: number;
}

export interface RestoreProgress {
  table: string;
  rows: number;
  pass: number;
  status: 'ok' | 'skipped' | 'retry';
}

export interface RestoreResult {
  restored: { table: string; rows: number }[];
  skipped: string[];
  failed: { table: string; error: string }[];
}

const CHUNK = 400;

/**
 * Parse a FileList (from <input type="file" multiple webkitdirectory>) into a
 * snapshot. Only *.json files are read; _manifest.json is pulled out as meta.
 */
export async function parseSnapshotFiles(files: FileList | File[]): Promise<ParsedSnapshot> {
  const list = Array.from(files).filter((f) => f.name.endsWith('.json'));
  const out: ParsedSnapshot = { tables: {}, errors: [], manifest: null, totalRows: 0 };

  for (const file of list) {
    let text: string;
    try {
      text = await file.text();
    } catch (e: any) {
      out.errors.push({ file: file.name, error: `read failed: ${e?.message ?? e}` });
      continue;
    }

    if (file.name === '_manifest.json') {
      try { out.manifest = JSON.parse(text); } catch { /* non-fatal */ }
      continue;
    }
    if (file.name.startsWith('_')) continue; // other meta files

    const table = file.name.replace(/\.json$/, '');
    try {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error('not a JSON array');
      out.tables[table] = rows;
      out.totalRows += rows.length;
    } catch (e: any) {
      out.errors.push({ file: file.name, error: `parse failed: ${e?.message ?? e}` });
    }
  }

  return out;
}

/** Tables in the snapshot that will actually be written (views/empty removed). */
export function restorableTables(snap: ParsedSnapshot): { table: string; rows: number }[] {
  return Object.entries(snap.tables)
    .filter(([t]) => !KNOWN_VIEWS.has(t))
    .map(([table, rows]) => ({ table, rows: rows.length }))
    .sort((a, b) => a.table.localeCompare(b.table));
}

async function upsertChunked(table: string, rows: any[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }
}

/**
 * Restore by upsert (merge). Runs multiple passes so child tables whose
 * parents aren't in yet succeed on a later pass — the FK graph never has to
 * be spelled out. Non-destructive: existing rows not in the snapshot stay.
 *
 * @param onProgress called after each table attempt for UI feedback
 */
export async function restoreSnapshot(
  snap: ParsedSnapshot,
  onProgress?: (p: RestoreProgress) => void,
  onlyTables?: string[]
): Promise<RestoreResult> {
  const result: RestoreResult = { restored: [], skipped: [], failed: [] };

  let pending = Object.entries(snap.tables)
    .filter(([t]) => !KNOWN_VIEWS.has(t))
    .filter(([t]) => !onlyTables || onlyTables.includes(t))
    .map(([table, rows]) => ({ table, rows }));

  // record empty tables as skipped (nothing to write)
  for (const { table, rows } of pending) {
    if (rows.length === 0) {
      result.skipped.push(table);
      onProgress?.({ table, rows: 0, pass: 0, status: 'skipped' });
    }
  }
  pending = pending.filter((p) => p.rows.length > 0);

  for (let pass = 1; pending.length && pass <= 8; pass++) {
    const failed: typeof pending = [];
    for (const { table, rows } of pending) {
      try {
        await upsertChunked(table, rows);
        result.restored.push({ table, rows: rows.length });
        onProgress?.({ table, rows: rows.length, pass, status: 'ok' });
      } catch (e: any) {
        failed.push({ table, rows });
        onProgress?.({ table, rows: rows.length, pass, status: 'retry' });
      }
    }
    if (failed.length === pending.length) {
      // no progress this pass — remaining failures are real, not FK ordering
      for (const { table, rows } of failed) {
        // re-run once to capture the real error message
        try {
          await upsertChunked(table, rows);
          result.restored.push({ table, rows: rows.length });
        } catch (e: any) {
          result.failed.push({ table, error: e?.message ?? String(e) });
        }
      }
      break;
    }
    pending = failed;
  }

  return result;
}
