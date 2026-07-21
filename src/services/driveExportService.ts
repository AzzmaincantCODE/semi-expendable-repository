/**
 * On-demand "save a backup to an external drive" export.
 *
 * The scheduled mirror only writes to the local Documents folder. This lets
 * the user, whenever THEY choose, plug in a flash/external drive, click a
 * button, pick the drive, and drop a fresh full snapshot onto it.
 *
 * How it works in a sandboxed renderer:
 *  - Data is fetched fresh from Supabase through the logged-in session
 *    (same anon key the app already uses — no service key in the client).
 *  - Files are written with the File System Access API (showDirectoryPicker),
 *    which is how a browser/Electron app writes to a user-chosen folder.
 *  - If that API isn't available, we fall back to downloading a single Excel
 *    file the user can then copy to the drive manually.
 */

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const PAGE_SIZE = 1000;
const EXCEL_NAME = 'SemiPropertyMirror.xlsx';

export interface ExportProgress {
  phase: 'discovering' | 'fetching' | 'writing' | 'done';
  table?: string;
  done: number;
  total: number;
}

export interface ExportResult {
  location: string;          // where it was saved (folder name or "download")
  tables: number;
  totalRows: number;
  method: 'folder' | 'download';
}

/** True when the browser/Electron build can write to a picked folder. */
export function canWriteToFolder(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function';
}

/** Discover base tables via PostgREST OpenAPI (falls back to a small probe). */
async function discoverTables(): Promise<string[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) throw new Error(`OpenAPI HTTP ${res.status}`);
    const spec = await res.json();
    const tables = Object.keys(spec.paths || {})
      .filter((p) => p !== '/' && !p.startsWith('/rpc'))
      .map((p) => p.slice(1))
      .sort();
    if (tables.length) return tables;
    throw new Error('empty spec');
  } catch {
    // Minimal fallback — the core tables the app writes to.
    return [
      'departments', 'suppliers', 'custodians', 'fund_sources',
      'semi_expandable_categories', 'purchase_orders', 'purchase_order_items',
      'inventory_items', 'property_cards', 'property_card_entries',
      'custodian_slips', 'custodian_slip_items', 'iar_reports', 'iar_items',
      'return_slips', 'return_slip_items', 'transfers', 'transfer_items',
    ];
  }
}

async function fetchAllRows(table: string): Promise<any[] | null> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // 404-ish / missing table — skip it, not fatal.
      return null;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function excelSafeRow(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  }
  return out;
}

function buildWorkbook(tableData: Record<string, any[]>, finishedAt: string) {
  const wb = XLSX.utils.book_new();
  const summary = Object.entries(tableData).map(([Table, rows]) => ({
    Table, Rows: rows.length,
  }));
  const summarySheet = XLSX.utils.json_to_sheet([
    { Table: '— MIRROR SNAPSHOT —', Rows: finishedAt },
    ...summary,
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, '_SUMMARY');

  for (const [table, rows] of Object.entries(tableData)) {
    let name = table.slice(0, 31);
    let n = 2;
    while (wb.SheetNames.includes(name)) name = `${table.slice(0, 28)}~${n++}`;
    const sheet = rows.length
      ? XLSX.utils.json_to_sheet(rows.map(excelSafeRow))
      : XLSX.utils.aoa_to_sheet([['(empty table)']]);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }
  return wb;
}

/**
 * Fetch everything, then write it to a user-picked folder (or download the
 * Excel as a fallback). Call canWriteToFolder() first to tell the user which
 * behavior to expect.
 */
export async function exportToDrive(
  onProgress?: (p: ExportProgress) => void
): Promise<ExportResult> {
  onProgress?.({ phase: 'discovering', done: 0, total: 1 });
  const tables = await discoverTables();

  const tableData: Record<string, any[]> = {};
  let totalRows = 0;
  let done = 0;
  for (const table of tables) {
    onProgress?.({ phase: 'fetching', table, done, total: tables.length });
    const rows = await fetchAllRows(table);
    done += 1;
    if (rows === null) continue; // missing table
    tableData[table] = rows;
    totalRows += rows.length;
  }

  const finishedAt = new Date().toISOString();
  const manifest = {
    finishedAt,
    supabaseUrl: SUPABASE_URL,
    totalRows,
    tables: Object.fromEntries(
      Object.entries(tableData).map(([t, r]) => [t, { status: 'ok', rows: r.length }])
    ),
  };
  const workbook = buildWorkbook(tableData, finishedAt);

  // ── Preferred path: write a full folder to the picked drive ──────────────
  if (canWriteToFolder()) {
    onProgress?.({ phase: 'writing', done: 0, total: 1 });
    // User picks the drive/destination.
    const dirHandle: any = await (window as any).showDirectoryPicker({ mode: 'readwrite' });

    // Put everything under a dated, named subfolder so it's obvious + repeatable.
    const p = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    const folderName = `SemiPropertyBackup_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    const outDir = await dirHandle.getDirectoryHandle(folderName, { create: true });

    const writeFile = async (name: string, contents: string | Blob) => {
      const fh = await outDir.getFileHandle(name, { create: true });
      const ws = await fh.createWritable();
      await ws.write(contents);
      await ws.close();
    };

    for (const [table, rows] of Object.entries(tableData)) {
      await writeFile(`${table}.json`, JSON.stringify(rows, null, 1));
    }
    await writeFile('_manifest.json', JSON.stringify(manifest, null, 2));
    const xlsxBuf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    await writeFile(EXCEL_NAME, new Blob([xlsxBuf]));

    onProgress?.({ phase: 'done', done: 1, total: 1 });
    return { location: folderName, tables: Object.keys(tableData).length, totalRows, method: 'folder' };
  }

  // ── Fallback: download the Excel workbook (user copies it to the drive) ──
  XLSX.writeFile(workbook, EXCEL_NAME);
  onProgress?.({ phase: 'done', done: 1, total: 1 });
  return { location: 'Downloads folder', tables: Object.keys(tableData).length, totalRows, method: 'download' };
}
