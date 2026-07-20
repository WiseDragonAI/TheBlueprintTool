/**
 * WHAT: Owns one project's task command authority, projection, shared outbox, and bounded maintenance.
 * WHY: Request paths need one local durability contract while replication and archival remain background work.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { createDurableReplicationOutbox } from '../../federation/helper/durable-replication-outbox.js';
import { createTaskFieldEvent } from './task-event-codec.js';
import type { TaskFieldEvent } from './task-event-types.js';
import { createTaskEventStore } from './task-event-store.js';
import { taskEventsForLegacyProjectionSeed } from './task-ledger-events.js';
import { taskCommandForMutation, taskCommandForProjection, type TaskCommandEvent, type TaskProjectionCommand } from './task-mutation-command.js';
import { createTaskStateArchiver } from './task-state-git-archive.js';
import { canonicalTaskContentResource, taskContentReferences } from './task-content-resources.js';

type AnyRecord = Record<string, unknown>;

export function createProjectTaskState(input: {
  projectId: string;
  writerId: string;
  decisionOsRoot: string;
  tasksLedgerFile: string;
  publish?: (event: TaskFieldEvent) => void | Promise<void>;
  publishContent?: (resourceId: string) => void | Promise<void>;
  repositoryRoot?: string;
  archiveRemote?: string;
}) {
  const store = createTaskEventStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId, compatibilityLedgerFile: input.tasksLedgerFile });
  const outbox = createDurableReplicationOutbox({ decisionOsRoot: input.decisionOsRoot });
  const archiver = input.repositoryRoot ? createTaskStateArchiver({ repositoryRoot: input.repositoryRoot, writerId: input.writerId, projectId: input.projectId, remote: input.archiveRemote }) : null;
  const archivedFiles = new Set<string>();
  const pendingArchiveFiles = new Set<string>();
  let outboxDrain: Promise<void> | null = null;
  let commandQueue = Promise.resolve();

  const archiveNewArtifacts = (): void => {
    if (!archiver) return;
    const files = [...store.segmentFiles(), ...store.snapshotFiles()]
      .filter((file) => !archivedFiles.has(file) && !pendingArchiveFiles.has(file));
    if (files.length === 0) return;
    for (const file of files) pendingArchiveFiles.add(file);
    void archiver.enqueue(files).then(() => {
      for (const file of files) archivedFiles.add(file);
    }).catch(() => undefined).finally(() => {
      for (const file of files) pendingArchiveFiles.delete(file);
    });
  };

  if (store.events().length === 0 && store.snapshots().length === 0 && existsSync(input.tasksLedgerFile)) {
    const ledger = JSON.parse(readFileSync(input.tasksLedgerFile, 'utf8')) as AnyRecord;
    const seed = taskEventsForLegacyProjectionSeed({ projectId: input.projectId, writerId: input.writerId, emittedAt: new Date().toISOString(), before: null, after: ledger })
      .map((event, index) => createTaskFieldEvent({ ...event, revision: index + 1 }));
    store.appendBatch(seed);
  }

  const drainOutbox = (): Promise<void> => {
    if (outboxDrain) return outboxDrain;
    outboxDrain = (async () => {
      for (const entry of outbox.due('task-state')) {
        try {
          const event = entry.payload as TaskFieldEvent;
          store.append(event);
          if (!input.publish) break;
          await input.publish(event);
          outbox.complete([entry.id]);
        } catch { outbox.fail(entry.id); }
      }
      for (const entry of outbox.due('content')) {
        try {
          if (!input.publishContent) break;
          await input.publishContent(entry.resourceId);
          outbox.complete([entry.id]);
        } catch { outbox.fail(entry.id); }
      }
    })().finally(() => { outboxDrain = null; });
    return outboxDrain;
  };

  const scheduleOutbox = (): void => { queueMicrotask(() => { void drainOutbox(); }); };

  const materialize = (eventInputs: TaskCommandEvent[], emittedAt: string): TaskFieldEvent[] => {
    const revision = store.nextRevision();
    return eventInputs.map((event) => createTaskFieldEvent({
      eventId: randomUUID(),
      projectId: input.projectId,
      writerId: input.writerId,
      emittedAt,
      revision,
      ...event,
    }));
  };

  const persistEvents = (eventInputs: TaskCommandEvent[], options: { activationTaskId: string; replication: 'held' | 'pending'; emittedAt?: string }): TaskFieldEvent[] => {
    if (eventInputs.length === 0) return [];
    const events = materialize(eventInputs, options.emittedAt ?? new Date().toISOString());
    // The outbox is the recovery journal: on restart, draining replays a missing event before publication.
    outbox.enqueue(events.map((event) => ({
      id: `task:${event.eventId}`,
      lane: 'task-state' as const,
      resourceId: `${event.entityType}:${event.entityId}`,
      activationTaskId: options.activationTaskId,
      state: options.replication,
      payload: event,
    })));
    store.appendBatch(events);
    if (options.replication === 'pending') scheduleOutbox();
    return events;
  };

  const activateTask = (taskId: string): TaskFieldEvent[] => {
    if (!taskId) return [];
    const card = Array.isArray(store.projection().ledger.cards)
      ? (store.projection().ledger.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId)
      : null;
    if (!card || card.replicationState !== 'local-only') return [];
    outbox.releaseTask(taskId);
    const events = persistEvents([{ entityType: 'card', entityId: taskId, changes: [{ path: 'replicationState', operation: 'set', value: 'activated' }] }], {
      activationTaskId: taskId,
      replication: 'pending',
    });
    scheduleOutbox();
    return events;
  };

  const enqueueContent = (taskId: string, resourceIds: string[], state: 'held' | 'pending'): void => {
    const resources = [...new Set(resourceIds.map((value) => canonicalTaskContentResource(input.decisionOsRoot, value)).filter(Boolean))];
    outbox.enqueue(resources.map((resourceId) => ({
      id: `content:${taskId}:${resourceId}`,
      lane: 'content' as const,
      resourceId,
      activationTaskId: taskId,
      state,
      payload: { resourceId },
    })));
  };

  const recordContentContribution = (taskId: string, resourceIds: string | string[]): TaskFieldEvent[] => {
    enqueueContent(taskId, Array.isArray(resourceIds) ? resourceIds : [resourceIds], 'pending');
    const events = activateTask(taskId);
    scheduleOutbox();
    return events;
  };

  const transitionExecutionIntent = (taskId: string, patch: { id?: string; state: 'waiting' | 'queued' | 'running' | 'terminal' | 'failed'; launchMode?: 'run' | 'pipeline'; error?: string }): TaskFieldEvent[] => {
    const card = Array.isArray(store.projection().ledger.cards)
      ? (store.projection().ledger.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId)
      : null;
    if (!card) return [];
    const current = card.executionIntent && typeof card.executionIntent === 'object' ? card.executionIntent as AnyRecord : {};
    if (patch.id && current.id && String(current.id) !== patch.id && ['waiting', 'queued', 'running'].includes(String(current.state ?? ''))) return [];
    return persistEvents([{ entityType: 'card', entityId: taskId, changes: [{
      path: 'executionIntent',
      operation: 'set',
      value: { ...current, ...patch, id: patch.id || current.id || randomUUID(), updatedAt: new Date().toISOString() },
    }] }], { activationTaskId: taskId, replication: 'pending' });
  };

  const executeMutationNow = (mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): { events: TaskFieldEvent[]; ledger: AnyRecord } => {
    const command = taskCommandForMutation({ mutation, before, after });
    const events = persistEvents(command.events, { activationTaskId: command.activationTaskId, replication: command.replication });
    if (command.replication === 'held' && command.activationTaskId) {
      const createdCard = Array.isArray(after.cards)
        ? (after.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === command.activationTaskId)
        : null;
      const comment = createdCard?.comment && typeof createdCard.comment === 'object' ? createdCard.comment as AnyRecord : {};
      enqueueContent(command.activationTaskId, [String(comment.contentFile ?? '')], 'held');
    }
    const contentAction = ['append-note', 'update-note', 'delete-note', 'delete-card-image'].includes(command.kind)
      || (command.kind === 'patch-card' && typeof mutation.cardPatch?.description === 'string');
    if (contentAction) {
      const threadId = String(mutation.note?.threadId ?? '');
      const threadFiles = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
      const card = command.activationTaskId && Array.isArray(after.cards)
        ? (after.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === command.activationTaskId)
        : null;
      const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
      const resourceId = threadId ? String(threadFiles[threadId] ?? '') : String(comment.contentFile ?? '');
      const body = String(mutation.note?.body ?? '');
      const referencedResources = taskContentReferences(body);
      events.push(...recordContentContribution(command.activationTaskId, [resourceId, ...referencedResources]));
    }
    return { events, ledger: store.projection().ledger };
  };

  const executeMutation = (mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): Promise<{ events: TaskFieldEvent[]; ledger: AnyRecord }> => {
    let resolveCommand: (value: { events: TaskFieldEvent[]; ledger: AnyRecord }) => void = () => undefined;
    let rejectCommand: (error: unknown) => void = () => undefined;
    const result = new Promise<{ events: TaskFieldEvent[]; ledger: AnyRecord }>((resolve, reject) => { resolveCommand = resolve; rejectCommand = reject; });
    commandQueue = commandQueue.then(() => { resolveCommand(executeMutationNow(mutation, before, after)); }).catch(rejectCommand);
    return result;
  };

  const executeProjectionCommandNow = (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): { events: TaskFieldEvent[]; ledger: AnyRecord } => {
    const before = store.projection().ledger;
    const commandEvents = taskCommandForProjection({ command, before, after: ledger });
    const events = persistEvents(commandEvents, { activationTaskId: '', replication: 'pending', emittedAt });
    return { events, ledger: store.projection().ledger };
  };

  const executeProjectionCommand = (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<{ events: TaskFieldEvent[]; ledger: AnyRecord }> => {
    let resolveCommit: (value: { events: TaskFieldEvent[]; ledger: AnyRecord }) => void = () => undefined;
    let rejectCommit: (error: unknown) => void = () => undefined;
    const result = new Promise<{ events: TaskFieldEvent[]; ledger: AnyRecord }>((resolve, reject) => { resolveCommit = resolve; rejectCommit = reject; });
    commandQueue = commandQueue.then(() => { resolveCommit(executeProjectionCommandNow(command, ledger, emittedAt)); }).catch(rejectCommit);
    return result;
  };

  const maintain = (): void => {
    store.maintain();
    archiveNewArtifacts();
    void drainOutbox();
  };

  scheduleOutbox();
  return { store, outbox, executeMutation, executeMutationNow, executeProjectionCommand, executeProjectionCommandNow, activateTask, recordContentContribution, transitionExecutionIntent, maintain, drainOutbox, projection: () => store.projection() };
}

export type ProjectTaskState = ReturnType<typeof createProjectTaskState>;
