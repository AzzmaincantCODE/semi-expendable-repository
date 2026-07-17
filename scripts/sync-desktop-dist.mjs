// Copies the freshly built `dist/` into the packaged desktop app's external
// `app-dist/` folder (next to the .exe), which electron/main.cjs prefers over
// the embedded dist. Lets code changes appear on exe relaunch WITHOUT repackaging.
// Run via `npm run desktop:update` (vite build happens first in that script).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const exeDir = join(root, 'build_desktop', 'Semi-Property Guardian-win32-x64');
const appDist = join(exeDir, 'app-dist');

if (!existsSync(dist)) {
  console.error('[sync-desktop-dist] dist/ not found — run the vite build first.');
  process.exit(1);
}
if (!existsSync(exeDir)) {
  console.error('[sync-desktop-dist] packaged app not found at', exeDir);
  console.error('[sync-desktop-dist] build it once with: npm run electron:build');
  process.exit(1);
}

rmSync(appDist, { recursive: true, force: true });
cpSync(dist, appDist, { recursive: true });
console.log('[sync-desktop-dist] synced dist/ ->', appDist);
console.log('[sync-desktop-dist] relaunch the app to see the changes.');
