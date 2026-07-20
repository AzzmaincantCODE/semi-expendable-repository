// Best-effort DevTools deterrent for production builds (web + packaged desktop).
// Blocks the casual routes: right-click > Inspect, F12, Ctrl+Shift+I/J/C, Ctrl+U.
// NOTE: this is a deterrent, NOT a security boundary — a browser user can always
// open DevTools from the browser menu or read the served JS directly. Real
// protection is the Supabase RLS policies (database/fix-custodian-slips-rls.sql).
export function initDevtoolsDeterrent() {
  if (import.meta.env.DEV) return; // keep dev workflow untouched

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();
    if (
      key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (key === 'I' || key === 'J' || key === 'C')) ||
      (e.ctrlKey && key === 'U') // view-source
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}
