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
}) {
  const store = createTaskCurrentStateStore({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    ...(input.initialize ? { initializeLedger: readableLedger(input.tasksLedgerFile) } : {}),
  });
  const contentObjects = createTaskContentObjectStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId });
  let commandQueue = Promise.resolve();

  const publish = async (delta: TaskStateDelta): Promise<void> => {
    if (delta.entities.length > 0) await input.publish?.(delta);
  };

  const persistChanges = async (changes: TaskEntityChange[], options: { activationTaskId?: string; replication?: 'active' | 'held'; emittedAt?: string } = {}): Promise<TaskStateDelta> => {
    if (changes.length === 0) return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    const result = await store.mutate({ replicaId: input.writerId, changes, ...options });
    await publish(result.delta);
    return result.delta;
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

  const executeMutationNow = async (mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): Promise<{ deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    const command = taskCommandForMutation({ mutation, before, after });
    const delta = await persistChanges(command.changes, { activationTaskId: command.activationTaskId, replication: command.replication });
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
    return { deltas, ledger: store.projection().ledger };
  };

  const executeMutation = (mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): Promise<{ deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    const operation = commandQueue.then(() => executeMutationNow(mutation, before, after));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const executeProjectionCommandNow = async (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<{ deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    const changes = taskCommandForProjection({ command, before: store.projection().ledger, after: ledger });
    const delta = await persistChanges(changes, { emittedAt });
    return { deltas: delta.entities.length > 0 ? [delta] : [], ledger: store.projection().ledger };
  };

  const executeProjectionCommand = (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<{ deltas: TaskStateDelta[]; ledger: AnyRecord }> => {
    const operation = commandQueue.then(() => executeProjectionCommandNow(command, ledger, emittedAt));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const transitionExecutionIntent = async (taskId: string, patch: { id?: string; state: 'waiting' | 'queued' | 'running' | 'terminal' | 'failed'; launchMode?: 'run' | 'pipeline'; error?: string }): Promise<TaskStateDelta> => {
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
  };

  return {
    store,
    executeMutation,
    executeMutationNow,
    executeProjectionCommand,
    executeProjectionCommandNow,
    activateTask,
    recordContentContribution,
    transitionExecutionIntent,
    flush: store.flush,
    projection: store.projection,
  };
}

export type ProjectTaskState = ReturnType<typeof createProjectTaskState>;
