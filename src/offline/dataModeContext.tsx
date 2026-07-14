/**
 * OFFLINE EXPERIMENT — dataModeContext.tsx (v3 — with full snapshot)
 *
 * Manages offline/live toggle. When switching to offline mode:
 *   1. Runs full Supabase snapshot (all tables → localDb)
 *   2. Shows SnapshotProgressScreen
 *   3. Only switches to offline after snapshot completes
 *
 * When switching back to live:
 *   1. Opens SyncProgressModal
 *   2. Pushes pending local changes to Supabase
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getPendingCount } from './localDb';
import { SyncProgressEvent, syncLocalToSupabase } from './syncEngine';
import { SnapshotStep, takeFullSnapshot } from './snapshotEngine';
import { SyncProgressModal } from './SyncProgressModal';
import { SnapshotProgressScreen } from './SnapshotProgressScreen';

const STORAGE_KEY = 'offline-mode-enabled-v1';

interface DataModeContextValue {
  isOfflineMode: boolean;
  toggle: () => void;
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
  syncing: boolean;
  setSyncing: (v: boolean) => void;
  showSyncModal: () => void;
  startSync: () => Promise<void>;
  /** True while snapshot download is running */
  snapshotting: boolean;
}

const DataModeContext = createContext<DataModeContextValue>({
  isOfflineMode: false,
  toggle: () => {},
  pendingCount: 0,
  refreshPendingCount: async () => {},
  syncing: false,
  setSyncing: () => {},
  showSyncModal: () => {},
  startSync: async () => {},
  snapshotting: false,
});

export const DataModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Sync modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [syncEvents, setSyncEvents] = useState<SyncProgressEvent[]>([]);

  // Snapshot state
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotSteps, setSnapshotSteps] = useState<SnapshotStep[]>([]);
  const [snapshotDone, setSnapshotDone] = useState(false);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const pendingGoOffline = useRef(false);

  // Holds the latest `startSync` so `toggle` can invoke it without capturing a
  // stale closure (toggle is memoized before startSync is defined). Kept in sync
  // by the effect below.
  const startSyncRef = useRef<() => Promise<void>>(async () => {});

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [isOfflineMode, refreshPendingCount]);

  const persistMode = (next: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  };

  // ── Toggle ──────────────────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (!isOfflineMode) {
      // Going OFFLINE → run snapshot first
      pendingGoOffline.current = true;
      setSnapshotting(true);
      setSnapshotDone(false);
      setSnapshotFailed(false);
      setSnapshotSteps([]);

      takeFullSnapshot((steps) => {
        setSnapshotSteps([...steps]);
        const allDone = steps.every((s) => s.status === 'done' || s.status === 'error');
        const anyFailed = steps.some((s) => s.status === 'error');
        if (allDone) {
          setSnapshotDone(true);
          setSnapshotFailed(anyFailed);
        }
      })
        .then((ok) => {
          // Guarantee the overlay reaches a terminal (escapable) state even if the
          // progress callback never marked every step done.
          setSnapshotDone(true);
          if (!ok) setSnapshotFailed(true);
        })
        .catch(() => {
          // Snapshot threw — surface a failure state so the screen isn't a dead-end.
          setSnapshotDone(true);
          setSnapshotFailed(true);
        });
    } else {
      // Going LIVE — prompt sync if there are pending changes
      if (pendingCount > 0) {
        const confirmed = window.confirm(
          `You have ${pendingCount} unsynced local change(s).\n\nClick OK to go Live and sync them now, or Cancel to stay offline.`
        );
        if (!confirmed) return;
        setIsOfflineMode(false);
        persistMode(false);
        void startSyncRef.current();
        return;
      }
      setIsOfflineMode(false);
      persistMode(false);
    }
  }, [isOfflineMode, pendingCount]);

  // User clicks "Start Working Offline" on a successful snapshot screen
  const handleSnapshotComplete = useCallback(() => {
    setSnapshotting(false);
    if (pendingGoOffline.current) {
      pendingGoOffline.current = false;
      setIsOfflineMode(true);
      persistMode(true);
    }
  }, []);

  // User dismisses a FAILED snapshot — abort going offline and stay live, rather
  // than entering a half-populated (unreliable) offline state.
  const handleSnapshotAbort = useCallback(() => {
    pendingGoOffline.current = false;
    setSnapshotting(false);
    setSnapshotSteps([]);
    setSnapshotDone(false);
    setSnapshotFailed(false);
  }, []);

  // ── Sync ────────────────────────────────────────────────────────────────────
  const showSyncModal = useCallback(() => { setModalVisible(true); }, []);

  const startSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setModalVisible(true);
    setSyncEvents([]);

    try {
      await syncLocalToSupabase((event) => {
        setSyncEvents((prev) => [...prev, event]);
      });
      await refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshPendingCount]);

  // Keep the ref pointed at the latest startSync (see startSyncRef above).
  useEffect(() => {
    startSyncRef.current = startSync;
  }, [startSync]);

  return (
    <DataModeContext.Provider
      value={{
        isOfflineMode,
        toggle,
        pendingCount,
        refreshPendingCount,
        syncing,
        setSyncing,
        showSyncModal,
        startSync,
        snapshotting,
      }}
    >
      {children}

      {/* Full-screen snapshot progress */}
      <SnapshotProgressScreen
        isVisible={snapshotting}
        steps={snapshotSteps}
        isDone={snapshotDone}
        hasFailed={snapshotFailed && snapshotDone}
        onCancel={
          snapshotDone
            ? (snapshotFailed ? handleSnapshotAbort : handleSnapshotComplete)
            : undefined
        }
      />

      {/* Floating sync progress panel */}
      <SyncProgressModal
        isVisible={modalVisible && !snapshotting}
        events={syncEvents}
        isSyncing={syncing}
        pendingCount={pendingCount}
        onClose={() => setModalVisible(false)}
        onSyncNow={startSync}
      />
    </DataModeContext.Provider>
  );
};

export const useDataMode = () => useContext(DataModeContext);
