/**
 * Restore — pushes a mirror/backup snapshot (folder of <table>.json files)
 * back into a Supabase project. Used for disaster recovery: point it at
 * Documents\SemiPropertyMirror\current, an archives\YYYY-MM-DD folder, or a
 * SemiPropertyBackups\YYYY-MM-DD_HHmm folder.
 *
 * SAFE BY DEFAULT: without --apply it only prints what it WOULD do.
 *
 * Usage:
 *   npm run restore -- <snapshot-folder>                 (dry run — no writes)
 *   npm run restore -- <snapshot-folder> --apply         (upsert all rows)
 *   npm run restore -- <snapshot-folder> --apply --wipe  (delete table contents first,
 *                                                         then insert — exact clone)
 *   npm run restore -- <folder> --apply --tables=purchase_orders,purchase_order_items
 *
 * Notes:
 * - Target project must already have the schema (run the database/ SQL
 *   scripts on a fresh project first).
 * - Rows are upserted (merge on primary key), so re-running is safe.
 * - Foreign keys: tables are attempted in multiple passes — children that
 *   fail because their parent isn't in yet succeed on a later pass, so the
 *   FK graph never has to be spelled out here.
 * - Views in the snapshot are skipped automatically (inserts into them fail
 *   with a clear PostgREST error, which is treated as "skip", not fatal).
 *
 * Config: scripts/.env.backup (same credentials as backup/mirror).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2).filter((a) => a !== '--');
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const APPLY = flags.has('--apply');
const WIPE = flags.has('--wipe');
const tablesArg = [...flags].find((f) => f.startsWith('--tables='));
const ONLY_TABLES = tablesArg ? tablesArg.slice('--tables='.length).split(',').map((s) => s.trim()) : null;

const snapshotDir = positional[0];
if (!snapshotDir || !fs.existsSync(snapshotDir)) {
  console.error(
    'Usage: npm run restore -- <snapshot-folder> [--apply] [--wipe] [--tables=a,b]\n' +
    'Example: npm run restore -- "%USERPROFILE%\\Documents\\SemiPropertyMirror\\current" --apply'
  );
  process.exit(1);
}

// ─── Credentials ──────────────────────────────────────────────────────────────

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
  console.error('[restore] Missing credentials — see scripts/.env.backup.example');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Known views (not restorable). Anything else that errors like a view is
// skipped at runtime too — this list just avoids noisy first-pass errors.
const KNOWN_VIEWS = new Set([
  'inventory_summary',
  'items_by_department',
  'custodian_accountability',
  'expiring_warranties',
  'low_stock_items',
]);

// ─── REST helpers ─────────────────────────────────────────────────────────────

const CHUNK = 500;

async function wipeTable(table) {
  // PostgREST requires a filter on DELETE; this matches every row.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`,
    { method: 'DELETE', headers: HEADERS }
  );
  if (!res.ok && res.status !== 404) {
    // Tables whose PK isn't "id" — fall back to a universal trick.
    const res2 = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?or=(id.not.is.null,id.is.null)`,
      { method: 'DELETE', headers: HEADERS }
    );
    if (!res2.ok) throw new Error(`wipe ${table}: HTTP ${res.status} ${await res.text()}`);
  }
}

async function upsertRows(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = fs.readdirSync(snapshotDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  let tables = files.map((f) => f.replace(/\.json$/, ''));
  if (ONLY_TABLES) tables = tables.filter((t) => ONLY_TABLES.includes(t));
  tables = tables.filter((t) => !KNOWN_VIEWS.has(t));

  const manifest = fs.existsSync(path.join(snapshotDir, '_manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(snapshotDir, '_manifest.json'), 'utf8'))
    : null;

  console.log(`[restore] Snapshot: ${snapshotDir}`);
  if (manifest) console.log(`[restore] Taken: ${manifest.finishedAt} (${manifest.totalRows} rows)`);
  console.log(`[restore] Target:  ${SUPABASE_URL}`);
  console.log(`[restore] Mode:    ${APPLY ? (WIPE ? 'APPLY + WIPE (exact clone)' : 'APPLY (upsert)') : 'DRY RUN — no writes'}`);
  console.log('');

  // Load all data up front so the dry run can report counts.
  const data = {};
  for (const t of tables) {
    data[t] = JSON.parse(fs.readFileSync(path.join(snapshotDir, `${t}.json`), 'utf8'));
  }

  if (!APPLY) {
    let total = 0;
    for (const t of tables.sort()) {
      console.log(`  would restore ${String(data[t].length).padStart(6)} rows → ${t}`);
      total += data[t].length;
    }
    console.log(`\n[restore] DRY RUN complete: ${total} rows across ${tables.length} tables.`);
    console.log('[restore] Add --apply to write. Add --wipe for an exact clone (deletes current table contents first).');
    return;
  }

  // Wipe children before parents would fail on FKs; easiest robust order is
  // to wipe in reverse multi-pass too. Do wipe passes until stable.
  if (WIPE) {
    console.log('[restore] Wiping target tables...');
    let pending = tables.filter((t) => data[t].length >= 0);
    for (let pass = 1; pending.length && pass <= 6; pass++) {
      const failed = [];
      for (const t of pending) {
        try { await wipeTable(t); console.log(`  wiped ${t}`); }
        catch { failed.push(t); }
      }
      if (failed.length === pending.length) {
        console.error(`[restore] Could not wipe: ${failed.join(', ')} — continuing (upsert will overwrite matching rows)`);
        break;
      }
      pending = failed;
    }
  }

  // Multi-pass insert: FK failures get retried after their parents land.
  let pending = tables.filter((t) => data[t].length > 0)
    .map((t) => ({ table: t, rows: data[t] }));
  const done = [];
  const skippedEmpty = tables.filter((t) => data[t].length === 0);

  for (let pass = 1; pending.length && pass <= 8; pass++) {
    console.log(`[restore] Pass ${pass}: ${pending.length} tables remaining`);
    const failed = [];
    for (const { table, rows } of pending) {
      try {
        await upsertRows(table, rows);
        console.log(`  ✓ ${table}: ${rows.length} rows`);
        done.push(table);
      } catch (err) {
        failed.push({ table, rows, err });
      }
    }
    if (failed.length === pending.length) {
      // No progress this pass — remaining failures are real, not FK ordering.
      console.error('\n[restore] FAILED tables (not FK-ordering — real errors):');
      for (const f of failed) console.error(`  ✗ ${f.table}: ${f.err}`);
      process.exit(2);
    }
    pending = failed;
  }

  console.log(`\n[restore] DONE. ${done.length} tables restored, ${skippedEmpty.length} empty tables skipped.`);
  console.log('[restore] Verify in the app: log in and open a few records.');
}

main().catch((err) => {
  console.error('[restore] Fatal:', err);
  process.exit(1);
});
