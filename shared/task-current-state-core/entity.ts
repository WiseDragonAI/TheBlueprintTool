/**
 * WHAT: Validates, hashes, finalizes, and joins epoch-4 task and execution entities.
 * WHY: Schema admission and entity algebra must be identical on every participant.
 */
import { canonicalJson } from './canonical-json.js';
import {
  taskCurrentEntityByteLimit,
  taskCurrentStateVersion,
  taskEntityTypes,
  taskExecutionKinds,
  taskExecutionPhases,
  type TaskCurrentEntity,
  type TaskCurrentRegister,
  type TaskExecutionArtifactHead,
  type TaskExecutionLifecycle,
  type TaskFieldOperation,
  type TaskRegisterCandidate,
} from './model.js';
import { clockCovers, dotKey, joinTaskRegisters } from './register-join.js';
import { sha256 } from './sha256.js';

const operations = new Set<TaskFieldOperation>(['set', 'add', 'remove', 'tombstone']);
const unsafePathSegments = new Set(['__proto__', 'prototype', 'constructor']);
const lifecycleStatuses = new Set(['todo', 'backlog', 'done']);
const lifecycleKeys = new Set(['status', 'changedAt', 'waitingAt', 'closedAt']);
const assignmentKeys = new Set(['nodeId', 'changedAt', 'revision']);
const executionMetadataKeys = new Set([
  'executionId', 'requestId', 'sessionId', 'projectId', 'ledgerId', 'taskId', 'sourceCardId', 'ownerCardId', 'kind',
  'requestedAt', 'model', 'effort', 'pipelineRunId', 'pipelineStepId', 'pipelineSkillRunId', 'predecessorExecutionId',
  'restartOfExecutionId',
]);
const executionLifecycleKeys = new Set(['phase', 'phaseSince', 'startedAt', 'finishedAt', 'executorNodeId', 'providerSessionId', 'result', 'error', 'revision']);
const executionArtifactKeys = new Set(['jsonl', 'stderr', 'telemetry', 'result', 'changedAt', 'revision']);
const executionResultKeys = new Set(['status', 'summary']);
const executionErrorKeys = new Set(['code', 'message']);
const executionArtifactHeadKeys = new Set(['hash', 'bytes', 'mediaType']);
const executionKinds = new Set<string>(taskExecutionKinds);
const executionPhases = new Set<string>(taskExecutionPhases);
const terminalExecutionPhases = new Set<string>(['succeeded', 'failed', 'cancelled', 'interrupted']);
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

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNullableText(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function assertExactObject(value: unknown, keys: Set<string>, error: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  const actual = Object.keys(value);
  if (actual.length !== keys.size || actual.some((key) => !keys.has(key))) throw new Error(error);
}

function assertAssignment(candidate: TaskRegisterCandidate): void {
  assertAtomicObject(candidate, assignmentKeys, 'invalid_task_current_assignment');
  const assignment = candidate.value as Record<string, unknown>;
  if (typeof assignment.nodeId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(assignment.nodeId)
    || !isIsoTimestamp(assignment.changedAt)
    || !Number.isSafeInteger(assignment.revision) || Number(assignment.revision) < 1) throw new Error('invalid_task_current_assignment');
}

function assertExecutionMetadata(entity: TaskCurrentEntity, candidate: TaskRegisterCandidate): void {
  assertAtomicObject(candidate, executionMetadataKeys, 'invalid_task_current_execution_metadata');
  const metadata = candidate.value as Record<string, unknown>;
  const requiredText = ['executionId', 'requestId', 'sessionId', 'projectId', 'ledgerId', 'sourceCardId', 'ownerCardId'];
  if (requiredText.some((key) => typeof metadata[key] !== 'string' || !String(metadata[key]).trim())
    || metadata.executionId !== entity.entityId
    || metadata.projectId !== entity.projectId
    || typeof metadata.taskId !== 'string'
    || !executionKinds.has(String(metadata.kind ?? ''))
    || !isIsoTimestamp(metadata.requestedAt)
    || ['model', 'effort', 'pipelineRunId', 'pipelineStepId', 'pipelineSkillRunId', 'predecessorExecutionId', 'restartOfExecutionId'].some((key) => !isNullableText(metadata[key]))) {
    throw new Error('invalid_task_current_execution_metadata');
  }
  const pipelineValues = [metadata.pipelineRunId, metadata.pipelineStepId, metadata.pipelineSkillRunId];
  if (metadata.kind === 'pipeline-skill' && pipelineValues.some((value) => typeof value !== 'string' || !value)) throw new Error('invalid_task_current_execution_metadata');
  if (metadata.kind !== 'pipeline-skill' && pipelineValues.some((value) => value !== null)) throw new Error('invalid_task_current_execution_metadata');
}

function assertExecutionError(value: unknown): void {
  if (value === null) return;
  assertExactObject(value, executionErrorKeys, 'invalid_task_current_execution_lifecycle');
  if (typeof value.code !== 'string' || !value.code || typeof value.message !== 'string') throw new Error('invalid_task_current_execution_lifecycle');
}

function assertExecutionResult(value: unknown): void {
  if (value === null) return;
  assertExactObject(value, executionResultKeys, 'invalid_task_current_execution_lifecycle');
  if (!terminalExecutionPhases.has(String(value.status ?? '')) || typeof value.summary !== 'string') throw new Error('invalid_task_current_execution_lifecycle');
}

function assertExecutionLifecycle(candidate: TaskRegisterCandidate): void {
  assertAtomicObject(candidate, executionLifecycleKeys, 'invalid_task_current_execution_lifecycle');
  const lifecycle = candidate.value as unknown as TaskExecutionLifecycle;
  if (!executionPhases.has(String(lifecycle.phase ?? ''))
    || !isIsoTimestamp(lifecycle.phaseSince)
    || !isNullableText(lifecycle.startedAt)
    || !isNullableText(lifecycle.finishedAt)
    || typeof lifecycle.executorNodeId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(lifecycle.executorNodeId)
    || !isNullableText(lifecycle.providerSessionId)
    || !Number.isSafeInteger(lifecycle.revision) || lifecycle.revision < 1) throw new Error('invalid_task_current_execution_lifecycle');
  if (lifecycle.startedAt !== null && !isIsoTimestamp(lifecycle.startedAt)) throw new Error('invalid_task_current_execution_lifecycle');
  if (lifecycle.finishedAt !== null && !isIsoTimestamp(lifecycle.finishedAt)) throw new Error('invalid_task_current_execution_lifecycle');
  assertExecutionResult(lifecycle.result);
  assertExecutionError(lifecycle.error);
  const terminal = terminalExecutionPhases.has(lifecycle.phase);
  if (terminal !== (lifecycle.finishedAt !== null) || terminal !== (lifecycle.result !== null)) throw new Error('invalid_task_current_execution_lifecycle');
  if (!terminal && lifecycle.error !== null) throw new Error('invalid_task_current_execution_lifecycle');
  if (lifecycle.phase === 'failed' && lifecycle.error === null) throw new Error('invalid_task_current_execution_lifecycle');
  if (lifecycle.phase !== 'failed' && lifecycle.error !== null) throw new Error('invalid_task_current_execution_lifecycle');
  if (lifecycle.result && lifecycle.result.status !== lifecycle.phase) throw new Error('invalid_task_current_execution_lifecycle');
  if (['running', 'cancelling'].includes(lifecycle.phase) && lifecycle.startedAt === null) throw new Error('invalid_task_current_execution_lifecycle');
}

function assertArtifactHead(value: unknown): void {
  if (value === null) return;
  assertExactObject(value, executionArtifactHeadKeys, 'invalid_task_current_execution_artifacts');
  const head = value as unknown as TaskExecutionArtifactHead;
  if (!/^[a-f0-9]{64}$/.test(String(head.hash ?? ''))
    || !Number.isSafeInteger(head.bytes) || head.bytes < 0
    || typeof head.mediaType !== 'string' || !head.mediaType) throw new Error('invalid_task_current_execution_artifacts');
}

function assertExecutionArtifacts(candidate: TaskRegisterCandidate): void {
  assertAtomicObject(candidate, executionArtifactKeys, 'invalid_task_current_execution_artifacts');
  const artifacts = candidate.value as Record<string, unknown>;
  for (const key of ['jsonl', 'stderr', 'telemetry', 'result']) assertArtifactHead(artifacts[key]);
  if (!isIsoTimestamp(artifacts.changedAt)
    || !Number.isSafeInteger(artifacts.revision) || Number(artifacts.revision) < 1) throw new Error('invalid_task_current_execution_artifacts');
}

function assertCardDomain(path: string, candidate: TaskRegisterCandidate): void {
  // WHAT: Reject derived descendants and node-local publication fields at wire admission.
  // WHY: A participant cannot make local activation metadata causal by bypassing the domain encoder.
  if (path === 'status' || path === 'executionIntent' || localCardPaths.has(path)
    || path.startsWith('lifecycle/') || path.startsWith('assignment/') || path.startsWith('executionIntent/')) throw new Error('invalid_task_current_card_lane');
  if (path === 'lifecycle') {
    assertAtomicObject(candidate, lifecycleKeys, 'invalid_task_current_lifecycle');
    const lifecycle = candidate.value as Record<string, unknown>;
    if (!lifecycleStatuses.has(String(lifecycle.status ?? '')) || typeof lifecycle.changedAt !== 'string') throw new Error('invalid_task_current_lifecycle');
    if (!Object.hasOwn(lifecycle, 'waitingAt') || !Object.hasOwn(lifecycle, 'closedAt')) throw new Error('invalid_task_current_lifecycle');
  }
  if (path === 'assignment') assertAssignment(candidate);
}

function assertExecutionDomain(entity: TaskCurrentEntity, path: string, candidate: TaskRegisterCandidate): void {
  if (path === '$entity') return;
  if (path === 'metadata') assertExecutionMetadata(entity, candidate);
  else if (path === 'lifecycle') assertExecutionLifecycle(candidate);
  else if (path === 'artifacts') assertExecutionArtifacts(candidate);
  else throw new Error('invalid_task_current_execution_lane');
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
    if (entity.entityType === 'execution') assertExecutionDomain(entity, path, candidate);
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
    try {
      fields[path] = leftField && rightField ? joinTaskRegisters(leftField, rightField) : structuredClone(leftField ?? rightField!);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('task_current_dot_collision:')) {
        throw new Error(`task_current_dot_collision:${left.entityType}:${encodeURIComponent(left.entityId)}:${encodeURIComponent(path)}:${message.slice('task_current_dot_collision:'.length)}`, { cause: error });
      }
      throw error;
    }
  }
  return finalizeTaskCurrentEntity({ version: taskCurrentStateVersion, projectId: left.projectId, entityType: left.entityType, entityId: left.entityId, fields });
}
