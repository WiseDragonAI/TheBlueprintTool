/**
 * WHAT: Serializes one project's local task commands into durable causal current-state mutations.
 * WHY: Optimistic callers need immediate scoped state while persistence and replication avoid workspace rewrites.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { createTaskCurrentStateStore } from './task-current-state-store.js';
import { taskCurrentStateVersion, type TaskEntityChange, type TaskStateDelta } from './task-current-state-types.js';
import { createTaskContentObjectStore } from './task-content-object-store.js';
import { taskContentReferences } from './task-content-resources.js';
import { taskCommandForMutation, taskCommandForProjection, type TaskProjectionCommand } from './task-mutation-command.js';

type AnyRecord = Record<string, unknown>;

function readableLedger(file: string): AnyRecord {
  if (!existsSync(file)) return { cards: [], annotations: [], relationships: [] };
  return JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
}

function mergeDeltas(projectId: string, deltas: TaskStateDelta[]): TaskStateDelta {
  const entities = new Map<string, TaskStateDelta['entities'][number]>();
  for (const delta of deltas) for (const entity of delta.entities) entities.set(`${entity.entityType}\u0000${entity.entityId}`, entity);
  return { version: taskCurrentStateVersion, projectId, entities: [...entities.values()] };
}

export function createProjectTaskState(input: {
  projectId: string;
  writerId: string;
  decisionOsRoot: string;
  tasksLedgerFile: string;
  publish?: (delta: TaskStateDelta) => void | Promise<void>;
  publishContent?: (resourceId: string) => void | Promise<void>;
  initialize?: boolean;
  canWrite?: () => boolean;
}) {
  const store = createTaskCurrentStateStore({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    ...(input.initialize ? { initializeLedger: readableLedger(input.tasksLedgerFile) } : {}),
  });
  const contentObjects = createTaskContentObjectStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId });
  let commandQueue = Promise.resolve();
  const assertWritable = (): void => {
    if (input.canWrite && !input.canWrite()) throw new Error('task_state_bootstrap_incomplete');
  };

  const publish = async (delta: TaskStateDelta): Promise<void> => {
    if (delta.entities.length > 0) await input.publish?.(delta);
  };

  const persistChanges = async (changes: TaskEntityChange[], options: { activationTaskId?: string; replication?: 'active' | 'held'; emittedAt?: string } = {}): Promise<TaskStateDelta> => {
    if (changes.length === 0) return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    const result = await store.mutate({ replicaId: input.writerId, changes, ...options });
    await publish(result.delta);
    return result.delta;
  };

  const entityHash = (change: TaskEntityChange): string => {
    // WHAT: Read the state hash for exactly the lanes owned by one command change.
    // WHY: Held local entities change authority state without appearing in a replication delta.
    if (change.entityType !== 'ledger') return store.entity(change.entityType, change.entityId)?.stateHash ?? '';
    return change.changes.map((field) => store.entity('ledger', `${change.entityId}:${field.path}`)?.stateHash ?? '').join('\u0000');
  };

  const lifecycleConflict = (taskId: string): boolean => store.projection().conflicts.some((conflict) => (
    conflict.kind === 'task-conflict' && conflict.entityType === 'card' && conflict.entityId === taskId && conflict.path === 'lifecycle'
  ));

  const assertLifecycleConflictFree = (taskIds: string[]): void => {
    const conflicted = [...new Set(taskIds)].filter(lifecycleConflict).sort();
    if (conflicted.length > 0) throw new Error(`task_lifecycle_conflict:${conflicted.join(',')}`);
  };

  const activateTask = async (taskId: string): Promise<TaskStateDelta> => {
    if (!taskId) return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    const card = Array.isArray(store.projection().ledger.cards)
      ? (store.projection().ledger.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId)
      : null;
    if (!card || card.replicationState !== 'local-only') return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    const released = await store.activate(taskId);
    const activation = await persistChanges([{ entityType: 'card', entityId: taskId, changes: [{ path: 'replicationState', operation: 'set', value: 'activated' }] }], { activationTaskId: taskId });
    const delta = mergeDeltas(input.projectId, [released, activation]);
    await publish(released);
    return delta;
  };

  const recordContentContribution = async (taskId: string, resourceIds: string | string[]): Promise<TaskStateDelta> => {
    const resources = [...new Set((Array.isArray(resourceIds) ? resourceIds : [resourceIds]).filter(Boolean))];
    const heads = (await Promise.all(resources.map((resourceId) => contentObjects.capture(resourceId)))).filter((head) => head !== null);
    const contentDelta = heads.length > 0
      ? await persistChanges(heads.map((head) => ({ entityType: 'resource', entityId: head.key, changes: [{ path: 'head', operation: 'set', value: head }] })), { activationTaskId: taskId })
      : { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    for (const head of heads) await input.publishContent?.(head.key);
    return mergeDeltas(input.projectId, [contentDelta, await activateTask(taskId)]);
  };

  const executeMutationNow = async (mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): Promise<{ changed: boolean; deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    if (mutation.action === 'complete-master-task' && mutation.masterTaskId) {
      const masterTaskId = String(mutation.masterTaskId);
      const subtaskIds = Array.isArray(before.relationships) ? (before.relationships as AnyRecord[])
        .filter((relationship) => String(relationship.from ?? '') === masterTaskId && relationship.label === 'subtask')
        .map((relationship) => String(relationship.to ?? '')) : [];
      assertLifecycleConflictFree([masterTaskId, ...subtaskIds]);
    }
    if (mutation.action === 'create-execution-intent' && mutation.cardId) assertLifecycleConflictFree([String(mutation.cardId)]);
    const command = taskCommandForMutation({ mutation, before, after });
    const priorHashes = command.changes.map(entityHash);
    const delta = await persistChanges(command.changes, { activationTaskId: command.activationTaskId, replication: command.replication });
    const changed = command.changes.some((change, index) => entityHash(change) !== priorHashes[index]);
    const deltas = delta.entities.length > 0 ? [delta] : [];
    if (['append-note', 'update-note', 'delete-note', 'delete-card-image'].includes(command.kind)) {
      const body = String(mutation.note?.body ?? '');
      const card = Array.isArray(after.cards) ? (after.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === String(mutation.cardId ?? '')) : null;
      const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
      const resourceIds = command.kind === 'delete-card-image'
        ? [String(comment.contentFile ?? '')]
        : [String(mutation.note?.voiceFileRef ?? ''), ...taskContentReferences(body)];
      deltas.push(await recordContentContribution(command.activationTaskId, resourceIds));
    }
    return { changed, deltas, ledger: store.projection().ledger };
  };

  const executeMutation = (mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): Promise<{ changed: boolean; deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    assertWritable();
    const operation = commandQueue.then(() => executeMutationNow(mutation, before, after));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const transitionCardLifecycle = (taskId: string, status: 'todo' | 'backlog' | 'done'): Promise<{ changed: boolean; deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    assertWritable();
    // WHAT: Serialize one lifecycle transition against the latest authoritative projection.
    // WHY: CLI callers do not carry a trusted whole-ledger before/after document.
    const operation = commandQueue.then(async () => {
      const before = structuredClone(store.projection().ledger);
      const after = structuredClone(before);
      const card = Array.isArray(after.cards)
        ? (after.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId)
        : null;
      if (!card) throw new Error(`task_card_not_found:${taskId}`);
      card.status = status;
      return executeMutationNow({ action: 'transition-card-lifecycle', cardId: taskId, lifecycleStatus: status }, before, after);
    });
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const executeProjectionCommandNow = async (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<{ changed: boolean; deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    const changes = taskCommandForProjection({ command, before: store.projection().ledger, after: ledger });
    const priorHashes = changes.map(entityHash);
    const delta = await persistChanges(changes, { emittedAt });
    return { changed: changes.some((change, index) => entityHash(change) !== priorHashes[index]), deltas: delta.entities.length > 0 ? [delta] : [], ledger: store.projection().ledger };
  };

  const executeProjectionCommand = (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<{ changed: boolean; deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    assertWritable();
    const operation = commandQueue.then(() => executeProjectionCommandNow(command, ledger, emittedAt));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const transitionExecutionIntent = (taskId: string, patch: { id?: string; state: 'waiting' | 'queued' | 'running' | 'terminal' | 'failed'; launchMode?: 'run' | 'pipeline'; error?: string }): Promise<TaskStateDelta> => {
    assertWritable();
    const operation = commandQueue.then(async () => {
      assertLifecycleConflictFree([taskId]);
      const card = Array.isArray(store.projection().ledger.cards)
        ? (store.projection().ledger.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId)
        : null;
      if (!card) return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
      const current = card.executionIntent && typeof card.executionIntent === 'object' ? card.executionIntent as AnyRecord : {};
      if (patch.id && current.id && String(current.id) !== patch.id && ['waiting', 'queued', 'running'].includes(String(current.state ?? ''))) return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
      const changedAt = new Date().toISOString();
      const state = patch.state;
      return persistChanges([{ entityType: 'card', entityId: taskId, changes: [{ path: 'executionIntent', operation: 'set', value: {
        id: patch.id ?? current.id ?? null,
        state,
        changedAt,
        startedAt: state === 'running' ? current.startedAt ?? changedAt : current.startedAt ?? null,
        settledAt: state === 'terminal' || state === 'failed' ? changedAt : null,
        error: patch.error ?? null,
      } }] }]);
    });
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  return {
    store,
    executeMutation,
    executeMutationNow,
    transitionCardLifecycle,
    executeProjectionCommand,
    executeProjectionCommandNow,
    activateTask: (taskId: string) => { assertWritable(); return activateTask(taskId); },
    recordContentContribution: (taskId: string, resourceIds: string | string[]) => { assertWritable(); return recordContentContribution(taskId, resourceIds); },
    transitionExecutionIntent,
    flush: store.flush,
    projection: store.projection,
  };
}

export type ProjectTaskState = ReturnType<typeof createProjectTaskState>;
