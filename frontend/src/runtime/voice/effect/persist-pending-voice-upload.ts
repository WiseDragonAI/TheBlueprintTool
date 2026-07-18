/**
 * WHAT: Persists captured voice audio in browser-local durable storage before network upload.
 * WHY: A pre-acceptance network failure must not discard the only copy of a completed recording.
 */

const databaseName = 'decision-os-voice';
const databaseVersion = 1;
const storeName = 'pending-uploads';
const threadScopeIndex = 'ledger-thread';
const memoryStore = new Map<string, PendingVoiceUpload>();

export type PendingVoiceUpload = {
  noteId: string;
  projectId?: string;
  threadId: string;
  ledgerId: string;
  cardId: string;
  launchMode?: 'send' | 'run' | 'pipeline';
  queueCodex?: boolean;
  audio: Blob;
  createdAt: string;
};

function cloneEntry(entry: PendingVoiceUpload): PendingVoiceUpload {
  return { ...entry };
}

function indexedDbFactory(): IDBFactory | null {
  return typeof globalThis.indexedDB === 'object' && globalThis.indexedDB ? globalThis.indexedDB : null;
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(storeName)
        ? request.transaction!.objectStore(storeName)
        : request.result.createObjectStore(storeName, { keyPath: 'noteId' });
      if (!store.indexNames.contains(threadScopeIndex)) store.createIndex(threadScopeIndex, ['ledgerId', 'threadId']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the voice upload store.'));
    request.onblocked = () => reject(new Error('Voice upload storage upgrade is blocked.'));
  });
}

async function runRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const factory = indexedDbFactory();
  if (!factory) throw new Error('IndexedDB is unavailable.');
  const database = await openDatabase(factory);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error('Voice upload storage request failed.'));
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Voice upload storage transaction aborted.'));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
  });
}

export async function persistPendingVoiceUpload(entry: PendingVoiceUpload): Promise<void> {
  const copy = cloneEntry(entry);
  if (!indexedDbFactory()) {
    memoryStore.set(copy.noteId, copy);
    return;
  }
  await runRequest('readwrite', (store) => store.put(copy));
}

export async function readPendingVoiceUpload(noteId: string): Promise<PendingVoiceUpload | null> {
  if (!indexedDbFactory()) return memoryStore.has(noteId) ? cloneEntry(memoryStore.get(noteId)!) : null;
  const result = await runRequest<PendingVoiceUpload | undefined>('readonly', (store) => store.get(noteId));
  return result ? cloneEntry(result) : null;
}

export async function listPendingVoiceUploads(input: { projectId?: string; ledgerId: string; threadId: string }): Promise<PendingVoiceUpload[]> {
  const ownsProject = (entry: PendingVoiceUpload): boolean => !entry.projectId || entry.projectId === String(input.projectId ?? '');
  if (!indexedDbFactory()) {
    return Array.from(memoryStore.values(), cloneEntry).filter((entry) => entry.ledgerId === input.ledgerId && entry.threadId === input.threadId && ownsProject(entry));
  }
  const entries = await runRequest<PendingVoiceUpload[]>('readonly', (store) => store.index(threadScopeIndex).getAll([input.ledgerId, input.threadId]));
  return entries.filter(ownsProject);
}

export async function deletePendingVoiceUpload(noteId: string): Promise<void> {
  if (!indexedDbFactory()) {
    memoryStore.delete(noteId);
    return;
  }
  await runRequest('readwrite', (store) => store.delete(noteId));
}

export function clearPendingVoiceUploadMemoryForTest(): void {
  memoryStore.clear();
}
