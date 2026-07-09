// Query cache persistence using localforage (IndexedDB)
import localforage from 'localforage';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

// Configure localforage store
localforage.config({
  name: 'semiproperty-guardian',
  storeName: 'react-query-cache',
  description: 'Persisted React Query cache for offline support',
});

const STORAGE_KEY = 'rq-cache-v1';

export const localforagePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      await localforage.setItem(STORAGE_KEY, client);
    } catch (err) {
      console.warn('Failed to persist query client', err);
    }
  },
  restoreClient: async () => {
    try {
      const cache = await localforage.getItem<PersistedClient>(STORAGE_KEY);
      return cache ?? undefined;
    } catch (err) {
      console.warn('Failed to restore query client', err);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await localforage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to remove persisted query client', err);
    }
  },
};

// Reasonable defaults for offline usage
export const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_GC_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours



