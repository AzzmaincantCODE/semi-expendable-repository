/**
 * Live mirror — rebuilds a complete local copy of every Supabase table every
 * run. Because it's a full rebuild, deletes in the cloud disappear from the
 * mirror automatically on the next cycle.
 *
 * Usage:   npm run mirror
 *
 * Output:
 *   Documents\SemiPropertyMirror\current\            ← always latest (JSON + Excel)
 *   Documents\SemiPropertyMirror\archives\YYYY-MM-DD\ ← one snapshot per day
 *   <ExternalDrive>\SemiPropertyMirror\               ← copied when drive present
 *
 * The Excel workbook (SemiPropertyMirror.xlsx) has one sheet per table and is
 * the human-viewable face of the mirror. The JSON files are the exact,
 * restore-grade copy (used by scripts/restore-supabase.mjs).
 *
 * Config:  scripts/.env.backup  (same file as the backup script):
 *            SUPABASE_URL=...
 *            SUPABASE_SERVICE_ROLE_KEY=...
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────

const MIRROR_ROOT  = path.join(os.homedir(), 'Documents', 'SemiPropertyMirror');
const CURRENT_DIR  = path.join(MIRROR_ROOT, 'current');
const ARCHIVE_DIR  = path.join(MIRROR_ROOT, 'archives');
const ARCHIVE_DAYS = 30;   // keep this many daily snapshots
const PAGE_SIZE    = 1000;
const EXCEL_NAME   = 'SemiPropertyMirror.xlsx';

// External drive auto-detect: first non-C: drive that has (or can create)
// a SemiPropertyMirror folder. Set EXTERNAL_ROOT to force a specific path,
// e.g. 'E:\\SemiPropertyMirror'.
const EXTERNAL_ROOT = process.env.MIRROR_EXTERNAL_ROOT || '';

// ─── Load credentials (same .env.backup as the backup script) ─────────────────

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const envFile = loadEnvFile(path.join(__dirname, '.env.backup'));
const SUPABASE_URL = process.env.SUPABASE_URL || envFile.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[mirror] Missing credentials — see scripts/.env.backup.example');
  process.exit(1);
}

// ─── Fetch helpers (same approach as backup-supabase.mjs) ─────────────────────

async function discoverTables() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`OpenAPI HTTP ${res.status}`);
  const spec = await res.json();
  const tables = Object.keys(spec.paths || {})
    .filter((p) => p !== '/' && !p.startsWith('/rpc'))
    .map((p) => p.slice(1))
    .sort();
  if (!tables.length) throw new Error('OpenAPI listed no tables');
  return tables;
}

async function fetchAllRows(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (res.status === 404) return { missing: true, rows: [] };
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { missing: false, rows };
}

// ─── Excel generation ─────────────────────────────────────────────────────────

/** Flatten values Excel can't hold (objects/arrays → JSON strings). */
function excelSafeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  }
  return out;
}

