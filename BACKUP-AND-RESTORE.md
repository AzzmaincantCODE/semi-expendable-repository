# Backup, Mirror & Restore Guide

How the Semi-Property Guardian data protection system works, how to read
the local files, and how to restore — or fully replace — the Supabase
cloud database from your local copies.

---

## Table of contents

1. [What runs automatically](#1-what-runs-automatically)
2. [Where the files live](#2-where-the-files-live)
3. [Reading the Excel workbook](#3-reading-the-excel-workbook)
4. [Reading the JSON files](#4-reading-the-json-files)
5. [Restore to Supabase (recovery)](#5-restore-to-supabase-recovery)
6. [Ditching Supabase entirely](#6-ditching-supabase-entirely)
7. [Cheat sheet](#7-cheat-sheet)

---

## 1. What runs automatically

Three scheduled processes keep your data safe without any clicks:

| Task | Schedule | What it does |
|---|---|---|
| **SemiPropertyGuardian Mirror** | Every 20 minutes | Full snapshot of all tables → JSON + Excel |
| **SemiPropertyGuardian Backup AM** | Daily 11:30 AM | Timestamped JSON-only backup |
| **SemiPropertyGuardian Backup PM** | Daily 4:30 PM | Timestamped JSON-only backup |

**The mirror is your primary safety net.** At any point in time, your data
is at most 20 minutes stale on your local machine. The twice-daily backups
are a secondary, time-stamped archive.

All three run silently in the background — no window, no interruption —
as long as your PC is on and connected to the internet. If a run is missed
(PC off, internet down), the next scheduled run catches up automatically.

---

## 2. Where the files live

```
Documents\
└── SemiPropertyMirror\
    ├── current\                      ← ALWAYS the latest snapshot
    │   ├── SemiPropertyMirror.xlsx   ← human-readable Excel workbook
    │   ├── _manifest.json            ← metadata (when taken, row counts)
    │   ├── departments.json
    │   ├── inventory_items.json
    │   ├── purchase_orders.json
    │   ├── custodian_slips.json
    │   └── ... (one file per table, 36 total)
    └── archives\
        ├── 2026-07-21\               ← first run of the day = daily snapshot
        ├── 2026-07-22\               ← kept for 30 days then auto-deleted
        └── ...

Documents\
└── SemiPropertyBackups\
    ├── 2026-07-21_1130\              ← AM backup
    │   ├── _manifest.json
    │   ├── inventory_items.json
    │   └── ...
    └── 2026-07-21_1630\              ← PM backup
```

If an external drive (1 TB) is connected, a copy also appears at:
```
E:\SemiPropertyMirror\
    ├── current\
    └── archives\
```

---

## 3. Reading the Excel workbook

Open `Documents\SemiPropertyMirror\current\SemiPropertyMirror.xlsx`
in Excel or LibreOffice Calc. No special software needed.

**Sheet layout:**

| Sheet name | Contents |
|---|---|
| `_SUMMARY` | Row counts for every table + snapshot timestamp |
| `departments` | All departments |
| `inventory_items` | Every unit of property (one row = one item) |
| `purchase_orders` | All POs |
| `purchase_order_items` | Line items per PO |
| `custodian_slips` | ICS documents |
| `custodian_slip_items` | Items on each ICS |
| `property_cards` | Property Acknowledgement Cards |
| `property_card_entries` | Entries per card |
| `iar_reports` / `iar_items` | Inspection and Acceptance Reports |
| `return_slips` / `return_slip_items` | Return documents |
| `suppliers`, `custodians` | Reference tables |
| *(and all other tables)* | |

> ⚠️ The Excel workbook is **read-only / reference only** — edits you make
> here do NOT write back to Supabase. To restore data you must use the JSON
> files and the restore script (see section 5).

**Tip:** Use Excel's **Filter** (Ctrl+Shift+L) to search for a specific
property number, department, or PO. All columns are included.

---

## 4. Reading the JSON files

Each `.json` file in `current\` or any archive folder is a plain array of
every row in that table. You can open them in:

- **VS Code** — prettified, searchable, collapsible
- **Notepad** — works, but hard to read (use Ctrl+F to search)
- **Any web browser** — drag-and-drop the file into Chrome/Edge

**Example: `inventory_items.json`**
```json
[
 {
  "id": "c3f8a...",
  "property_number": "SPLV-2026-01-0001",
  "description": "Laptop Computer",
  "department_id": "d1e2...",
  "unit_value": 35000,
  "status": "active",
  "created_at": "2026-01-15T08:23:11.000Z"
 },
 ...
]
```

**`_manifest.json`** tells you when the snapshot was taken and how many
rows each table had at that moment — useful for confirming completeness:
```json
{
  "finishedAt": "2026-07-21T01:28:19.390Z",
  "totalRows": 371,
  "tables": {
    "departments":       { "status": "ok", "rows": 51 },
    "inventory_items":   { "status": "ok", "rows": 41 },
    "purchase_orders":   { "status": "ok", "rows":  5 },
    ...
  }
}
```

---

## 5. Restore to Supabase (recovery)

Use this when:
- The Supabase project was accidentally corrupted or data was deleted
- You are moving to a new Supabase project (same or different account)
- You want to roll back to a specific date's snapshot

### Prerequisites

- Node.js installed + `npm install` done in the repo
- `scripts/.env.backup` present with the **target project's** credentials:
  ```
  SUPABASE_URL=https://<new-project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```
- The target project must have the **schema already applied** — run the
  SQL files in `database/` in the Supabase SQL Editor first if it's a
  fresh project.

### Step 1 — Dry run (always do this first)

```
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current"
```

This prints every table and how many rows it *would* restore — nothing is
written. Verify the row counts look right.

To restore from a specific date instead:
```
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\archives\2026-07-20"
```

Or from a timestamped backup:
```
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyBackups\2026-07-21_1130"
```

### Step 2 — Apply the restore

**Option A — Upsert (safe, non-destructive):**
Merges snapshot rows into the existing database. Rows with matching IDs
are overwritten; rows that no longer exist in the snapshot are left alone.
Good for recovering accidentally deleted records.
```
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current" --apply
```

**Option B — Exact clone (destructive, full replacement):**
Deletes everything in each table first, then inserts the snapshot.
The database becomes an exact copy of the snapshot — nothing extra survives.
Use this when you want to fully roll back or start fresh from a known state.
```
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current" --apply --wipe
```

> ⚠️ `--wipe` deletes current table contents before inserting. Confirm your
> snapshot is correct with a dry run before using this flag.

### Step 3 — Verify

Open the app and log in. Check:
- Dashboard shows the expected item count
- Open a PO, ICS, and property card — confirm items appear
- The restore script handles foreign key ordering automatically (multi-pass)

### Restoring only specific tables

```
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current" --apply --tables=inventory_items,departments
```

---

## 6. Ditching Supabase entirely

Your JSON files contain 100% of your data — no proprietary format, no
cloud lock-in. If you want to move away from Supabase completely, the path
is to migrate to a different database and update the app's connection layer.

### Option A — PostgreSQL (easiest, least code change)

Supabase is hosted PostgreSQL + PostgREST. Replacing it with a self-hosted
PostgreSQL + PostgREST stack means **zero code changes in the app** — just
update the URL and keys in `.env.local`.

1. Install PostgreSQL locally or on a server
2. Run `database/*.sql` to create the schema
3. Run:
   ```
   npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current" --apply
   ```
   pointing `scripts/.env.backup` at the new database's PostgREST URL
4. Update `.env.local` with the new `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Run `npm run desktop:update` to bake the new URL into the desktop app

### Option B — SQLite (fully offline, no server)

All data moves to a local `.sqlite` file. The app would need its Supabase
client calls replaced with a SQLite adapter — significant but doable work
(roughly one to two weeks of refactoring). The JSON files are the
migration source: each file maps directly to a table.

### Option C — Another hosted Postgres provider

AWS RDS, Railway, Neon, Render — all run standard Postgres. Same path as
Option A: stand up PostgREST in front of it, restore from JSON, update keys.

### What the JSON files give you regardless of provider

- Exact row data with all IDs intact (no re-linking needed)
- All timestamps preserved (`created_at`, `updated_at`)
- No proprietary encoding — standard UTF-8 JSON arrays
- Compatible with `psql COPY`, `pgloader`, or any JSON import tool

---

## 7. Cheat sheet

```
# Run the mirror right now (don't wait for the 20-min task)
npm run mirror

# Force the backup right now
npm run backup -- --force

# See what a restore would do (no writes)
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current"

# Restore (merge — safe)
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current" --apply

# Restore (exact clone — destructive)
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\current" --apply --wipe

# Restore a specific past date
npm run restore -- "%USERPROFILE%\Documents\SemiPropertyMirror\archives\2026-07-20" --apply

# Restore only specific tables
npm run restore -- "..." --apply --tables=inventory_items,purchase_orders

# Check scheduled tasks are running
powershell -Command 'Get-ScheduledTask -TaskName "*SemiProperty*" | Select TaskName,State'

# Open the Excel mirror right now
start "" "%USERPROFILE%\Documents\SemiPropertyMirror\current\SemiPropertyMirror.xlsx"
```

---

*Guide covers mirror `372f8dc` + restore `f439fe2`. Update this file when the
scripts change.*
