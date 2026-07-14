/**
 * Offline mutation queue (navigator.onLine based) — LIVE CODE. DO NOT DELETE.
 *
 * This is the app's LIGHTWEIGHT, AUTOMATIC offline write-buffer. When a write
 * is attempted while `navigator.onLine` is false, the service layer serializes
 * the intended mutation here (localforage-backed) instead of failing. When the
 * browser fires the `online` event, the buffered mutations are replayed against
 * Supabase in FIFO order; any that throw are kept for the next `online` event.
 *
 * Producers (call `enqueueOfflineMutation` when offline):
 *   - src/services/propertyCardService.ts
 *       (propertyCards.create/update/delete/addEntry/updateEntry/deleteEntry)
 *   - src/services/simpleInventoryService.ts
 *       (inventory.create/update/delete)
 *
 * Consumer / replay (drains the queue via `processOfflineQueue`):
 *   - src/App.tsx — `handleOnline`, registered on the window `online` event
 *     inside a useEffect. It supplies the handler map that maps each
 *     MutationName back to the real service call.
 *
 * NOT THE SAME as the manual offline-MODE engine in `src/offline/`
 * (dataModeContext, snapshotEngine, syncEngine, localDb). That system is a
 * user-toggled snapshot/sync flow: it pulls a full local snapshot on entering
 * offline mode and reconciles on exit. THIS file is the always-on, per-mutation
 * connectivity fallback keyed off `navigator.onLine` + the `online` event.
 * They are independent; both are intended to coexist.
 *
 * DO NOT DELETE — this is live, wired into the running app via the producers
 * and consumer listed above. If those files move, update the references here
 * rather than removing this queue.
 */
import localforage from 'localforage';

type MutationName =
  | 'propertyCards.create'
  | 'propertyCards.update'
  | 'propertyCards.delete'
  | 'propertyCards.addEntry'
  | 'propertyCards.updateEntry'
  | 'propertyCards.deleteEntry'
  | 'inventory.create'
  | 'inventory.update'
  | 'inventory.delete';

export interface OfflineMutation {
  id: string;
  name: MutationName;
  payload: any;
  createdAt: number;
}

const QUEUE_KEY = 'offline-mutation-queue-v1';

localforage.config({
  name: 'semiproperty-guardian',
  storeName: 'offline-queue',
});

async function readQueue(): Promise<OfflineMutation[]> {
  const items = await localforage.getItem<OfflineMutation[]>(QUEUE_KEY);
  return items || [];
}

async function writeQueue(items: OfflineMutation[]): Promise<void> {
  await localforage.setItem(QUEUE_KEY, items);
}

export async function enqueueOfflineMutation(name: MutationName, payload: any): Promise<OfflineMutation> {
  const item: OfflineMutation = {
    id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    payload,
    createdAt: Date.now(),
  };
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
  return item;
}

export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

export async function getQueue(): Promise<OfflineMutation[]> {
  return readQueue();
}

// Simple processor that takes a handler map to avoid tight coupling
export type QueueHandlerMap = Record<MutationName, (payload: any) => Promise<any>>;

export async function processOfflineQueue(handlers: QueueHandlerMap): Promise<{ processed: number; failed: number; }> {
  if (!navigator.onLine) return { processed: 0, failed: 0 };
  let queue = await readQueue();
  if (!queue.length) return { processed: 0, failed: 0 };

  const remaining: OfflineMutation[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    const handler = handlers[item.name];
    if (!handler) {
      // Unknown mutation; skip it
      remaining.push(item);
      continue;
    }
    try {
      await handler(item.payload);
      processed += 1;
    } catch (err) {
      console.warn('Failed processing offline mutation', item.name, err);
      failed += 1;
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return { processed, failed };
}


