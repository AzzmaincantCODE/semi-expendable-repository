# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commit policy — IMPORTANT

**Make small commits every time something works.** As soon as a change builds (vite build passes) and is verified, commit it before starting the next thing.

- One logical change = one commit (a bug fix, a feature, an SQL script, a UI tweak)
- Stage ONLY the files belonging to that change — leave unrelated WIP untouched
- Never batch multiple features into one commit
- This repo has a history of merge corruption; fine-grained commits make working states easy to identify and roll back to

## Project overview

**Semi-Property Guardian** — Electron-wrapped Vite/React app for COA semi-expendable property inventory (GSO Apayao). Supabase backend (untyped client at `src/lib/supabase.ts` — no generated types, no migrations folder). UI: shadcn + Tailwind, TanStack Query, react-hook-form.

## Commands

- `npm run electron:dev` — live-reload dev (Vite @ localhost:8080 + Electron window)
- `npm run build` — vite build (verify compilation)
- `npm run desktop:update` — vite build + sync to `build_desktop/.../app-dist` so the packaged `.exe` picks up changes on relaunch (NO repackaging needed)
- `npm run electron:build` — full repackage; only needed when `electron/main.cjs` or electron config changes (it wipes `app-dist` — re-run `desktop:update` after)

## Key architecture notes

- **Property numbers**: auto-generated at PO Stock-In (`purchaseOrderService.stockInItems` → `propertyNumberService.generateBulkPropertyNumbers`), format `SPLV|SPHV-YYYY-MM-NNNN`, yearly sequence. Legacy POs can supply manual numbers via the Stock-In dialog's "Legacy PO" toggle.
- **Inventory rows are one-per-unit** (quantity exploded on stock-in).
- **No DB unique constraint** on `inventory_items.property_number` — uniqueness is app-side only.
- **Two offline systems coexist**: `src/offline/` (snapshot/sync engine + data mode toggle) and `src/lib/offlineQueue.ts` (live per-mutation buffer replayed by App.tsx's `online` handler). Both are in use — do NOT delete either.
- **Offline mode is read-only** for Purchase Orders, Property Cards Annex, and Custodian Slips Annex (buttons disabled + amber badge).
- **Schema setup SQL** lives in `database/*.sql` and `supabase/setup_returns.sql` — run manually in the Supabase SQL Editor (there is no migration tooling). If a table 404s, its setup script probably hasn't been run.

## Cautions

- Avoid parallel writes to the working tree (merge-corruption history — see `fix-merge.ps1`)
- Pre-existing uncommitted WIP may sit in the tree (`scratch/`, `tmp/`, `package.json`, `electron/main.cjs`) — leave it alone unless asked
