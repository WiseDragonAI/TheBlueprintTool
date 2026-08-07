/**
 * WHAT: Persists optimistic task intents and their exact backend receipts in browser-local storage.
 * WHY: Reloads and relay snapshots must not erase a locally accepted message, asset note, voice attempt, or run intent.
 */
import type { PendingTaskMutationReceipt } from './task-projection-acceptance.js';

export type PersistedTaskMutationReceipt = PendingTaskMutationReceipt & {
  projectId: string;
  ledgerId: string;
  domain: 'message' | 'image' | 'voice' | 'queued-execution' | 'pipeline' | 'content-head';
  createdAt: string;
  taskClock: Record<string, number> | null;
  mutation: Record<string, any>;
};

const storageKey = 'decision-os:pending-task-mutation-receipts:v1';
const memory = new Map<string, PersistedTaskMutationReceipt>();
let storageBlocked = false;
let storageFailure = '';
let loaded = false;

function browserRuntime(): boolean {
  return typeof globalThis.window === 'object';
}

function storage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'object' && globalThis.localStorage ? globalThis.localStorage : null;
  } catch (error) {
    storageFailure = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function validClock(value: unknown): value is Record<string, number> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.entries(value).every(([replicaId, counter]) => (
      Boolean(replicaId) && Number.isSafeInteger(Number(counter)) && Number(counter) >= 0
    ));
}

function validReceipt(value: unknown): value is PersistedTaskMutationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  return typeof receipt.receiptId === 'string'
    && Boolean(receipt.receiptId)
    && typeof receipt.entityId === 'string'
    && Boolean(receipt.entityId)
    && typeof receipt.projectId === 'string'
    && typeof receipt.ledgerId === 'string'
    && typeof receipt.domain === 'string'
    && ['message', 'image', 'voice', 'queued-execution', 'pipeline', 'content-head'].includes(receipt.domain)
    && Number.isSafeInteger(Number(receipt.localRevision))
    && typeof receipt.acknowledged === 'boolean'
    && (receipt.taskClock === null || validClock(receipt.taskClock))
    && Boolean(receipt.mutation)
    && typeof receipt.mutation === 'object'
    && !Array.isArray(receipt.mutation);
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const target = storage();
  if (!target) {
    if (browserRuntime()) {
      storageBlocked = true;
      storageFailure ||= 'task_mutation_receipt_storage_unavailable';
    }
    return;
  }
  let raw: string | null = null;
  try {
    raw = target.getItem(storageKey);
  } catch (error) {
    storageBlocked = true;
    storageFailure = error instanceof Error ? error.message : String(error);
    return;
  }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validReceipt)) {
      storageBlocked = true;
      storageFailure = 'task_mutation_receipt_storage_invalid';
      return;
    }
    for (const receipt of parsed) memory.set(receipt.receiptId, structuredClone(receipt));
  } catch (error) {
    // WHAT: Preserve invalid durable browser state byte-identically.
    // WHY: A corrupt receipt ledger must not be normalized into an empty list and overwritten.
    storageBlocked = true;
    storageFailure = error instanceof Error ? error.message : 'task_mutation_receipt_storage_invalid';
  }
}

function assertWritable(): void {
  if (storageBlocked) throw new Error(`task_mutation_receipt_storage_blocked:${storageFailure || 'invalid_state'}`);
}

function persist(): void {
  assertWritable();
  const target = storage();
  if (!target) {
    if (browserRuntime()) throw new Error('task_mutation_receipt_storage_unavailable');
    return;
  }
  target.setItem(storageKey, JSON.stringify([...memory.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))));
}

function dominates(incoming: Record<string, number>, floor: Record<string, number>): boolean {
  return Object.entries(floor).every(([replicaId, counter]) => Number(incoming[replicaId] ?? 0) >= counter);
}

export function beginPendingTaskMutationReceipt(input: {
  mutationId: string;
  entityId: string;
  projectId: string;
  ledgerId: string;
  domain: PersistedTaskMutationReceipt['domain'];
  mutation: Record<string, any>;
  intent?: string;
}): PersistedTaskMutationReceipt {
  load();
  assertWritable();
  const existing = memory.get(input.mutationId);
  if (existing) {
    if (existing.entityId !== input.entityId
      || existing.projectId !== input.projectId
      || existing.ledgerId !== input.ledgerId
      || existing.domain !== input.domain) {
      throw new Error(`task_mutation_receipt_identity_conflict:${input.mutationId}`);
    }
    return structuredClone(existing);
  }
  const receipt: PersistedTaskMutationReceipt = {
    receiptId: input.mutationId,
    entityId: input.entityId,
    projectId: input.projectId,
    ledgerId: input.ledgerId,
    domain: input.domain,
    localRevision: Date.now(),
    acknowledged: false,
    intent: input.intent,
    createdAt: new Date().toISOString(),
    taskClock: null,
    mutation: structuredClone(input.mutation),
  };
  const previous = memory.get(receipt.receiptId);
  memory.set(receipt.receiptId, receipt);
  try {
    persist();
  } catch (error) {
    if (previous) memory.set(receipt.receiptId, previous);
    else memory.delete(receipt.receiptId);
    throw error;
  }
  return structuredClone(receipt);
}

