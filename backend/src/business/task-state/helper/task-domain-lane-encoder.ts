/**
 * WHAT: Encodes domain records into canonical epoch-3 CRDT lane values.
 * WHY: Migration, runtime mutations, recovery, and tests must emit identical non-overlapping lane boundaries.
 */
import type { TaskEntityType } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;
const narrativeFields = new Set(['description', 'what', 'message', 'body', 'notes', 'deletedNoteIds', 'content', 'contentBytes', 'markdown']);
const derivedLifecycleFields = new Set(['status', 'lifecycle', 'changedAt', 'waitingAt', 'closedAt', 'completedAt']);
const nodeLocalCardFields = new Set(['replicationState', 'persistenceState']);

function structural(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((child) => structural(child) ?? null);
  if (!value || typeof value !== 'object') return value;
  const result: AnyRecord = {};
  for (const [key, child] of Object.entries(value as AnyRecord)) {
    if (narrativeFields.has(key) || child === undefined) continue;
    result[key] = structural(child);
  }
  return result;
}

function executionIntent(value: unknown): AnyRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const intent = value as AnyRecord;
  if (typeof intent.executionId === 'string' && intent.executionId) return {
    executionId: intent.executionId,
    phase: intent.phase ?? null,
    requestedAt: intent.requestedAt ?? null,
    phaseSince: intent.phaseSince ?? null,
    executorNodeId: intent.executorNodeId ?? null,
    changedAt: intent.changedAt ?? intent.phaseSince ?? null,
    settledAt: intent.settledAt ?? null,
    error: intent.error ?? null,
    revision: intent.revision ?? null,
  };
  return { id: intent.id ?? null, state: intent.state ?? null, changedAt: intent.changedAt ?? intent.updatedAt ?? null, startedAt: intent.startedAt ?? null, settledAt: intent.settledAt ?? null, error: intent.error ?? null };
}

function lifecycle(before: AnyRecord | null, after: AnyRecord, transitionAt: string): AnyRecord {
  const previous = before?.lifecycle && typeof before.lifecycle === 'object' && !Array.isArray(before.lifecycle) ? before.lifecycle as AnyRecord : {};
  const next = after.lifecycle && typeof after.lifecycle === 'object' && !Array.isArray(after.lifecycle) ? after.lifecycle as AnyRecord : {};
  const previousStatus = String(previous.status ?? before?.status ?? '');
  const status = String(after.status ?? next.status ?? 'backlog');
  if (!['todo', 'backlog', 'done'].includes(status)) throw new Error(`invalid_card_lifecycle_status:${status}`);
  if (before && previousStatus === status) {
    return { status, changedAt: next.changedAt ?? previous.changedAt ?? transitionAt, waitingAt: next.waitingAt ?? previous.waitingAt ?? null, closedAt: next.closedAt ?? previous.closedAt ?? null };
  }
  const changedAt = String(next.changedAt ?? after.changedAt ?? transitionAt);
  if (status === 'todo') return { status, changedAt, waitingAt: String(next.waitingAt ?? after.waitingAt ?? changedAt), closedAt: null };
  if (status === 'done') return { status, changedAt, waitingAt: null, closedAt: String(next.closedAt ?? after.closedAt ?? after.completedAt ?? changedAt) };
  return { status, changedAt, waitingAt: null, closedAt: null };
}

export function encodeTaskDomainLanes(input: { entityType: TaskEntityType; record: AnyRecord; before?: AnyRecord | null; transitionAt: string; relationshipPosition?: number }): Map<string, unknown> {
  const lanes = new Map<string, unknown>();
  for (const [path, raw] of Object.entries(input.record)) {
    if (path === 'id' || narrativeFields.has(path) || raw === undefined) continue;
    // WHAT: Exclude derived, atomic, and node-local card fields from generic structural lanes.
    // WHY: Atomic registers are encoded below while UI publication state must never enter causal hashes.
    if (input.entityType === 'card' && (derivedLifecycleFields.has(path) || nodeLocalCardFields.has(path) || path === 'executionIntent')) continue;
    const value = structural(raw);
    if (value !== undefined) lanes.set(path, value);
  }
  if (input.entityType === 'card') {
    if (!lanes.has('createdAt')) lanes.set('createdAt', input.transitionAt);
    lanes.set('lifecycle', lifecycle(input.before ?? null, input.record, input.transitionAt));
    const intent = executionIntent(input.record.executionIntent);
    if (intent) lanes.set('executionIntent', intent);
  }
  if (input.entityType === 'relationship' && input.record.label === 'subtask' && !lanes.has('position')) {
    if (input.relationshipPosition === undefined) throw new Error('missing_subtask_position');
    lanes.set('position', input.relationshipPosition);
  }
  return lanes;
}
