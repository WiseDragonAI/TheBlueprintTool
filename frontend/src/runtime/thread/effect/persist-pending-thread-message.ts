/**
 * WHAT: Persists unsynchronized text-message intents before they become visible.
 * WHY: A rejected request, navigation, reload, or process failure must not erase operator-authored text.
 */
export type PendingThreadMessage = {
  version: 1;
  projectId: string;
  replicaNodeId: string;
  ledgerId: string;
  threadId: string;
  noteId: string;
  body: string;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string;
  lastStatus: number;
  lastErrorCode: string;
  lastErrorMessage: string;
};

const storageKey = 'decision-os:pending-thread-messages:v1';
const pending = new Map<string, PendingThreadMessage>();
let loaded = false;
let storageBlocked = false;
let storageFailure = '';

function receiptId(message: Pick<PendingThreadMessage, 'projectId' | 'replicaNodeId' | 'ledgerId' | 'threadId' | 'noteId'>): string {
  return JSON.stringify([message.projectId, message.replicaNodeId, message.ledgerId, message.threadId, message.noteId]);
}

function browserStorage(): Storage | null {
  try {
    const browser = typeof globalThis.window === 'object' ? globalThis.window : null;
    return browser && typeof browser.localStorage === 'object' && browser.localStorage
      ? browser.localStorage
      : null;
  } catch (error) {
    storageBlocked = true;
    storageFailure = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function validPendingMessage(value: unknown): value is PendingThreadMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return message.version === 1
    && ['projectId', 'replicaNodeId', 'ledgerId', 'threadId', 'noteId', 'body', 'createdAt', 'lastAttemptAt', 'lastErrorCode', 'lastErrorMessage']
      .every((key) => typeof message[key] === 'string')
    && Boolean(message.ledgerId)
    && Boolean(message.threadId)
    && Boolean(message.noteId)
    && Boolean(String(message.body).trim())
    && Number.isSafeInteger(Number(message.attemptCount))
    && Number(message.attemptCount) >= 0
    && Number.isSafeInteger(Number(message.lastStatus))
    && Number(message.lastStatus) >= 0;
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const storage = browserStorage();
  if (!storage) return;
  let raw: string | null = null;
  try {
    raw = storage.getItem(storageKey);
  } catch (error) {
    storageBlocked = true;
    storageFailure = error instanceof Error ? error.message : String(error);
    return;
  }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validPendingMessage)) {
      storageBlocked = true;
      storageFailure = 'pending_thread_message_storage_invalid';
      return;
    }
    for (const message of parsed) pending.set(receiptId(message), structuredClone(message));
  } catch (error) {
    // WHAT: Preserve invalid local durable state byte-identically.
    // WHY: Treating corrupt pending messages as empty would erase the only surviving operator intent.
    storageBlocked = true;
    storageFailure = error instanceof Error ? error.message : 'pending_thread_message_storage_invalid';
  }
}

function assertWritable(): void {
  if (storageBlocked) throw new Error(`pending_thread_message_storage_blocked:${storageFailure || 'invalid_state'}`);
}

function persist(): void {
  assertWritable();
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(storageKey, JSON.stringify([...pending.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))));
}

function replace(message: PendingThreadMessage): PendingThreadMessage {
  load();
  assertWritable();
  const id = receiptId(message);
  const previous = pending.get(id);
  pending.set(id, structuredClone(message));
  try {
    persist();
  } catch (error) {
    if (previous) pending.set(id, previous);
    else pending.delete(id);
    throw error;
  }
  return structuredClone(message);
}

export function persistPendingThreadMessage(input: {
  projectId: string;
  replicaNodeId?: string;
  ledgerId: string;
  threadId: string;
  noteId: string;
  body: string;
  createdAt?: string;
}): PendingThreadMessage {
  load();
  assertWritable();
  if (!input.ledgerId || !input.threadId || !input.noteId || !input.body.trim()) {
    throw new Error('pending_thread_message_identity_invalid');
  }
  const message: PendingThreadMessage = {
    version: 1,
    projectId: input.projectId,
    replicaNodeId: input.replicaNodeId ?? '',
    ledgerId: input.ledgerId,
    threadId: input.threadId,
    noteId: input.noteId,
    body: input.body,
    createdAt: input.createdAt ?? new Date().toISOString(),
    attemptCount: 0,
    lastAttemptAt: '',
    lastStatus: 0,
    lastErrorCode: '',
    lastErrorMessage: '',
  };
  const id = receiptId(message);
  const existing = pending.get(id);
  if (existing) {
    if (existing.body !== message.body) throw new Error(`pending_thread_message_identity_conflict:${input.noteId}`);
    return structuredClone(existing);
  }
  return replace(message);
}

export function recordPendingThreadMessageAttempt(message: PendingThreadMessage): PendingThreadMessage {
  return replace({
    ...message,
    attemptCount: message.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
  });
}

export function recordPendingThreadMessageFailure(
  message: PendingThreadMessage,
  failure: { status: number; errorCode: string; errorMessage: string },
): PendingThreadMessage {
  return replace({
    ...message,
    lastStatus: failure.status,
    lastErrorCode: failure.errorCode,
    lastErrorMessage: failure.errorMessage,
  });
}

export function deletePendingThreadMessage(message: PendingThreadMessage): void {
  load();
  assertWritable();
  const id = receiptId(message);
  const previous = pending.get(id);
  if (!previous) return;
  pending.delete(id);
  try {
    persist();
  } catch (error) {
    pending.set(id, previous);
    throw error;
  }
}

export function pendingThreadMessages(input: {
  projectId: string;
  replicaNodeId?: string;
  ledgerId: string;
  threadId: string;
}): PendingThreadMessage[] {
  load();
  assertWritable();
  return [...pending.values()]
    .filter((message) => message.projectId === input.projectId
      && message.replicaNodeId === (input.replicaNodeId ?? '')
      && message.ledgerId === input.ledgerId
      && message.threadId === input.threadId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((message) => structuredClone(message));
}

export function pendingThreadMessage(input: {
  projectId: string;
  replicaNodeId?: string;
  ledgerId: string;
  threadId: string;
  noteId: string;
}): PendingThreadMessage | null {
  load();
  assertWritable();
  const message = pending.get(receiptId({
    ...input,
    replicaNodeId: input.replicaNodeId ?? '',
  }));
  return message ? structuredClone(message) : null;
}

export function resetPendingThreadMessageStoreForTest(): void {
  pending.clear();
  loaded = false;
  storageBlocked = false;
  storageFailure = '';
}
