/**
 * WHAT: Implements the associative, commutative, and idempotent task-state join algebra.
 * WHY: Nodes must converge independently of delivery order, retries, and offline writer counters.
 */
import { canonicalJson, sha256 } from './task-current-state-codec.js';
import { taskCurrentStateVersion, taskEntityTypes, type TaskCausalClock, type TaskCurrentEntity, type TaskCurrentRegister, type TaskDot, type TaskRegisterCandidate } from './task-current-state-types.js';

const fieldOperations = new Set(['set', 'add', 'remove', 'tombstone']);
const unsafePathSegments = new Set(['__proto__', 'prototype', 'constructor']);

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function dotKey(dot: TaskDot): string {
  return `${dot.replicaId}\u0000${String(dot.counter).padStart(16, '0')}`;
}

export function clockCovers(clock: TaskCausalClock, dot: TaskDot): boolean {
  return (clock[dot.replicaId] ?? 0) >= dot.counter;
}

export function joinTaskClocks(left: TaskCausalClock, right: TaskCausalClock): TaskCausalClock {
  const result = { ...left };
  for (const [replicaId, counter] of Object.entries(right)) result[replicaId] = Math.max(result[replicaId] ?? 0, counter);
  return result;
}

function candidateMap(register: TaskCurrentRegister): Map<string, TaskRegisterCandidate> {
  return new Map(register.candidates.map((candidate) => [dotKey(candidate.dot), candidate]));
}

export function joinTaskRegisters(left: TaskCurrentRegister, right: TaskCurrentRegister): TaskCurrentRegister {
  const leftCandidates = candidateMap(left);
  const rightCandidates = candidateMap(right);
  const joined = new Map<string, TaskRegisterCandidate>();
  for (const [key, candidate] of leftCandidates) {
    if (rightCandidates.has(key) || !clockCovers(right.clock, candidate.dot)) joined.set(key, clone(candidate));
  }
  for (const [key, candidate] of rightCandidates) {
    if (leftCandidates.has(key) || !clockCovers(left.clock, candidate.dot)) joined.set(key, clone(candidate));
  }

  return {
    clock: joinTaskClocks(left.clock, right.clock),
    candidates: [...joined.values()].sort((a, b) => dotKey(a.dot).localeCompare(dotKey(b.dot))),
  };
}

function entityBody(entity: Omit<TaskCurrentEntity, 'stateHash'> | TaskCurrentEntity): Omit<TaskCurrentEntity, 'stateHash'> {
  const { stateHash: _stateHash, ...body } = entity as TaskCurrentEntity;
  return body;
}

export function hashTaskCurrentEntity(entity: Omit<TaskCurrentEntity, 'stateHash'> | TaskCurrentEntity): string {
  return sha256(canonicalJson(entityBody(entity)));
}

export function finalizeTaskCurrentEntity(entity: Omit<TaskCurrentEntity, 'stateHash'>): TaskCurrentEntity {
  const value: TaskCurrentEntity = { ...entity, stateHash: '' };
  value.stateHash = hashTaskCurrentEntity(value);
  return value;
}

export function joinTaskEntities(left: TaskCurrentEntity | undefined, right: TaskCurrentEntity): TaskCurrentEntity {
  if (!left) return finalizeTaskCurrentEntity(entityBody(clone(right)));
  if (left.projectId !== right.projectId || left.entityType !== right.entityType || left.entityId !== right.entityId) throw new Error('task_current_entity_identity_mismatch');
  const fields: Record<string, TaskCurrentRegister> = {};
  for (const path of [...new Set([...Object.keys(left.fields), ...Object.keys(right.fields)])].sort()) {
    const leftField = left.fields[path];
    const rightField = right.fields[path];
    fields[path] = leftField && rightField ? joinTaskRegisters(leftField, rightField) : clone(leftField ?? rightField!);
  }
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: left.projectId,
    entityType: left.entityType,
    entityId: left.entityId,
    fields,
    replication: left.replication === 'active' || right.replication === 'active' ? 'active' : 'held',
    ...(left.activationTaskId || right.activationTaskId ? { activationTaskId: left.activationTaskId || right.activationTaskId } : {}),
  });
}

export function assertTaskCurrentEntity(entity: TaskCurrentEntity): void {
  if (entity?.version !== taskCurrentStateVersion || !entity.projectId || !entity.entityId || !taskEntityTypes.includes(entity.entityType)) throw new Error('invalid_task_current_entity');
  if (entity.replication !== 'active' && entity.replication !== 'held') throw new Error('invalid_task_current_replication');
  if (!entity.fields || typeof entity.fields !== 'object' || Array.isArray(entity.fields) || !/^[a-f0-9]{64}$/.test(entity.stateHash)) throw new Error('invalid_task_current_entity');
  for (const [path, register] of Object.entries(entity.fields)) {
    if (!path || path.split('/').some((segment) => unsafePathSegments.has(segment))) throw new Error('invalid_task_current_path');
    if (!register || !register.clock || !Array.isArray(register.candidates)) throw new Error('invalid_task_current_register');
    for (const [replicaId, counter] of Object.entries(register.clock)) {
      if (!replicaId || !Number.isSafeInteger(counter) || counter < 0) throw new Error('invalid_task_current_clock');
    }
    for (const candidate of register.candidates) {
      if (!candidate.dot?.replicaId || !Number.isSafeInteger(candidate.dot.counter) || candidate.dot.counter < 1) throw new Error('invalid_task_current_dot');
      if (!fieldOperations.has(candidate.operation) || !clockCovers(register.clock, candidate.dot)) throw new Error('invalid_task_current_candidate');
    }
  }
  if (hashTaskCurrentEntity(entity) !== entity.stateHash) throw new Error('invalid_task_current_entity_hash');
}
