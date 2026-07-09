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