function buildWorkbook(tableData, manifest) {
  const wb = XLSX.utils.book_new();

  // Summary sheet first: what's in this mirror and when it was taken.
  const summary = Object.entries(manifest.tables).map(([table, info]) => ({
    Table: table,
    Rows: info.rows ?? 0,
    Status: info.status,
  }));
  const summarySheet = XLSX.utils.json_to_sheet([
    { Table: '— MIRROR SNAPSHOT —', Rows: '', Status: manifest.finishedAt },
    ...summary,
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, '_SUMMARY');

  for (const [table, rows] of Object.entries(tableData)) {
    // Sheet names cap at 31 chars and must be unique after truncation.
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

// ─── External drive ───────────────────────────────────────────────────────────

function findExternalRoot() {
  if (EXTERNAL_ROOT) return fs.existsSync(path.parse(EXTERNAL_ROOT).root) ? EXTERNAL_ROOT : null;
  // Auto-detect: any drive letter D-Z whose root exists and is not the OS drive.
  for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = `${letter}:\\`;
    try {
      if (fs.existsSync(root)) return path.join(root, 'SemiPropertyMirror');
    } catch { /* drive not ready */ }
  }
  return null;
}

function copyDirContents(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirContents(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ─── Archive pruning ──────────────────────────────────────────────────────────

function pruneArchives(root) {
  if (!fs.existsSync(root)) return;
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  for (const d of dirs.slice(0, Math.max(0, dirs.length - ARCHIVE_DAYS))) {
    fs.rmSync(path.join(root, d), { recursive: true, force: true });
    console.log(`[mirror] pruned archive ${d}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const started = new Date();
  console.log(`[mirror] Sync started ${started.toISOString()}`);

  const tables = await discoverTables();
  console.log(`[mirror] ${tables.length} tables/views discovered`);

  const manifest = { startedAt: started.toISOString(), supabaseUrl: SUPABASE_URL, tables: {}, errors: [] };
  const tableData = {};
  let totalRows = 0;

  for (const table of tables) {
    try {
      const { missing, rows } = await fetchAllRows(table);
      if (missing) { manifest.tables[table] = { status: 'missing' }; continue; }
      tableData[table] = rows;
      manifest.tables[table] = { status: 'ok', rows: rows.length };
      totalRows += rows.length;
    } catch (err) {
      manifest.tables[table] = { status: 'error', error: String(err) };
      manifest.errors.push(`${table}: ${err}`);
      console.error(`[mirror] ${table} FAILED: ${err}`);
    }
  }
  manifest.finishedAt = new Date().toISOString();
  manifest.totalRows = totalRows;

  // If EVERY table failed (e.g. no internet), keep the existing mirror intact.
  if (!Object.values(manifest.tables).some((t) => t.status === 'ok')) {
    console.error('[mirror] Nothing fetched — keeping previous mirror untouched.');
    process.exit(2);
  }

  // Build the new snapshot in a staging dir, then swap it in. This way the
  // mirror is never half-written even if the machine dies mid-run.
  const staging = path.join(MIRROR_ROOT, '.staging');
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  for (const [table, rows] of Object.entries(tableData)) {
    fs.writeFileSync(path.join(staging, `${table}.json`), JSON.stringify(rows, null, 1));
  }
  XLSX.writeFile(buildWorkbook(tableData, manifest), path.join(staging, EXCEL_NAME));
  fs.writeFileSync(path.join(staging, '_manifest.json'), JSON.stringify(manifest, null, 2));

  // Swap: current → old, staging → current, delete old.
  const old = path.join(MIRROR_ROOT, '.old');
  fs.rmSync(old, { recursive: true, force: true });
  if (fs.existsSync(CURRENT_DIR)) fs.renameSync(CURRENT_DIR, old);
  fs.renameSync(staging, CURRENT_DIR);
  fs.rmSync(old, { recursive: true, force: true });
  console.log(`[mirror] current\\ updated — ${totalRows} rows, Excel + ${Object.keys(tableData).length} JSON files`);

  // Daily archive: first successful run of the day snapshots current\.
  const p = (n) => String(n).padStart(2, '0');
  const today = `${started.getFullYear()}-${p(started.getMonth() + 1)}-${p(started.getDate())}`;
  const todayArchive = path.join(ARCHIVE_DIR, today);
  if (!fs.existsSync(todayArchive)) {
    copyDirContents(CURRENT_DIR, todayArchive);
    console.log(`[mirror] daily archive ${today} created`);
  }
  pruneArchives(ARCHIVE_DIR);

  // External drive copy (best effort — skipped silently when unplugged).
  const external = findExternalRoot();
  if (external) {
    try {
      copyDirContents(CURRENT_DIR, path.join(external, 'current'));
      const extArchive = path.join(external, 'archives', today);
      if (!fs.existsSync(extArchive)) copyDirContents(CURRENT_DIR, extArchive);
      pruneArchives(path.join(external, 'archives'));
      console.log(`[mirror] external copy updated at ${external}`);
    } catch (err) {
      console.warn(`[mirror] external copy failed (${err}) — local mirror is fine`);
    }
  } else {
    console.log('[mirror] no external drive detected — local mirror only');
  }

  if (manifest.errors.length) {
    console.error(`[mirror] DONE WITH ERRORS (${manifest.errors.length})`);
    process.exit(2);
  }
  console.log('[mirror] DONE.');
}

main().catch((err) => {
  console.error('[mirror] Fatal:', err);
  process.exit(1);
});
