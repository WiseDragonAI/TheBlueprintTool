/**
 * WHAT: Stores and indexes canonical epoch-4 execution entities in replicated project task state.
 * WHY: Launch, scheduling, status, cancellation, and recovery need one convergent authority instead of a node-local JSON document.
 */
import type {
  TaskEntityChange,
  TaskExecutionArtifacts,
  TaskExecutionArtifactHead,
  TaskExecutionError,
  TaskExecutionLifecycle,
  TaskExecutionMetadata,
  TaskExecutionPhase,
  TaskExecutionResult,
  TaskStateDelta,
} from './task-current-state-types.js';
import type { TaskCurrentStateStore } from './task-current-state-store.js';
import { canonicalJson } from './task-current-state-codec.js';

type ExecutionRecord = {
  metadata: TaskExecutionMetadata;
  lifecycle: TaskExecutionLifecycle;
  artifacts: TaskExecutionArtifacts;
};

type ExecutionDiagnostic = {
  executionId: string;
  code: 'task_execution_conflict' | 'task_execution_incomplete' | 'task_execution_request_conflict';
  lanes: string[];
  taskId?: string;
};

type ExecutionIndexes = {
  root: string;
  records: Map<string, ExecutionRecord>;
  diagnostics: Map<string, ExecutionDiagnostic>;
  taskIds: Map<string, Set<string>>;
  sessionIds: Map<string, Set<string>>;
  pipelineRunIds: Map<string, Set<string>>;
  phases: Map<TaskExecutionPhase, Set<string>>;
  executorNodeIds: Map<string, Set<string>>;
  requests: Map<string, string>;
  requestConflicts: Set<string>;
};

const terminalPhases = new Set<TaskExecutionPhase>(['succeeded', 'failed', 'cancelled', 'interrupted']);
const transitions: Readonly<Record<TaskExecutionPhase, ReadonlySet<TaskExecutionPhase>>> = {
  preparing: new Set(['queued', 'succeeded', 'failed', 'cancelled']),
  queued: new Set(['starting', 'cancelled', 'interrupted']),
  starting: new Set(['running', 'failed', 'cancelled', 'interrupted']),
  running: new Set(['cancelling', 'succeeded', 'failed', 'cancelled', 'interrupted']),
  cancelling: new Set(['failed', 'cancelled', 'interrupted']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  interrupted: new Set(['queued', 'cancelled']),
};

function emptyIndexes(): ExecutionIndexes {
  return {
    root: '',
    records: new Map(),
    diagnostics: new Map(),
    taskIds: new Map(),
    sessionIds: new Map(),
    pipelineRunIds: new Map(),
    phases: new Map(),
    executorNodeIds: new Map(),
    requests: new Map(),
    requestConflicts: new Set(),
  };
}

function add(index: Map<string, Set<string>>, key: string, executionId: string): void {
  if (!key) return;
  index.set(key, new Set([...(index.get(key) ?? []), executionId]));
}

function selectedLane<T>(entity: NonNullable<ReturnType<TaskCurrentStateStore['entity']>>, path: string): { value: T | null; conflict: boolean } {
  const candidates = entity.fields[path]?.candidates.filter((candidate) => candidate.operation === 'set' && candidate.value !== undefined) ?? [];
  const effects = new Map<string, T>();
  for (const candidate of candidates) effects.set(canonicalJson(candidate.value), candidate.value as T);
  return { value: effects.size === 1 ? [...effects.values()][0] : null, conflict: effects.size > 1 };
}

function entityPresence(entity: NonNullable<ReturnType<TaskCurrentStateStore['entity']>>): { tombstone: boolean; conflict: boolean } {
  const candidates = entity.fields.$entity?.candidates ?? [];
  const effects = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const effect = `${candidate.operation}\u0000${candidate.value === undefined ? '' : canonicalJson(candidate.value)}`;
    effects.set(effect, candidate);
  }
  const selected = effects.size === 1 ? [...effects.values()][0] : null;
  return { tombstone: selected?.operation === 'tombstone', conflict: effects.size > 1 };
}

function requestKey(taskId: string, requestId: string): string {
  return `${taskId}\u0000${requestId}`;
}

function ordered(records: Iterable<ExecutionRecord>): ExecutionRecord[] {
  return [...records].sort((left, right) => (
    left.metadata.requestedAt.localeCompare(right.metadata.requestedAt)
    || left.metadata.executionId.localeCompare(right.metadata.executionId)
  ));
}

function validNodeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

function initialArtifacts(changedAt: string): TaskExecutionArtifacts {
  return { jsonl: null, stderr: null, telemetry: null, result: null, changedAt, revision: 1 };
}

function terminalResult(phase: TaskExecutionPhase, result: TaskExecutionResult | null | undefined): TaskExecutionResult | null {
  if (!terminalPhases.has(phase)) return null;
  return result ?? { status: phase as TaskExecutionResult['status'], summary: '' };
}

function terminalError(phase: TaskExecutionPhase, error: TaskExecutionError | null | undefined): TaskExecutionError | null {
  if (phase !== 'failed') return null;
  return error ?? { code: 'task_execution_failed', message: 'Task execution failed.' };
}

export function createTaskExecutionRepository(input: {
  store: TaskCurrentStateStore;
  writerId: string;
  projectId: string;
  now?: () => Date;
  persist?: (changes: TaskEntityChange[], emittedAt: string) => Promise<TaskStateDelta>;
  assertWritable?: () => void;
  onCommitted?: (change: { executionId: string; record: ExecutionRecord | null }) => void;
}) {
  const now = input.now ?? (() => new Date());
  let indexes = emptyIndexes();
  let commandQueue = Promise.resolve();

  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = commandQueue.then(operation);
    commandQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const rebuild = (): void => {
    const root = input.store.rootHash();
    if (indexes.root === root) return;
    const next = emptyIndexes();
    next.root = root;
    for (const entity of input.store.activeDelta().entities.filter((candidate) => candidate.entityType === 'execution')) {
      const presence = entityPresence(entity);
      if (presence.conflict) {
        next.diagnostics.set(entity.entityId, { executionId: entity.entityId, code: 'task_execution_conflict', lanes: ['$entity'] });
        continue;
      }
      if (presence.tombstone) continue;
      const metadata = selectedLane<TaskExecutionMetadata>(entity, 'metadata');
      const lifecycle = selectedLane<TaskExecutionLifecycle>(entity, 'lifecycle');
      const artifacts = selectedLane<TaskExecutionArtifacts>(entity, 'artifacts');
      const conflicts = [
        ...(metadata.conflict ? ['metadata'] : []),
        ...(lifecycle.conflict ? ['lifecycle'] : []),
        ...(artifacts.conflict ? ['artifacts'] : []),
      ];
      if (conflicts.length > 0) {
        next.diagnostics.set(entity.entityId, {
          executionId: entity.entityId,
          code: 'task_execution_conflict',
          lanes: conflicts,
          ...(metadata.value?.taskId ? { taskId: metadata.value.taskId } : {}),
        });
        continue;
      }
      const missing = [
        ...(!metadata.value ? ['metadata'] : []),
        ...(!lifecycle.value ? ['lifecycle'] : []),
        ...(!artifacts.value ? ['artifacts'] : []),
      ];
      if (missing.length > 0) {
        next.diagnostics.set(entity.entityId, {
          executionId: entity.entityId,
          code: 'task_execution_incomplete',
          lanes: missing,
          ...(metadata.value?.taskId ? { taskId: metadata.value.taskId } : {}),
        });
        continue;
      }
      const record = { metadata: metadata.value, lifecycle: lifecycle.value, artifacts: artifacts.value };
      next.records.set(entity.entityId, record);
    }
    for (const [executionId, record] of next.records) {
      const key = requestKey(record.metadata.taskId, record.metadata.requestId);
      const duplicate = next.requests.get(key);
      if (duplicate) {
        next.requestConflicts.add(key);
        const duplicateTaskId = next.records.get(duplicate)?.metadata.taskId;
        next.diagnostics.set(duplicate, { executionId: duplicate, code: 'task_execution_request_conflict', lanes: ['metadata'], ...(duplicateTaskId ? { taskId: duplicateTaskId } : {}) });
        next.diagnostics.set(executionId, { executionId, code: 'task_execution_request_conflict', lanes: ['metadata'], ...(record.metadata.taskId ? { taskId: record.metadata.taskId } : {}) });
        continue;
      }
      next.requests.set(key, executionId);
    }
    for (const diagnostic of next.diagnostics.values()) {
      if (diagnostic.code === 'task_execution_request_conflict') next.records.delete(diagnostic.executionId);
    }
    for (const [executionId, record] of next.records) {
      add(next.taskIds, record.metadata.taskId, executionId);
      add(next.sessionIds, record.metadata.sessionId, executionId);
      add(next.pipelineRunIds, record.metadata.pipelineRunId ?? '', executionId);
      add(next.phases, record.lifecycle.phase, executionId);
      add(next.executorNodeIds, record.lifecycle.executorNodeId, executionId);
    }
    indexes = next;
  };

  const persist = async (changes: TaskEntityChange[], emittedAt: string): Promise<void> => {
    if (input.persist) await input.persist(changes, emittedAt);
    else await input.store.mutate({ replicaId: input.writerId, changes, emittedAt });
    indexes.root = '';
    for (const executionId of new Set(changes.filter((change) => change.entityType === 'execution').map((change) => change.entityId))) {
      try {
        input.onCommitted?.({ executionId, record: find(executionId) });
      } catch {
        // Projection notifications must never turn a committed lifecycle transition into a failed command.
      }
    }
  };

  const find = (executionId: string): ExecutionRecord | null => {
    rebuild();
    const diagnostic = indexes.diagnostics.get(executionId);
    if (diagnostic) throw new Error(`${diagnostic.code}:${executionId}:${diagnostic.lanes.join(',')}`);
    return indexes.records.get(executionId) ?? null;
  };

  const recordsFor = (
    index: 'taskIds' | 'sessionIds' | 'pipelineRunIds' | 'phases' | 'executorNodeIds',
    key: string,
  ): ExecutionRecord[] => {
    rebuild();
    const selectedIndex = indexes[index] as Map<string, Set<string>>;
    return ordered([...(selectedIndex.get(key) ?? [])].flatMap((executionId) => {
      const record = indexes.records.get(executionId);
      return record ? [record] : [];
    }));
  };

  const admitNow = async (admission: { metadata: TaskExecutionMetadata; executorNodeId: string }): Promise<ExecutionRecord> => {
    input.assertWritable?.();
    rebuild();
    const { metadata, executorNodeId } = admission;
    if (metadata.projectId !== input.projectId) throw new Error('task_execution_project_mismatch');
    if (!validNodeId(executorNodeId)) throw new Error('invalid_task_execution_executor');
    const idempotencyKey = requestKey(metadata.taskId, metadata.requestId);
    if (indexes.requestConflicts.has(idempotencyKey)) throw new Error(`task_execution_request_conflict:${metadata.requestId}`);
    const existingRequestId = indexes.requests.get(idempotencyKey);
    if (existingRequestId) {
      const existing = find(existingRequestId)!;
      if (canonicalJson(existing.metadata) !== canonicalJson(metadata) || existing.lifecycle.executorNodeId !== executorNodeId) {
        throw new Error(`task_execution_request_conflict:${metadata.requestId}`);
      }
      return structuredClone(existing);
    }
    if (input.store.entity('execution', metadata.executionId)) throw new Error(`task_execution_already_exists:${metadata.executionId}`);
    const lifecycle: TaskExecutionLifecycle = {
      phase: 'preparing',
      phaseSince: metadata.requestedAt,
      startedAt: null,
      finishedAt: null,
      executorNodeId,
      providerSessionId: null,
      result: null,
      error: null,
      revision: 1,
    };
    const artifacts = initialArtifacts(metadata.requestedAt);
    await persist([{
      entityType: 'execution',
      entityId: metadata.executionId,
      changes: [
        { path: 'metadata', operation: 'set', value: structuredClone(metadata) },
        { path: 'lifecycle', operation: 'set', value: lifecycle },
        { path: 'artifacts', operation: 'set', value: artifacts },
      ],
    }], metadata.requestedAt);
    return structuredClone(find(metadata.executionId)!);
  };

  const transitionNow = async (executionId: string, transition: {
    phase: TaskExecutionPhase;
    changedAt?: string;
    executorNodeId?: string;
    providerSessionId?: string | null;
    result?: TaskExecutionResult | null;
    error?: TaskExecutionError | null;
  }): Promise<ExecutionRecord> => {
    input.assertWritable?.();
    const current = find(executionId);
    if (!current) throw new Error(`task_execution_not_found:${executionId}`);
    const providerSessionBinding = transition.phase === current.lifecycle.phase
      && current.lifecycle.providerSessionId === null
      && typeof transition.providerSessionId === 'string'
      && transition.providerSessionId.length > 0;
    // WHAT: Permit only the same-phase mutation that binds a newly created provider session.
    // WHY: Codex emits thread identity after the running transition while all other lifecycle changes remain explicit transitions.
    if (!transitions[current.lifecycle.phase].has(transition.phase) && !providerSessionBinding) {
      throw new Error(`task_execution_transition_invalid:${current.lifecycle.phase}:${transition.phase}`);
    }
    if (transition.executorNodeId !== undefined && transition.executorNodeId !== current.lifecycle.executorNodeId) {
      throw new Error(`task_execution_executor_immutable:${executionId}`);
    }
    if (current.lifecycle.providerSessionId !== null
      && transition.providerSessionId !== undefined
      && transition.providerSessionId !== current.lifecycle.providerSessionId) {
      throw new Error(`task_execution_provider_session_immutable:${executionId}`);
    }
    const changedAt = transition.changedAt ?? now().toISOString();
    if (!Number.isFinite(Date.parse(changedAt))) throw new Error('invalid_task_execution_timestamp');
    if (Date.parse(changedAt) < Date.parse(current.lifecycle.phaseSince)) throw new Error(`task_execution_timestamp_regression:${executionId}`);
    const terminal = terminalPhases.has(transition.phase);
    const requeued = current.lifecycle.phase === 'interrupted' && transition.phase === 'queued';
    const normalizedChangedAt = new Date(changedAt).toISOString();
    const finishedAt = requeued
      ? null
      : transition.phase === 'cancelling'
        ? normalizedChangedAt
        : terminal
          ? current.lifecycle.finishedAt ?? normalizedChangedAt
          : null;
    const lifecycle: TaskExecutionLifecycle = {
      phase: transition.phase,
      phaseSince: providerSessionBinding ? current.lifecycle.phaseSince : normalizedChangedAt,
      startedAt: requeued
        ? null
        : current.lifecycle.startedAt ?? (transition.phase === 'starting' || transition.phase === 'running' ? normalizedChangedAt : null),
      // WHAT: Preserve the accepted Stop timestamp across process cleanup.
      // WHY: A later child close must not redefine when the operator ended the execution.
      finishedAt,
      executorNodeId: current.lifecycle.executorNodeId,
      providerSessionId: transition.providerSessionId === undefined ? current.lifecycle.providerSessionId : transition.providerSessionId,
      result: terminalResult(transition.phase, transition.result),
      error: terminalError(transition.phase, transition.error),
      revision: current.lifecycle.revision + 1,
    };
    await persist([{
      entityType: 'execution',
      entityId: executionId,
      changes: [{ path: 'lifecycle', operation: 'set', value: lifecycle }],
    }], lifecycle.phaseSince);
    return structuredClone(find(executionId)!);
  };

  const finalizeArtifactsNow = async (executionId: string, artifacts: {
    jsonl?: TaskExecutionArtifactHead | null;
    stderr?: TaskExecutionArtifactHead | null;
    telemetry?: TaskExecutionArtifactHead | null;
    result?: TaskExecutionArtifactHead | null;
    changedAt?: string;
  }): Promise<ExecutionRecord> => {
    input.assertWritable?.();
    const current = find(executionId);
    if (!current) throw new Error(`task_execution_not_found:${executionId}`);
    // WHAT: Permit immutable artifact capture before the terminal lifecycle contribution.
    // WHY: Requiring terminal state here structurally created a replicated terminal window with no durable evidence.
    if (!['running', 'cancelling', ...terminalPhases].includes(current.lifecycle.phase)) {
      throw new Error(`task_execution_artifacts_phase_invalid:${executionId}:${current.lifecycle.phase}`);
    }
    const changedAt = artifacts.changedAt ?? now().toISOString();
    if (!Number.isFinite(Date.parse(changedAt))) throw new Error('invalid_task_execution_artifact_timestamp');
    if (Date.parse(changedAt) < Date.parse(current.artifacts.changedAt)) throw new Error(`task_execution_artifact_timestamp_regression:${executionId}`);
    const next: TaskExecutionArtifacts = {
      jsonl: artifacts.jsonl === undefined ? current.artifacts.jsonl : artifacts.jsonl,
      stderr: artifacts.stderr === undefined ? current.artifacts.stderr : artifacts.stderr,
      telemetry: artifacts.telemetry === undefined ? current.artifacts.telemetry : artifacts.telemetry,
      result: artifacts.result === undefined ? current.artifacts.result : artifacts.result,
      changedAt: new Date(changedAt).toISOString(),
      revision: current.artifacts.revision + 1,
    };
    await persist([{
      entityType: 'execution',
      entityId: executionId,
      changes: [{ path: 'artifacts', operation: 'set', value: next }],
    }], next.changedAt);
    return structuredClone(find(executionId)!);
  };

  const deleteSessionNow = async (sessionId: string, changedAt = now().toISOString()): Promise<ExecutionRecord[]> => {
    input.assertWritable?.();
    if (!sessionId.trim()) throw new Error('invalid_task_execution_session_id');
    const selected = recordsFor('sessionIds', sessionId);
    if (selected.some((record) => !terminalPhases.has(record.lifecycle.phase))) {
      throw new Error(`task_execution_session_active:${sessionId}`);
    }
    if (!Number.isFinite(Date.parse(changedAt))) throw new Error('invalid_task_execution_timestamp');
    const deletedAt = new Date(changedAt).toISOString();
    const executionIds = selected.map((record) => record.metadata.executionId);
    await persist([
      ...executionIds.map((executionId): TaskEntityChange => ({
        entityType: 'execution',
        entityId: executionId,
        changes: [{ path: '$entity', operation: 'tombstone' }],
      })),
      {
        entityType: 'resource',
        entityId: `codex-session:${sessionId}`,
        changes: [
          { path: 'kind', operation: 'set', value: 'codex-session-deletion' },
          { path: 'sessionId', operation: 'set', value: sessionId },
          { path: 'deletedAt', operation: 'set', value: deletedAt },
          { path: 'executionIds', operation: 'set', value: executionIds },
        ],
      },
    ], deletedAt);
    return structuredClone(selected);
  };

  return {
    admit: (admission: Parameters<typeof admitNow>[0]): Promise<ExecutionRecord> => serial(() => admitNow(admission)),
    transition: (executionId: string, transition: Parameters<typeof transitionNow>[1]): Promise<ExecutionRecord> => serial(() => transitionNow(executionId, transition)),
    finalizeArtifacts: (executionId: string, artifacts: Parameters<typeof finalizeArtifactsNow>[1]): Promise<ExecutionRecord> => serial(() => finalizeArtifactsNow(executionId, artifacts)),
    deleteSession: (sessionId: string, changedAt?: string): Promise<ExecutionRecord[]> => serial(() => deleteSessionNow(sessionId, changedAt)),
    find: (executionId: string): ExecutionRecord | null => {
      const record = find(executionId);
      return record ? structuredClone(record) : null;
    },
    all: (): ExecutionRecord[] => {
      rebuild();
      return structuredClone(ordered(indexes.records.values()));
    },
    byTaskId: (taskId: string): ExecutionRecord[] => structuredClone(recordsFor('taskIds', taskId)),
    bySessionId: (sessionId: string): ExecutionRecord[] => structuredClone(recordsFor('sessionIds', sessionId)),
    byPipelineRunId: (pipelineRunId: string): ExecutionRecord[] => structuredClone(recordsFor('pipelineRunIds', pipelineRunId)),
    byPhase: (phase: TaskExecutionPhase): ExecutionRecord[] => structuredClone(recordsFor('phases', phase)),
    byExecutorNodeId: (nodeId: string): ExecutionRecord[] => structuredClone(recordsFor('executorNodeIds', nodeId)),
    findByRequest: (taskId: string, requestId: string): ExecutionRecord | null => {
      rebuild();
      const executionId = indexes.requests.get(requestKey(taskId, requestId));
      return executionId ? structuredClone(find(executionId)!) : null;
    },
    diagnostics: (): ExecutionDiagnostic[] => {
      rebuild();
      return structuredClone([...indexes.diagnostics.values()].sort((left, right) => left.executionId.localeCompare(right.executionId)));
    },
    rebuild: (): void => {
      indexes.root = '';
      rebuild();
    },
  };
}

export type TaskExecutionRepository = ReturnType<typeof createTaskExecutionRepository>;
export type ReplicatedTaskExecutionRecord = ExecutionRecord;
