# Moving Semi-Property Guardian to Another Machine

Everything important is either in git or in Supabase's cloud, so a move is safe —
but a few gitignored pieces do **not** travel with the repo and must be recreated
by hand. This is the complete checklist.

## What moves automatically

| Thing | Where it lives | Action needed |
|---|---|---|
| App source code | git (`origin` on GitHub) | `git clone` |
| Backup system (script, .bat, .vbs) | git (`scripts/`) | comes with the clone |
| Database + all records | Supabase cloud | none — nothing to move |
| Web app (GitHub Pages) | deployed from GitHub | none — keeps working |

## What does NOT move automatically

| Thing | Why | Fix |
|---|---|---|
| `.env.local` | gitignored (anon key) | recreate — step 3 |
| `scripts/.env.backup` | gitignored (service_role key) | recreate — step 3 |
| Scheduled backup tasks | live in Windows Task Scheduler, not the repo | re-register — step 5 |
| Desktop .exe (`build_desktop/`) | build output, gitignored | rebuild — step 6 |
| Old backup snapshots | `Documents\SemiPropertyBackups\` is outside the repo | copy manually — step 7 |

## Steps on the new machine

### 1. Install prerequisites
- [Node.js](https://nodejs.org) (LTS) — needed for the app, builds, and backups
- Git

### 2. Clone and install
```
git clone https://github.com/AzzmaincantCODE/semi-expendable-repository.git
cd semi-expendable-repository
npm install
```

### 3. Recreate the two secret files (gitignored — never in the repo)

Copy them from the old machine, or rebuild them from the Supabase dashboard
(Settings → API):

**`.env.local`** (repo root — used by the app):
```
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<anon key>
```

**`scripts/.env.backup`** (used by the backup script — see
`scripts/.env.backup.example` for the template):
```
SUPABASE_URL=<project url>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

> ⚠️ The service_role key bypasses all security rules. Keep it only in
> `scripts/.env.backup`, which is gitignored. Never commit it.

### 4. Smoke-test the backup
```
npm run backup -- --force
```
Success = a new dated folder in `Documents\SemiPropertyBackups\` containing one
JSON file per table plus `_manifest.json`.

### 5. Re-register the scheduled backup tasks
Double-click `scripts\setup-backup-task.bat`.
This registers two daily Windows tasks: **Backup AM (11:30)** and
**Backup PM (16:30)**. Verify in PowerShell:
```powershell
Get-ScheduledTask -TaskName "*SemiProperty*"
```
Both should show state `Ready`.

> The tasks point at the repo's absolute path. If you ever **move the repo
> folder** (even on the same machine), run the .bat again.

### 6. Rebuild the desktop app
```
npm run electron:build
npm run desktop:update
```
The packaged app appears in `build_desktop\Semi-Property Guardian-win32-x64\`.
Always run `desktop:update` after `electron:build` — the build wipes `app-dist`
and `desktop:update` restores it.

### 7. (Optional) Carry over backup history
Copy `Documents\SemiPropertyBackups\` from the old machine if you want to keep
historical snapshots. Skipping this loses nothing current — the first run on
the new machine takes a full fresh snapshot.

## Decommissioning the old machine

- Confirm the new machine's backups run for a day or two first.
- Delete the old scheduled tasks (or just wipe the machine):
  ```powershell
  Unregister-ScheduledTask -TaskName "SemiPropertyGuardian Backup AM" -Confirm:$false
  Unregister-ScheduledTask -TaskName "SemiPropertyGuardian Backup PM" -Confirm:$false
  ```
- Securely remove `.env.local` and `scripts/.env.backup` from the old machine
  if it's leaving your control — or rotate the keys in the Supabase dashboard,
  which instantly invalidates the old copies everywhere.
