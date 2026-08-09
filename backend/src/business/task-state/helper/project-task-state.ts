/**
 * WHAT: Serializes one project's local task commands into durable causal current-state mutations.
 * WHY: Optimistic callers need immediate scoped state while persistence and replication avoid workspace rewrites.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { parseThreadMarkdown } from '../../ledger/helper/thread-content-file.js';
import { captureTaskExecutionArtifact } from './capture-task-execution-artifact.js';
import { createTaskCurrentStateStore } from './task-current-state-store.js';
import { taskCurrentStateVersion, type TaskEntityChange, type TaskStateDelta } from './task-current-state-types.js';
import { createTaskContentObjectStore, type TaskContentHead } from './task-content-object-store.js';
import { taskContentReferences } from './task-content-resources.js';
import { taskCommandForMutation, taskCommandForProjection, type TaskProjectionCommand } from './task-mutation-command.js';
import { createTaskExecutionRepository } from './task-execution-repository.js';
import { mergeableTaskConflictChanges } from './resolve-mergeable-task-conflicts.js';

type AnyRecord = Record<string, unknown>;
type TaskProjectionEntityChange = { entityType: TaskEntityChange['entityType']; entityId: string };

export type ProjectTaskMutationResult = {
  changed: boolean;
  deltas: TaskStateDelta[];
  localChanges: TaskProjectionEntityChange[];
  ledger: AnyRecord;
  contentGitRevision?: AnyRecord;
};

export type PreparedProjectTaskMutation = {
  after: AnyRecord;
  changedContentFiles?: readonly string[];
};

export type TaskContentHeadRepairResult = {
  repaired: TaskContentHead[];
  missing: string[];
};

export type TaskContentContributionReceipt = {
  delta: TaskStateDelta;
  committedResourceIds: string[];
};

function readableLedger(file: string): AnyRecord {
  if (!existsSync(file)) return { cards: [], annotations: [], relationships: [] };
  return JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
}

function mergeDeltas(projectId: string, deltas: TaskStateDelta[]): TaskStateDelta {
  const entities = new Map<string, TaskStateDelta['entities'][number]>();
  for (const delta of deltas) for (const entity of delta.entities) entities.set(`${entity.entityType}\u0000${entity.entityId}`, entity);
  return { version: taskCurrentStateVersion, projectId, entities: [...entities.values()] };
}

function projectionEntityChanges(changes: TaskEntityChange[]): TaskProjectionEntityChange[] {
  const identities = new Map<string, TaskProjectionEntityChange>();
  for (const change of changes) {
    const identity = { entityType: change.entityType, entityId: change.entityId };
    identities.set(`${identity.entityType}\u0000${identity.entityId}`, identity);
  }
  return [...identities.values()];
}

function containsEveryThreadNote(localBody: string, candidateBody: string): boolean {
  const localNotes = parseThreadMarkdown(localBody);
  const candidateNotes = parseThreadMarkdown(candidateBody);
  const localById = new Map(localNotes.map((note) => [String(note.id ?? ''), note]));
  const candidateIds = candidateNotes.map((note) => String(note.id ?? ''));
  return localById.size === localNotes.length
    && new Set(candidateIds).size === candidateNotes.length
    && candidateIds.every(Boolean)
    && candidateNotes.every((note) => isDeepStrictEqual(localById.get(String(note.id)), note));
}

export function createProjectTaskState(input: {
  projectId: string;
  writerId: string;
  decisionOsRoot: string;
  tasksLedgerFile: string;
  publish?: (delta: TaskStateDelta) => void | Promise<void>;
  publishContent?: (resourceId: string) => void | Promise<void>;
  commitContent?: (change: { mutation: LedgerMutation; changedContentFiles: readonly string[] }) => Promise<AnyRecord | null>;
  initialize?: boolean;
  canWrite?: () => boolean;
  onPersistenceError?: (error: Error) => void;
  onExecutionChange?: (change: { executionId: string; record: ReturnType<ReturnType<typeof createTaskExecutionRepository>['find']> }) => void;
}) {
  const store = createTaskCurrentStateStore({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    onPersistenceError: input.onPersistenceError,
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

  const contentHeadNeedsCausalUpdate = (head: TaskContentHead): boolean => {
    const current = store.contentHeads(head.key);
    // WHAT: Reassert the preserved local bytes when a resource has concurrent active heads.
    // WHY: Matching one candidate is not convergence; a new observed write must causally replace every competing head.
    return current.length !== 1
      || current[0].type !== head.type
      || current[0].hash !== head.hash
      || current[0].bytes !== head.bytes;
  };
  const executions = createTaskExecutionRepository({
    store,
    writerId: input.writerId,
    projectId: input.projectId,
    persist: (changes, emittedAt) => persistChanges(changes, { emittedAt }),
    assertWritable,
    onCommitted: input.onExecutionChange,
  });

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

  const assignmentCandidates = (taskId: string): AnyRecord[] => {
    const register = store.entity('card', taskId)?.fields.assignment;
    if (!register) return [];
    const values = new Map<string, AnyRecord>();
    for (const candidate of register.candidates) {
      if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object' || Array.isArray(candidate.value)) continue;
      const value = candidate.value as AnyRecord;
      values.set(JSON.stringify(value), value);
    }
    return [...values.values()];
  };

  const taskHasActiveExecution = (taskId: string): boolean => {
    const activePhases = new Set(['preparing', 'queued', 'starting', 'running', 'cancelling']);
    return store.activeDelta().entities.some((entity) => {
      if (entity.entityType !== 'execution') return false;
      const ownsTask = entity.fields.metadata?.candidates.some((candidate) => (
        candidate.operation === 'set'
        && candidate.value
        && typeof candidate.value === 'object'
        && !Array.isArray(candidate.value)
        && String((candidate.value as AnyRecord).taskId ?? '') === taskId
      ));
      return ownsTask && entity.fields.lifecycle?.candidates.some((candidate) => (
        candidate.operation === 'set'
        && candidate.value
        && typeof candidate.value === 'object'
        && !Array.isArray(candidate.value)
        && activePhases.has(String((candidate.value as AnyRecord).phase ?? ''))
      ));
    });
  };

  const activateTask = async (taskId: string): Promise<TaskStateDelta> => {
    if (!taskId) return { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    const released = await store.activate(taskId);
    await publish(released);
    return released;
  };

  const recordContentContributionReceipt = async (
    taskId: string,
    resourceIds: string | string[],
    validate?: (head: TaskContentHead, body: string) => void | Promise<void>,
  ): Promise<TaskContentContributionReceipt> => {
    const resources = [...new Set((Array.isArray(resourceIds) ? resourceIds : [resourceIds]).filter(Boolean))];
    const captured = await Promise.all(resources.map(async (resourceId) => ({
      resourceId,
      head: await contentObjects.capture(resourceId),
    })));
    const missing = captured.find((entry) => entry.head === null);
    // WHAT: Reject an owned contribution when any declared resource cannot be captured.
    // WHY: Filtering a deleted file would retain the old head while falsely acknowledging the manual change.
    if (missing) throw new Error(`task_content_capture_failed:${missing.resourceId}`);
    const heads = captured.map((entry) => entry.head!);
    const changedHeads = heads.filter(contentHeadNeedsCausalUpdate);
    // WHAT: Validate the immutable captured object before advancing its causal resource head.
    // WHY: Validation and publication must describe the same stable bytes rather than two mutable file reads.
    if (validate) {
      for (const head of changedHeads) await validate(head, readFileSync(contentObjects.objectFile(head.hash), 'utf8'));
    }
    const contentDelta = changedHeads.length > 0
      ? await persistChanges(changedHeads.map((head) => ({ entityType: 'resource', entityId: head.key, changes: [{ path: 'head', operation: 'set', value: head }] })), { activationTaskId: taskId })
      : { version: taskCurrentStateVersion, projectId: input.projectId, entities: [] };
    for (const head of changedHeads) await input.publishContent?.(head.key);
    return {
      delta: mergeDeltas(input.projectId, [contentDelta, await activateTask(taskId)]),
      committedResourceIds: changedHeads.map((head) => head.key),
    };
  };

  const recordContentContribution = async (
    taskId: string,
    resourceIds: string | string[],
    validate?: (head: TaskContentHead, body: string) => void | Promise<void>,
  ): Promise<TaskStateDelta> => (await recordContentContributionReceipt(taskId, resourceIds, validate)).delta;

  const finalizeExecutionArtifacts = async (executionId: string, files: {
    jsonl?: string;
    stderr?: string;
    telemetry?: string;
    result?: string;
  }) => {
    assertWritable();
    const execution = executions.find(executionId);
    if (!execution) throw new Error(`task_execution_not_found:${executionId}`);
    const objectRoot = resolve(store.root, 'objects');
    // WHAT: Give execution artifacts one replicated reachability owner.
    // WHY: Publishing the same bytes as path-based resource heads prevents safe collection after the execution is tombstoned.
    const [jsonl, stderr, telemetry, result] = await Promise.all([
      files.jsonl ? captureTaskExecutionArtifact({ objectRoot, file: files.jsonl, mediaType: 'application/x-ndjson' }) : null,
      files.stderr ? captureTaskExecutionArtifact({ objectRoot, file: files.stderr, mediaType: 'text/plain' }) : null,
      files.telemetry ? captureTaskExecutionArtifact({ objectRoot, file: files.telemetry, mediaType: 'application/x-ndjson' }) : null,
      files.result ? captureTaskExecutionArtifact({ objectRoot, file: files.result, mediaType: 'application/json' }) : null,
    ]);
    for (const [kind, requested, captured] of [
      ['jsonl', files.jsonl, jsonl],
      ['stderr', files.stderr, stderr],
    ] as const) {
      // WHAT: Reject a missing primary execution artifact while retaining optional telemetry and result semantics.
      // WHY: JSONL and stderr are the required evidence pair; optional diagnostic files are not emitted by every runner.
      if (requested && !captured) throw new Error(`task_execution_artifact_missing:${kind}:${executionId}`);
    }
    return executions.finalizeArtifacts(executionId, {
      jsonl,
      stderr,
      telemetry,
      result,
    });
  };

  const queueContentContribution = (
    taskId: string,
    resourceIds: string | string[],
    validate?: (head: TaskContentHead, body: string) => void | Promise<void>,
  ): Promise<TaskStateDelta> => {
    assertWritable();
    const operation = commandQueue.then(() => recordContentContribution(taskId, resourceIds, validate));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const queueContentContributionReceipt = (
    taskId: string,
    resourceIds: string | string[],
    validate?: (head: TaskContentHead, body: string) => void | Promise<void>,
  ): Promise<TaskContentContributionReceipt> => {
    assertWritable();
    const operation = commandQueue.then(() => recordContentContributionReceipt(taskId, resourceIds, validate));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const reconcileSupersetThreadContentConflict = (resourceId: string): Promise<boolean> => {
    assertWritable();
    const operation = commandQueue.then(async () => {
      const heads = store.contentHeads(resourceId);
      const distinctHashes = new Set(heads.map((head) => head.hash));
      // WHAT: Limit automatic reconciliation to a genuinely conflicted thread Markdown resource.
      // WHY: Card documents, assets, and single-hash duplicate candidates require different preservation rules.
      if (!resourceId.includes('/threads/') || !resourceId.endsWith('.md') || distinctHashes.size < 2) return false;
      const localHead = await contentObjects.capture(resourceId);
      // WHAT: Require the mutable sidecar to match one causally retained candidate exactly.
      // WHY: Untracked local bytes cannot be selected as an automatic conflict winner.
      if (!localHead || !heads.some((head) => head.hash === localHead.hash && head.bytes === localHead.bytes)) return false;
      const localBody = readFileSync(contentObjects.objectFile(localHead.hash), 'utf8');
      for (const head of heads) {
        const candidateFile = contentObjects.objectFile(head.hash);
        // WHAT: Keep the conflict explicit when any retained candidate body is unavailable locally.
        // WHY: Superset proof requires byte-verified access to every causal alternative.
        if (!existsSync(candidateFile)) return false;
        // WHAT: Select the local thread only when it losslessly contains every stable note from this candidate.
        // WHY: Same-note divergence or a note present only remotely must remain operator-visible conflict state.
        if (!containsEveryThreadNote(localBody, readFileSync(candidateFile, 'utf8'))) return false;
      }
      await recordContentContribution('', resourceId);
      const resolved = store.contentHeads(resourceId);
      return resolved.length === 1 && resolved[0].hash === localHead.hash;
    });
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const queueTaskActivation = (taskId: string): Promise<TaskStateDelta> => {
    assertWritable();
    const operation = commandQueue.then(() => activateTask(taskId));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const repairMissingContentHeadsNow = async (): Promise<TaskContentHeadRepairResult> => {
    const ledger = store.projection().ledger;
    const cards = Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [];
    const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles)
      ? ledger.threadFiles as AnyRecord
      : {};
    const referencedFiles = new Set<string>();
    for (const card of cards) {
      const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
        ? card.comment as AnyRecord
        : {};
      const contentFile = String(comment.contentFile ?? '');
      if (contentFile) referencedFiles.add(contentFile);
    }
    for (const contentFile of Object.values(threadFiles)) {
      if (typeof contentFile === 'string' && contentFile) referencedFiles.add(contentFile);
    }
    const repaired: TaskContentHead[] = [];
    const missing: string[] = [];
    for (const resourceId of referencedFiles) {
      if (store.contentHeads(resourceId).length > 0) continue;
      const head = await contentObjects.capture(resourceId);
      if (head) repaired.push(head);
      else missing.push(resourceId);
    }
    if (repaired.length > 0) {
      await persistChanges(repaired.map((head) => ({
        entityType: 'resource',
        entityId: head.key,
        changes: [{ path: 'head', operation: 'set', value: head }],
      })));
      for (const head of repaired) await input.publishContent?.(head.key);
    }
    return { repaired, missing };
  };

  const repairMissingContentHeads = (): Promise<TaskContentHeadRepairResult> => {
    assertWritable();
    const operation = commandQueue.then(repairMissingContentHeadsNow);
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const executeMutationNow = async (
    mutation: LedgerMutation,
    before: AnyRecord,
    after: AnyRecord,
    changedContentFiles: readonly string[] = [],
  ): Promise<ProjectTaskMutationResult> => {
    if (mutation.action === 'complete-master-task' && mutation.masterTaskId) {
      const masterTaskId = String(mutation.masterTaskId);
      const subtaskIds = Array.isArray(before.relationships) ? (before.relationships as AnyRecord[])
        .filter((relationship) => String(relationship.from ?? '') === masterTaskId && relationship.label === 'subtask')
        .map((relationship) => String(relationship.to ?? '')) : [];
      assertLifecycleConflictFree([masterTaskId, ...subtaskIds]);
    }
    if (mutation.action === 'reassign-task' && mutation.cardId) {
      const taskId = String(mutation.cardId);
      const nodeId = String(mutation.assignedNodeId ?? '');
      if (!/^[a-zA-Z0-9_-]+$/.test(nodeId)) throw new Error('invalid_task_assignment');
      if (taskHasActiveExecution(taskId)) throw new Error(`task_execution_active:${taskId}`);
      const card = Array.isArray(after.cards) ? (after.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId) : null;
      if (!card) throw new Error(`task_card_not_found:${taskId}`);
      const candidates = assignmentCandidates(taskId);
      const nodeIds = new Set(candidates.map((candidate) => String(candidate.nodeId ?? '')));
      if (candidates.length === 1 && nodeIds.size === 1 && nodeIds.has(nodeId)) {
        card.assignment = structuredClone(candidates[0]);
      } else {
        const revision = Math.max(0, ...candidates.map((candidate) => Number(candidate.revision) || 0)) + 1;
        card.assignment = { nodeId, changedAt: new Date().toISOString(), revision };
      }
    }
    const command = taskCommandForMutation({ mutation, before, after });
    // WHAT: Capture the exact files reported by the synchronous mutation writer.
    // WHY: A second mutation-action table can omit a newly written document and publish incomplete task state.
    const mutationResources = new Set(changedContentFiles.filter(Boolean));
    const changedContentResources: string[] = [];
    for (const resourceId of mutationResources) {
      const head = await contentObjects.capture(resourceId);
      if (!head) throw new Error(`task_content_capture_failed:${resourceId}`);
      const headChanged = contentHeadNeedsCausalUpdate(head);
      if (headChanged) {
        command.changes.push({ entityType: 'resource', entityId: head.key, changes: [{ path: 'head', operation: 'set', value: head }] });
        changedContentResources.push(head.key);
      }
    }
    const priorHashes = command.changes.map(entityHash);
    const delta = await persistChanges(command.changes, { activationTaskId: command.activationTaskId, replication: command.replication });
    for (const resourceId of changedContentResources) await input.publishContent?.(resourceId);
    const changed = command.changes.some((change, index) => entityHash(change) !== priorHashes[index]);
    const deltas = delta.entities.length > 0 ? [delta] : [];
    if (['append-note', 'update-note', 'delete-note', 'restore-note'].includes(command.kind)) {
      const body = String(mutation.note?.body ?? '');
      const resourceIds = taskContentReferences(body);
      deltas.push(await recordContentContribution(command.activationTaskId, resourceIds));
    }
    // WHAT: Put versioned task Markdown behind a second durable boundary before acknowledging the mutation.
    // WHY: Repository cleanup must not be able to remove a newly created task or accepted thread message as untracked state.
    const contentGitRevision = mutationResources.size > 0
      ? await input.commitContent?.({ mutation, changedContentFiles: [...mutationResources] }) ?? null
      : null;
    return {
      changed,
      deltas,
      localChanges: projectionEntityChanges(command.changes),
      ledger: store.projection().ledger,
      ...(contentGitRevision ? { contentGitRevision } : {}),
    };
  };

  const executeMutation = (
    mutation: LedgerMutation,
    before: AnyRecord,
    after: AnyRecord,
    changedContentFiles: readonly string[] = [],
  ): Promise<ProjectTaskMutationResult> => {
    assertWritable();
    const operation = commandQueue.then(() => executeMutationNow(mutation, before, after, changedContentFiles));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const executePreparedMutation = (
    mutation: LedgerMutation,
    prepare: (before: AnyRecord) => Promise<PreparedProjectTaskMutation>,
  ): Promise<ProjectTaskMutationResult> => {
    assertWritable();
    const operation = commandQueue.then(async () => {
      const before = structuredClone(store.projection().ledger);
      const prepared = await prepare(before);
      return executeMutationNow(mutation, before, prepared.after, prepared.changedContentFiles);
    });
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const transitionCardLifecycle = (taskId: string, status: 'todo' | 'backlog' | 'done', waitingAt?: string): Promise<ProjectTaskMutationResult> => {
    assertWritable();
    if (waitingAt !== undefined && (status !== 'todo' || !Number.isFinite(Date.parse(waitingAt)))) {
      throw new Error('invalid_task_waiting_timestamp');
    }
    // WHAT: Serialize one lifecycle transition against the latest authoritative projection.
    // WHY: CLI callers do not carry a trusted whole-ledger before/after document.
    const operation = commandQueue.then(async () => {
      const before = structuredClone(store.projection().ledger);
      const after = structuredClone(before);
      const card = Array.isArray(after.cards)
        ? (after.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === taskId)
        : null;
      if (!card) throw new Error(`task_card_not_found:${taskId}`);
      const lifecycle = card.lifecycle && typeof card.lifecycle === 'object' && !Array.isArray(card.lifecycle) ? card.lifecycle as AnyRecord : {};
      const currentStatus = String(lifecycle.status ?? card.status ?? '');
      if (waitingAt !== undefined && currentStatus !== 'todo') {
        return { changed: false, deltas: [], localChanges: [], ledger: before };
      }
      if (waitingAt !== undefined) {
        const currentWaitingAt = Date.parse(String(lifecycle.waitingAt ?? ''));
        if (Number.isFinite(currentWaitingAt) && currentWaitingAt >= Date.parse(waitingAt)) {
          return { changed: false, deltas: [], localChanges: [], ledger: before };
        }
      }
      card.status = status;
      if (waitingAt !== undefined) {
        const changedAt = new Date(waitingAt).toISOString();
        card.lifecycle = { status: 'todo', changedAt, waitingAt: changedAt, closedAt: null };
      }
      return executeMutationNow({ action: 'transition-card-lifecycle', cardId: taskId, lifecycleStatus: status }, before, after);
    });
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const executeProjectionCommandNow = async (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<ProjectTaskMutationResult> => {
    const changes = taskCommandForProjection({ command, before: store.projection().ledger, after: ledger });
    const priorHashes = changes.map(entityHash);
    const delta = await persistChanges(changes, { emittedAt });
    return {
      changed: changes.some((change, index) => entityHash(change) !== priorHashes[index]),
      deltas: delta.entities.length > 0 ? [delta] : [],
      localChanges: projectionEntityChanges(changes),
      ledger: store.projection().ledger,
    };
  };

  const executeProjectionCommand = (command: TaskProjectionCommand, ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<ProjectTaskMutationResult> => {
    assertWritable();
    const operation = commandQueue.then(() => executeProjectionCommandNow(command, ledger, emittedAt));
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const reconcileMergeableConflicts = (targets?: TaskProjectionEntityChange[]): Promise<ProjectTaskMutationResult> => {
    const operation = commandQueue.then(async () => {
      const entities = targets
        ? [...new Map(targets.map((target) => [`${target.entityType}\u0000${target.entityId}`, target])).values()]
          .flatMap((target) => store.entity(target.entityType, target.entityId) ?? [])
        : store.activeDelta().entities;
      const changes = mergeableTaskConflictChanges(entities);
      if (changes.length === 0) {
        return { changed: false, deltas: [], localChanges: [], ledger: store.projection().ledger };
      }
      // WHAT: Write one local successor after observing every candidate in each mergeable register.
      // WHY: A selected display value does not remove the concurrent dots that keep the task conflicted.
      const delta = await persistChanges(changes);
      return {
        changed: delta.entities.length > 0,
        deltas: delta.entities.length > 0 ? [delta] : [],
        localChanges: projectionEntityChanges(changes),
        ledger: store.projection().ledger,
      };
    });
    commandQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  return {
    store,
    executions,
    executionArtifactFile: (hash: string): string => (
      /^[a-f0-9]{64}$/i.test(hash) ? contentObjects.objectFile(hash) : ''
    ),
    executeMutation,
    executeMutationNow,
    executePreparedMutation,
    transitionCardLifecycle,
    executeProjectionCommand,
    executeProjectionCommandNow,
    reconcileMergeableConflicts,
    repairMissingContentHeads,
    activateTask: queueTaskActivation,
    recordContentContribution: queueContentContribution,
    recordContentContributionReceipt: queueContentContributionReceipt,
    reconcileSupersetThreadContentConflict,
    finalizeExecutionArtifacts,
    flush: store.flush,
    projection: store.projection,
  };
}

export type ProjectTaskState = ReturnType<typeof createProjectTaskState>;
