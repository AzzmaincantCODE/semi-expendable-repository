/**
 * Scheduled Supabase backup — dumps every table to timestamped JSON files
 * on the local machine.
 *
 * Usage:   npm run backup            (skips if today's backup already exists)
 *          npm run backup -- --force (always runs)
 *
 * Config:  scripts/.env.backup  (gitignored) must contain:
 *            SUPABASE_URL=https://xxxx.supabase.co
 *            SUPABASE_SERVICE_ROLE_KEY=eyJ...   <- Supabase Dashboard > Settings > API
 *          The SERVICE ROLE key is required: since the RLS lockdown
 *          (fix-custodian-slips-rls.sql) the anon key cannot read data.
 *          NEVER commit this key or ship it in the app.
 *
 * Output:  %USERPROFILE%\Documents\SemiPropertyBackups\YYYY-MM-DD_HHmm\<table>.json
 *          plus _manifest.json with row counts. Keeps the newest
 *          RETENTION_COUNT backup folders, deletes older ones.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKUP_ROOT = path.join(os.homedir(), 'Documents', 'SemiPropertyBackups');
const RETENTION_COUNT = 30;
const PAGE_SIZE = 1000;

// Table list is discovered DYNAMICALLY at runtime from PostgREST's OpenAPI
// spec (service key sees everything), so new tables are backed up
// automatically. Views are included too — harmless, and "everything" means
// everything. FALLBACK_TABLES is only used if discovery itself fails.
const FALLBACK_TABLES = [
  'audit_logs',
  'custodian_slip_items',
  'custodian_slips',
  'custodians',
  'departments',
  'fund_sources',
  'iar_items',
  'iar_reports',
  'inventory_items',
  'locations',
  'loss_report_items',
  'loss_reports',
  'physical_count_items',
  'physical_counts',
  'profiles',
  'property_card_entries',
  'property_cards',
  'property_registry',
  'property_transfers',
  'purchase_order_items',
  'purchase_orders',
  'return_slip_items',
  'return_slips',
  'semi_expandable_categories',
  'suppliers',
  'system_notifications',
  'transfer_items',
  'unserviceable_report_items',
  'unserviceable_reports',
  'user_profiles',
  'weekly_property_reports',
];

// ─── Load credentials ─────────────────────────────────────────────────────────

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
  console.error(
    '[backup] Missing credentials.\n' +
    'Create scripts/.env.backup with:\n' +
    '  SUPABASE_URL=https://jiusoksloniuozxrdiok.supabase.co\n' +
    '  SUPABASE_SERVICE_ROLE_KEY=<service_role key from Supabase Dashboard > Settings > API>\n'
  );
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const force = process.argv.includes('--force');

function timestampFolder() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function todayPrefix() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Discover every table/view PostgREST exposes (service key sees all). */
async function discoverTables() {
  try {
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
    return { tables, discovered: true };
  } catch (err) {
    console.warn(`[backup] Table discovery failed (${err}) — using fallback list`);
    return { tables: FALLBACK_TABLES, discovered: false };
  }
}

async function fetchAllRows(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${from}-${to}`,
        'Range-Unit': 'items',
        Prefer: 'count=exact',
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

function pruneOldBackups() {
  const dirs = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(e.name))
    .map((e) => e.name)
    .sort(); // name sort == chronological
  const excess = dirs.slice(0, Math.max(0, dirs.length - RETENTION_COUNT));
  for (const d of excess) {
    fs.rmSync(path.join(BACKUP_ROOT, d), { recursive: true, force: true });
    console.log(`[backup] pruned old backup ${d}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });

  if (!force) {
    const existingToday = fs.readdirSync(BACKUP_ROOT)
      .some((n) => n.startsWith(todayPrefix()) && fs.existsSync(path.join(BACKUP_ROOT, n, '_manifest.json')));
    if (existingToday) {
      console.log(`[backup] A completed backup for today already exists in ${BACKUP_ROOT} — skipping. Use --force to run anyway.`);
      return;
    }
  }

  const folder = path.join(BACKUP_ROOT, timestampFolder());
  fs.mkdirSync(folder, { recursive: true });
  console.log(`[backup] Writing to ${folder}`);

  const { tables: TABLES, discovered } = await discoverTables();
  console.log(`[backup] ${TABLES.length} tables/views (${discovered ? 'auto-discovered' : 'fallback list'})`);

  const manifest = { startedAt: new Date().toISOString(), supabaseUrl: SUPABASE_URL, tableDiscovery: discovered ? 'auto' : 'fallback', tables: {}, errors: [] };
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const { missing, rows } = await fetchAllRows(table);
      if (missing) {
        manifest.tables[table] = { status: 'missing' };
        console.log(`[backup] ${table}: not in DB, skipped`);
        continue;
      }
      fs.writeFileSync(path.join(folder, `${table}.json`), JSON.stringify(rows, null, 1));
      manifest.tables[table] = { status: 'ok', rows: rows.length };
      totalRows += rows.length;
      console.log(`[backup] ${table}: ${rows.length} rows`);
    } catch (err) {
      manifest.tables[table] = { status: 'error', error: String(err) };
      manifest.errors.push(`${table}: ${err}`);
      console.error(`[backup] ${table} FAILED: ${err}`);
    }
  }

  manifest.finishedAt = new Date().toISOString();
  manifest.totalRows = totalRows;
  // Manifest is written LAST — its presence marks the backup as complete.
  fs.writeFileSync(path.join(folder, '_manifest.json'), JSON.stringify(manifest, null, 2));

  pruneOldBackups();

  if (manifest.errors.length) {
    console.error(`[backup] DONE WITH ERRORS (${manifest.errors.length}). ${totalRows} rows saved to ${folder}`);
    process.exit(2);
  }
  console.log(`[backup] DONE. ${totalRows} rows across ${Object.keys(manifest.tables).length} tables → ${folder}`);
}

main().catch((err) => {
  console.error('[backup] Fatal:', err);
  process.exit(1);
});
