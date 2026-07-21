/**
 * WHAT: Validates, hashes, finalizes, and joins epoch-3 structural entities.
 * WHY: Schema admission and entity algebra must be identical on every participant.
 */
import { canonicalJson } from './canonical-json.js';
import { taskCurrentEntityByteLimit, taskCurrentStateVersion, taskEntityTypes, type TaskCurrentEntity, type TaskCurrentRegister, type TaskFieldOperation, type TaskRegisterCandidate } from './model.js';
import { clockCovers, dotKey, joinTaskRegisters } from './register-join.js';
import { sha256 } from './sha256.js';

const operations = new Set<TaskFieldOperation>(['set', 'add', 'remove', 'tombstone']);
const unsafePathSegments = new Set(['__proto__', 'prototype', 'constructor']);
const lifecycleStatuses = new Set(['todo', 'backlog', 'done']);
const lifecycleKeys = new Set(['status', 'changedAt', 'waitingAt', 'closedAt']);
const executionIntentKeys = new Set(['id', 'state', 'changedAt', 'startedAt', 'settledAt', 'error']);
const localCardPaths = new Set(['replicationState', 'persistenceState']);
const narrativeThreadNotePaths = new Set(['message', 'body', 'content', 'contentBytes', 'markdown']);
const encoder = new TextEncoder();

function entityBody(entity: Omit<TaskCurrentEntity, 'stateHash'> | TaskCurrentEntity): Omit<TaskCurrentEntity, 'stateHash'> {
  const { stateHash: _stateHash, ...body } = entity as TaskCurrentEntity;
  return body;
}

function assertAtomicObject(candidate: TaskRegisterCandidate, keys: Set<string>, error: string): void {
  if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object' || Array.isArray(candidate.value)) throw new Error(error);
  const candidateKeys = Object.keys(candidate.value as Record<string, unknown>);
  if (candidateKeys.length !== keys.size || candidateKeys.some((key) => !keys.has(key))) throw new Error(error);
}

function assertCardDomain(path: string, candidate: TaskRegisterCandidate): void {
  // WHAT: Reject derived descendants and node-local publication fields at wire admission.
  // WHY: A participant cannot make local activation metadata causal by bypassing the domain encoder.
  if (path === 'status' || localCardPaths.has(path) || path.startsWith('lifecycle/') || path.startsWith('executionIntent/')) throw new Error('invalid_task_current_card_lane');
  if (path === 'lifecycle') {
    assertAtomicObject(candidate, lifecycleKeys, 'invalid_task_current_lifecycle');
    const lifecycle = candidate.value as Record<string, unknown>;
    if (!lifecycleStatuses.has(String(lifecycle.status ?? '')) || typeof lifecycle.changedAt !== 'string') throw new Error('invalid_task_current_lifecycle');
    if (!Object.hasOwn(lifecycle, 'waitingAt') || !Object.hasOwn(lifecycle, 'closedAt')) throw new Error('invalid_task_current_lifecycle');
  }
  if (path === 'executionIntent') assertAtomicObject(candidate, executionIntentKeys, 'invalid_task_current_execution_intent');
}

function assertRegister(entity: TaskCurrentEntity, path: string, register: TaskCurrentRegister): void {
  if (!register || !register.clock || Array.isArray(register.clock) || !Array.isArray(register.candidates) || register.candidates.length === 0) throw new Error('invalid_task_current_register');
  for (const [replicaId, counter] of Object.entries(register.clock)) {
    if (!replicaId || !Number.isSafeInteger(counter) || counter < 0) throw new Error('invalid_task_current_clock');
  }
  const dots = new Set<string>();
  for (const candidate of register.candidates) {
    if (!candidate.dot?.replicaId || !Number.isSafeInteger(candidate.dot.counter) || candidate.dot.counter < 1) throw new Error('invalid_task_current_dot');
    if (!operations.has(candidate.operation) || !clockCovers(register.clock, candidate.dot)) throw new Error('invalid_task_current_candidate');
    if ((candidate.operation === 'set' || candidate.operation === 'add') !== Object.hasOwn(candidate, 'value')) throw new Error('invalid_task_current_candidate_value');
    if (Object.hasOwn(candidate, 'value')) canonicalJson(candidate.value);
    const key = dotKey(candidate.dot);
    if (dots.has(key)) throw new Error('duplicate_task_current_dot');
    dots.add(key);
    if (entity.entityType === 'card') assertCardDomain(path, candidate);
    if (entity.entityType === 'thread-note' && narrativeThreadNotePaths.has(path)) throw new Error('invalid_task_current_thread_note_narrative_lane');
  }
}

export function hashTaskCurrentEntity(entity: Omit<TaskCurrentEntity, 'stateHash'> | TaskCurrentEntity): string {
  return sha256(canonicalJson(entityBody(entity)));
}

export function assertTaskCurrentEntity(entity: TaskCurrentEntity): void {
  if (entity?.version !== taskCurrentStateVersion || !entity.projectId || !entity.entityId || !taskEntityTypes.includes(entity.entityType)) throw new Error('invalid_task_current_entity');
  if (!entity.fields || typeof entity.fields !== 'object' || Array.isArray(entity.fields) || !/^[a-f0-9]{64}$/.test(entity.stateHash)) throw new Error('invalid_task_current_entity');
  const paths = Object.keys(entity.fields).sort();
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    if (!path || path.startsWith('/') || path.endsWith('/') || path.split('/').some((segment) => !segment || unsafePathSegments.has(segment))) throw new Error('invalid_task_current_path');
    if (paths.some((other, otherIndex) => otherIndex !== index && other.startsWith(`${path}/`))) throw new Error('overlapping_task_current_lanes');
    assertRegister(entity, path, entity.fields[path]);
  }
  if (hashTaskCurrentEntity(entity) !== entity.stateHash) throw new Error('invalid_task_current_entity_hash');
  if (encoder.encode(canonicalJson(entity)).byteLength > taskCurrentEntityByteLimit) throw new Error('task_current_entity_too_large');
}

export function finalizeTaskCurrentEntity(entity: Omit<TaskCurrentEntity, 'stateHash'>): TaskCurrentEntity {
  const finalized: TaskCurrentEntity = { ...structuredClone(entity), stateHash: '' };
  finalized.stateHash = hashTaskCurrentEntity(finalized);
  assertTaskCurrentEntity(finalized);
  return finalized;
}

export function joinTaskEntities(left: TaskCurrentEntity | undefined, right: TaskCurrentEntity): TaskCurrentEntity {
  assertTaskCurrentEntity(right);
  if (!left) return structuredClone(right);
  assertTaskCurrentEntity(left);
  if (left.projectId !== right.projectId || left.entityType !== right.entityType || left.entityId !== right.entityId) throw new Error('task_current_entity_identity_mismatch');
  const fields: Record<string, TaskCurrentRegister> = {};
  for (const path of [...new Set([...Object.keys(left.fields), ...Object.keys(right.fields)])].sort()) {
    const leftField = left.fields[path];
    const rightField = right.fields[path];
    fields[path] = leftField && rightField ? joinTaskRegisters(leftField, rightField) : structuredClone(leftField ?? rightField!);
  }
  return finalizeTaskCurrentEntity({ version: taskCurrentStateVersion, projectId: left.projectId, entityType: left.entityType, entityId: left.entityId, fields });
}
