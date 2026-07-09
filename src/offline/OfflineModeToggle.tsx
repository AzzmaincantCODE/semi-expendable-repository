/**
 * OFFLINE EXPERIMENT — OfflineModeToggle.tsx (updated)
 *
 * Sidebar toggle — now delegates sync to the global dataModeContext
 * so the SyncProgressModal shows up as a global overlay.
 */

import React from 'react';
import { Database, Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useDataMode } from './dataModeContext';
import { cn } from '@/lib/utils';

export const OfflineModeToggle: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { isOfflineMode, toggle, pendingCount, syncing, startSync } = useDataMode();

  const handleToggle = async () => {
    if (isOfflineMode && pendingCount > 0) {
      const confirmed = window.confirm(
        `You have ${pendingCount} unsynced local change(s).\n\nClick OK to go Live and sync them now, or Cancel to stay offline.`
      );
      if (!confirmed) return;
      toggle();
      await startSync();
      return;
    }
    toggle();
  };

  if (collapsed) {
    return (
      <div className="p-2 flex flex-col items-center gap-1">
        <button
          onClick={handleToggle}
          title={isOfflineMode ? 'Offline Mode — click to go Live' : 'Live Mode — click for Offline'}
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-md transition-colors',
            isOfflineMode
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          )}
        >
          {isOfflineMode ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[8px] font-bold rounded-full bg-amber-500 text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-3 space-y-2">
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-xs font-medium truncate text-muted-foreground">
            {isOfflineMode ? 'Local Mode' : 'Live Database'}
          </div>
        </div>

        <button
          onClick={handleToggle}
          title={isOfflineMode ? 'Switch to Live Supabase' : 'Switch to Local Offline'}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
            isOfflineMode ? 'bg-amber-400' : 'bg-emerald-500'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
              isOfflineMode ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Status badge */}
      <div
        className={cn(
          'flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md',
          isOfflineMode
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        )}
      >
        {isOfflineMode ? (
          <><WifiOff className="h-3 w-3" /><span>Offline — local data only</span></>
        ) : (
          <><Wifi className="h-3 w-3" /><span>Live — connected</span></>
        )}
      </div>

      {/* Pending changes + Sync button */}
      {pendingCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
            <AlertCircle className="h-3 w-3" />
            <span>{pendingCount} unsynced change{pendingCount !== 1 ? 's' : ''}</span>
          </div>
          {!isOfflineMode && (
            <button
              onClick={startSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium px-2 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
