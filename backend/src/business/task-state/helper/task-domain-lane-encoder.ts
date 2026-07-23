/**
 * WHAT: Encodes domain records into canonical epoch-4 CRDT lane values.
 * WHY: Migration, runtime mutations, recovery, and tests must emit identical non-overlapping lane boundaries.
 */
import type { TaskEntityType } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;
const narrativeFields = new Set(['description', 'what', 'message', 'body', 'notes', 'deletedNoteIds', 'content', 'contentBytes', 'markdown']);
const derivedLifecycleFields = new Set(['status', 'lifecycle', 'changedAt', 'waitingAt', 'closedAt', 'completedAt']);
const nodeLocalCardFields = new Set(['replicationState', 'persistenceState']);
const atomicCardFields = new Set(['assignment', 'executionIntent']);

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

function assignment(value: unknown): AnyRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as AnyRecord;
  const nodeId = String(candidate.nodeId ?? '').trim();
  const changedAt = String(candidate.changedAt ?? '').trim();
  const revision = Number(candidate.revision);
  if (!/^[a-zA-Z0-9_-]+$/.test(nodeId) || !Number.isFinite(Date.parse(changedAt)) || !Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('invalid_task_assignment');
  }
  return { nodeId, changedAt: new Date(changedAt).toISOString(), revision };
}

export function encodeTaskDomainLanes(input: { entityType: TaskEntityType; record: AnyRecord; before?: AnyRecord | null; transitionAt: string; relationshipPosition?: number }): Map<string, unknown> {
  const lanes = new Map<string, unknown>();
  for (const [path, raw] of Object.entries(input.record)) {
    if (path === 'id' || narrativeFields.has(path) || raw === undefined) continue;
    // WHAT: Exclude derived, atomic, and node-local card fields from generic structural lanes.
    // WHY: Atomic registers are encoded below while UI publication state must never enter causal hashes.
    if (input.entityType === 'card' && (derivedLifecycleFields.has(path) || nodeLocalCardFields.has(path) || atomicCardFields.has(path))) continue;
    const value = structural(raw);
    if (value !== undefined) lanes.set(path, value);
  }
  if (input.entityType === 'card') {
    if (!lanes.has('createdAt')) lanes.set('createdAt', input.transitionAt);
    lanes.set('lifecycle', lifecycle(input.before ?? null, input.record, input.transitionAt));
    const assigned = assignment(input.record.assignment);
    if (assigned) lanes.set('assignment', assigned);
  }
  if (input.entityType === 'relationship' && input.record.label === 'subtask' && !lanes.has('position')) {
    if (input.relationshipPosition === undefined) throw new Error('missing_subtask_position');
    lanes.set('position', input.relationshipPosition);
  }
  return lanes;
}
