/**
 * WHAT: Builds the compatibility runtime consumed by Codex controllers for one hosted project.
 * WHY: Task persistence, cancellation routing, and capacity admission must be owned outside the server composition closure.
 */
import { resolve } from 'node:path';
import type { CodexSlotAcquireOptions } from '../../codex/helper/codex-capacity-slots.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskProjectionCommand } from '../../task-state/helper/task-mutation-command.js';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { applyLedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import {
  materializeTaskMutationInputs,
  materializeTaskResources,
  TaskContentMaterializationError,
} from '../../federation/helper/materialize-task-mutation-inputs.js';
import { tasksLedgerForProject, type DecisionOsProject } from '../helper/project-catalog.js';
import { readDecisionOsSettings } from '../helper/read-decision-os-settings.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import { isExecutionScopedCodexFailure } from './incident-supervisor.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createTaskExecutionRouterRegistry } from '../../codex/runtime/task-execution-router-registry.js';
import type { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';

type AnyRecord = Record<string, unknown>;

export function createProjectControllerRuntime(input: {
  activeDecisionOsRoot: string;
  baseRuntime: AnyRecord;
  contentScheduler: () => ReturnType<typeof createFederationContentScheduler> | null;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
  invalidateProject: (projectId: string, changes?: readonly { entityType: string; entityId: string }[]) => void;
  masterDecisionOsRoot: string;
  pausedBackgroundComponents: { has: (component: string) => boolean };
  pausedTaskProjects: { has: (projectId: string) => boolean };
  processCoordinator: ReturnType<typeof createCodexProcessCoordinator>;
  project: () => DecisionOsProject | null;
  projectId: string;
  recordBackgroundFailure: (component: string, operation: string, error: unknown, context?: AnyRecord) => void;
  recordStoppedOperation: (input: AnyRecord) => void;
  routerRegistry: ReturnType<typeof createTaskExecutionRouterRegistry>;
  serverCloseSignal: AbortSignal;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  taskStateOverride?: ProjectTaskState | null;
  tryStateForProject: (project: DecisionOsProject) => ProjectTaskState | null;
}): { activeTaskState: ProjectTaskState | null; runtime: AnyRecord } {
  const runtime = input.activeDecisionOsRoot === input.masterDecisionOsRoot
    ? Object.assign(input.baseRuntime, {
      decisionOsRoot: input.activeDecisionOsRoot,
      projectId: input.projectId,
    })
    : Object.assign({}, input.baseRuntime, {
      decisionOsRoot: input.activeDecisionOsRoot,
      projectId: input.projectId,
    });
  const component = `codex-runtime:${input.projectId}`;
  runtime.codexRuntimePaused = input.pausedBackgroundComponents.has(component);
  runtime.onCodexBackgroundError = (event: AnyRecord): void => {
    const reported = event.error;
    const error = reported instanceof Error
      ? reported
      : new Error(String(reported ?? 'Unknown Codex background failure.'));
    const operation = String(event.operation ?? 'project-canonical-codex-execution');
    const context = event.context && typeof event.context === 'object'
      ? event.context as AnyRecord
      : {};
    if (isExecutionScopedCodexFailure(operation)) {
      const identity = String(context.executionId ?? context.runId ?? 'unknown');
      input.recordStoppedOperation({
        scope: `codex-execution:${input.projectId}:${identity}`,
        component: 'codex-execution',
        operation,
        error,
        context: {
          projectId: input.projectId,
          decisionOsRoot: input.activeDecisionOsRoot,
          ...context,
        },
      });
      return;
    }
    if (isTaskStateBootstrapGate(reported)) {
      runtime.taskStatePersistenceError = error.message;
      input.recordStoppedOperation({
        scope: `project-task-write:${input.projectId}`,
        component,
        operation,
        error,
        context: {
          projectId: input.projectId,
          decisionOsRoot: input.activeDecisionOsRoot,
          ...context,
        },
      });
      return;
    }
    runtime.codexRuntimePaused = true;
    input.recordBackgroundFailure(component, operation, error, {
      projectId: input.projectId,
      decisionOsRoot: input.activeDecisionOsRoot,
      ...context,
    });
  };
  if (input.activeDecisionOsRoot !== input.masterDecisionOsRoot) {
    readDecisionOsSettings({
      action_payload: { decisionOsRoot: input.activeDecisionOsRoot },
      runtime_state: runtime,
    });
  }
  runtime.globalCodexProcessCapacity = input.processCoordinator.capacity;
  runtime.globalCodexRunningProcessCount = input.processCoordinator.runningCount;
  runtime.globalCodexQueuePosition = input.processCoordinator.queuePosition;
  runtime.acquireProjectSyncCodexSlot = (options: CodexSlotAcquireOptions = {}) => (
    input.processCoordinator.sharedCapacitySlots.acquire({
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, input.serverCloseSignal])
        : input.serverCloseSignal,
    })
  );
  const requiredProject = (available = false): DecisionOsProject => {
    const project = input.project();
    if (!project || (available && !project.available)) {
      throw new Error(`Task-state authority has no ${available ? 'available ' : ''}project ${input.projectId}.`);
    }
    return project;
  };
  runtime.persistTaskLedgerProjection = async (
    ledger: AnyRecord,
    command: TaskProjectionCommand,
  ): Promise<{ ledger: AnyRecord }> => (
    input.stateForProject(requiredProject()).executeProjectionCommand(command, ledger)
  );
  runtime.readTaskLedgerProjection = (): AnyRecord => (
    input.stateForProject(requiredProject()).projection().ledger
  );
  const awaitTaskContentReady = async (): Promise<void> => {
    const ready = await Promise.resolve(runtime.taskContentReady ?? true);
    // WHAT: Reject task writes when startup content reconciliation exhausted its bounded publication attempts.
    // WHY: Admitting against a stale head would overwrite the preserved external Markdown edit.
    if (ready !== true) throw new Error('task_content_reconciliation_failed');
  };
  runtime.materializeTaskResources = async (
    keys: string[],
    validate?: (key: string, body: string) => void | Promise<void>,
  ): Promise<void> => {
    await awaitTaskContentReady();
    const project = requiredProject(true);
    await materializeTaskResources({
      projectId: input.projectId,
      decisionOsRoot: project.decisionOsRoot,
      keys,
      store: input.stateForProject(project).store,
      contentStore: input.contentStore,
      drain: input.contentScheduler()?.drain ?? null,
      validate,
    });
  };
  runtime.persistTaskLedgerMutation = async (mutation: LedgerMutation): Promise<{ ledger: AnyRecord }> => {
    await awaitTaskContentReady();
    const project = requiredProject(true);
    const state = input.stateForProject(project);
    const ledgerPath = resolve(
      project.decisionOsRoot,
      tasksLedgerForProject(project).ledgerFile.replace(/^\.decision-os\//, ''),
    );
    const execute = () => state.executePreparedMutation(mutation, async (before) => {
      await materializeTaskMutationInputs({
        projectId: input.projectId,
        decisionOsRoot: project.decisionOsRoot,
        ledger: before,
        mutation,
        store: state.store,
        contentStore: input.contentStore,
        drain: input.contentScheduler()?.drain ?? null,
      });
      const after = structuredClone(before);
      const result = applyLedgerMutation({
        decisionOsRoot: project.decisionOsRoot,
        ledgerPath,
        ledger: after,
        mutation,
      });
      // WHAT: Reject a task command whose Markdown mutation could not produce a complete successor document.
      // WHY: The serialized transaction must not publish partial structural state after a content mutation failure.
      if (result.error) throw new Error(String(result.error.body.error ?? 'Task ledger mutation failed.'));
      return { after, changedContentFiles: result.changedContentFiles };
    });
    let committed: Awaited<ReturnType<typeof execute>>;
    try {
      committed = await execute();
    } catch (error) {
      // WHAT: Flush one exact observed external edit before retrying a local content mismatch.
      // WHY: The filesystem event can still be inside its bounded debounce when the task command reaches materialization.
      if (error instanceof TaskContentMaterializationError && error.code === 'task_content_local_mismatch') {
        const flushTaskContentFile = runtime.flushTaskContentFile;
        const file = resolve(project.decisionOsRoot, error.key.replace(/^\/?\.decision-os\//, ''));
        const flushed = typeof flushTaskContentFile === 'function'
          ? await flushTaskContentFile(file)
          : { observed: false, settled: false };
        // WHAT: Retry the complete command once after a successful exact flush or a possible just-settled observation.
        // WHY: Publication can leave the pending map between mismatch detection and flush lookup; a stale head still rejects again.
        if ((flushed.observed === true && flushed.settled === true) || flushed.observed === false) committed = await execute();
        else throw error;
      // WHAT: Reconcile a conflicted thread only when the preserved local document proves it is a lossless superset of every retained candidate.
      // WHY: Common cross-node append races must recover automatically without choosing through same-note divergence.
      } else if (error instanceof TaskContentMaterializationError && error.code === 'task_content_conflict') {
        const reconciled = await state.reconcileSupersetThreadContentConflict(error.key);
        // WHAT: Retry the complete serialized command once after a causal superset reconciliation.
        // WHY: The original attempt made no mutation, while the replacement head now observes every prior candidate.
        if (reconciled) committed = await execute();
        else throw error;
      } else {
        throw error;
      }
    }
    // WHAT: Invalidate project reads only when the serialized causal transaction changed authoritative state.
    // WHY: No-op task commands must not trigger redundant project reloads.
    if (committed.changed) input.invalidateProject(input.projectId, committed.localChanges);
    return { ledger: committed.ledger };
  };
  const project = input.projectId ? requiredProject() : null;
  const nodeId = String(input.federation()?.localOwner().ownerNodeId
    ?? (runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId
    ?? (input.baseRuntime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId
    ?? 'local').trim() || 'local';
  Object.defineProperty(runtime, 'taskExecutionNodeId', {
    value: nodeId,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(runtime, 'routeTaskExecutionCancellation', {
    value: async (executionId: string, executorNodeId: string) => {
      const federation = input.federation();
      if (!federation?.nodes().some((peer) => peer.nodeId === executorNodeId && peer.online)) {
        return { ok: false, statusCode: 503, error: 'assigned_node_unreachable', executionId, executorNodeId };
      }
      const remote = await federation.request(
        executorNodeId,
        `/api/internal/task-executions/${encodeURIComponent(executionId)}/cancel`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: Buffer.from(JSON.stringify({ projectId: input.projectId })),
        },
      );
      try {
        return { ...JSON.parse(remote.body.toString('utf8') || '{}') as AnyRecord, statusCode: remote.status };
      } catch {
        return {
          ok: false,
          statusCode: 502,
          error: 'task_execution_remote_response_invalid',
          executionId,
          executorNodeId,
        };
      }
    },
    configurable: true,
    enumerable: false,
  });
  const activeTaskState = input.taskStateOverride
    ?? (project && !input.pausedTaskProjects.has(input.projectId)
      ? input.tryStateForProject(project)
      : null);
  if (activeTaskState && project) {
    Object.defineProperty(runtime, 'taskExecutionRouter', {
      value: input.routerRegistry.forProject(project),
      configurable: true,
      enumerable: false,
    });
    Object.defineProperty(runtime, 'taskExecutionState', {
      value: activeTaskState,
      configurable: true,
      enumerable: false,
    });
    Object.defineProperty(runtime, 'taskExecutionArtifactFile', {
      value: (hash: string) => /^[a-f0-9]{64}$/i.test(hash)
        ? resolve(activeTaskState.store.root, 'objects', hash.slice(0, 2), hash)
        : '',
      configurable: true,
      enumerable: false,
    });
  }
  return { activeTaskState, runtime };
}
