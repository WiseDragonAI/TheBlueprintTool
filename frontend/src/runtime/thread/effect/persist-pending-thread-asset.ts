/**
 * WHAT: Persists captured thread images and files before upload or optimistic rendering.
 * WHY: Reload, relay failure, and backend restart must not discard the only local asset bytes.
 */

const databaseName = 'decision-os-thread-assets';
const databaseVersion = 1;
const storeName = 'pending-assets';
const scopeIndex = 'project-ledger-thread';
const memoryStore = new Map<string, PendingThreadAsset>();

export type PendingThreadAsset = {
  assetId: string;
  mutationId: string;
  noteId: string;
  projectId: string;
  replicaNodeId: string;
  ledgerId: string;
  threadId: string;
  cardId: string;
  kind: 'image' | 'file';
  blob: Blob;
  mimeType: string;
  fileName: string;
  createdAt: string;
  phase: 'captured' | 'uploaded';
  assetRef: string;
  previewRef: string;
  markdown: string;
};

function cloneEntry(entry: PendingThreadAsset): PendingThreadAsset {
  return { ...entry };
}

function indexedDbFactory(): IDBFactory | null {
  return typeof globalThis.indexedDB === 'object' && globalThis.indexedDB ? globalThis.indexedDB : null;
}

function assertDurableStorage(factory: IDBFactory | null): asserts factory is IDBFactory {
  if (factory) return;
  if (typeof globalThis.window === 'object') throw new Error('thread_asset_storage_unavailable');
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(storeName)
        ? request.transaction!.objectStore(storeName)
        : request.result.createObjectStore(storeName, { keyPath: 'assetId' });
      if (!store.indexNames.contains(scopeIndex)) {
        store.createIndex(scopeIndex, ['projectId', 'ledgerId', 'threadId']);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the thread asset store.'));
    request.onblocked = () => reject(new Error('Thread asset storage upgrade is blocked.'));
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const factory = indexedDbFactory();
  assertDurableStorage(factory);
  if (!factory) throw new Error('thread_asset_storage_unavailable');
  const database = await openDatabase(factory);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error('Thread asset storage request failed.'));
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Thread asset storage transaction aborted.'));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
  });
}

export async function persistPendingThreadAsset(entry: PendingThreadAsset): Promise<void> {
  const copy = cloneEntry(entry);
  const factory = indexedDbFactory();
  assertDurableStorage(factory);
  if (!factory) {
    memoryStore.set(copy.assetId, copy);
    return;
  }
  await runRequest('readwrite', (store) => store.put(copy));
}

export async function readPendingThreadAsset(assetId: string): Promise<PendingThreadAsset | null> {
  const factory = indexedDbFactory();
  assertDurableStorage(factory);
  if (!factory) return memoryStore.has(assetId) ? cloneEntry(memoryStore.get(assetId)!) : null;
  const result = await runRequest<PendingThreadAsset | undefined>('readonly', (store) => store.get(assetId));
  return result ? cloneEntry(result) : null;
}

export async function listPendingThreadAssets(input: {
  projectId: string;
  replicaNodeId: string;
  ledgerId: string;
  threadId: string;
}): Promise<PendingThreadAsset[]> {
  const ownsReplica = (entry: PendingThreadAsset): boolean => (
    !entry.replicaNodeId || entry.replicaNodeId === input.replicaNodeId
  );
  const factory = indexedDbFactory();
  assertDurableStorage(factory);
  if (!factory) {
    return [...memoryStore.values()]
      .filter((entry) => entry.projectId === input.projectId
        && entry.ledgerId === input.ledgerId
        && entry.threadId === input.threadId
        && ownsReplica(entry))
      .map(cloneEntry);
  }
  const entries = await runRequest<PendingThreadAsset[]>(
    'readonly',
    (store) => store.index(scopeIndex).getAll([input.projectId, input.ledgerId, input.threadId]),
  );
  return entries.filter(ownsReplica).map(cloneEntry);
}

export async function deletePendingThreadAsset(assetId: string): Promise<void> {
  const factory = indexedDbFactory();
  assertDurableStorage(factory);
  if (!factory) {
    memoryStore.delete(assetId);
    return;
  }
  await runRequest('readwrite', (store) => store.delete(assetId));
}

export function clearPendingThreadAssetMemoryForTest(): void {
  memoryStore.clear();
}