export function replacePendingTaskMutationReceipt(
  mutationId: string,
  mutation: Record<string, any>,
): PersistedTaskMutationReceipt {
  load();
  assertWritable();
  const current = memory.get(mutationId);
  if (!current) throw new Error(`task_mutation_receipt_missing:${mutationId}`);
  const next = { ...current, mutation: structuredClone(mutation) };
  memory.set(mutationId, next);
  try {
    persist();
  } catch (error) {
    memory.set(mutationId, current);
    throw error;
  }
  return structuredClone(next);
}

export function acknowledgePendingTaskMutationReceipt(
  mutationId: string,
  taskClock: Record<string, number> | null,
): PersistedTaskMutationReceipt | null {
  load();
  assertWritable();
  const current = memory.get(mutationId);
  if (!current) return null;
  const next = { ...current, acknowledged: true, taskClock: taskClock ? { ...taskClock } : null };
  memory.set(mutationId, next);
  try {
    persist();
  } catch (error) {
    memory.set(mutationId, current);
    throw error;
  }
  return structuredClone(next);
}

export function completePendingTaskMutationReceipt(receiptId: string): void {
  load();
  assertWritable();
  const current = memory.get(receiptId);
  if (!current) return;
  memory.delete(receiptId);
  try {
    persist();
  } catch (error) {
    memory.set(receiptId, current);
    throw error;
  }
}

export function pendingTaskMutationReceipt(
  projectId: string,
  ledgerId: string,
  domain: PersistedTaskMutationReceipt['domain'],
  entityId: string,
): PersistedTaskMutationReceipt | null {
  load();
  assertWritable();
  const receipt = [...memory.values()]
    .filter((candidate) => candidate.projectId === projectId
      && candidate.ledgerId === ledgerId
      && candidate.domain === domain
      && candidate.entityId === entityId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return receipt ? structuredClone(receipt) : null;
}

export function pendingTaskMutationReceiptsForScope(input: {
  projectId: string;
  ledgerId: string;
  threadId?: string;
}): PersistedTaskMutationReceipt[] {
  load();
  assertWritable();
  const prefix = input.threadId ? `${input.threadId}/` : '';
  return [...memory.values()]
    .filter((receipt) => receipt.projectId === input.projectId
      && receipt.ledgerId === input.ledgerId
      && (!prefix || receipt.entityId.startsWith(prefix)))
    .map((receipt) => structuredClone(receipt));
}

export function settlePendingTaskMutationReceipts(input: {
  projectId: string;
  ledgerId: string;
  taskClock: Record<string, number>;
}): PersistedTaskMutationReceipt[] {
  load();
  assertWritable();
  const settled: PersistedTaskMutationReceipt[] = [];
  for (const receipt of memory.values()) {
    if (receipt.projectId !== input.projectId
      || receipt.ledgerId !== input.ledgerId
      || !receipt.acknowledged
      || !receipt.taskClock
      || !dominates(input.taskClock, receipt.taskClock)) continue;
    settled.push(structuredClone(receipt));
    memory.delete(receipt.receiptId);
  }
  if (settled.length > 0) {
    try {
      persist();
    } catch (error) {
      for (const receipt of settled) memory.set(receipt.receiptId, receipt);
      throw error;
    }
  }
  return settled;
}

export function releaseSettledOptimisticNotes(
  ledger: Record<string, any> | null | undefined,
  receipts: PersistedTaskMutationReceipt[],
): void {
  if (!ledger?.notes || typeof ledger.notes !== 'object' || Array.isArray(ledger.notes)) return;
  for (const receipt of receipts) {
    const note = receipt.mutation.note;
    const threadId = String(note?.threadId ?? '');
    const noteId = String(note?.id ?? '');
    const notes = threadId && Array.isArray(ledger.notes[threadId]) ? ledger.notes[threadId] : [];
    const local = notes.find((candidate: Record<string, unknown>) => String(candidate.id ?? '') === noteId);
    if (local) local.optimistic = false;
  }
}

export function clearPendingTaskMutationReceiptsForTest(): void {
  memory.clear();
  loaded = false;
  storageBlocked = false;
  storageFailure = '';
}
