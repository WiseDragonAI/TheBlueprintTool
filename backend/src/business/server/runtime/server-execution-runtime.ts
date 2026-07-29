/**
 * WHAT: Constructs local, federated, Codex, and project execution capabilities.
 * WHY: Execution ownership and its late-bound transport callbacks must not live in the HTTP composition root.
 */
import type { ServerResponse } from 'node:http';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import { createTaskExecutionRouterRegistry } from '../../codex/runtime/task-execution-router-registry.js';
import { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import type { TaskEntityChange, TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { createFederatedTaskRuntime } from '../../task-state/runtime/federated-task-runtime.js';
import { createLocalTaskRuntime } from '../../task-state/runtime/local-task-runtime.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import type { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import type { RuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import { isExecutionScopedCodexFailure, type IncidentSupervisor } from './incident-supervisor.js';
import { createProjectRuntimeRegistry } from './project-runtime-registry.js';

type AnyRecord = Record<string, unknown>;
type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;

export function createServerExecutionRuntime(input: {
  baseRuntime: AnyRecord;
  contentScheduler: () => ReturnType<typeof createFederationContentScheduler> | null;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  federatedSchedulerContexts: Map<string, { root: string; runtime: AnyRecord }>;
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
  globalClients: Set<ServerResponse>;
  incidentLedger: RuntimeIncidentLedger;
  incidentSupervisor: IncidentSupervisor;
  invalidateProject: (
    projectId: string,
    entities?: readonly { entityType: string; entityId: string }[],
  ) => void;
  masterDecisionOsRoot: string;
  migrationAdmissionForProject: (projectId: string) => AnyRecord | null;
  presentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  projectCatalogStore: ReturnType<typeof createProjectCatalogStore>;
  publishPipelineSnapshot: (
    projectId: string,
    pipelineRunId: string,
    executionId: string,
  ) => void;
  replicator: () => ReturnType<typeof createFederationTaskStateReplicator> | null;
  scheduleAutomaticRecovery: (project: DecisionOsProject) => void;
  serverClosing: () => boolean;
  serverCloseSignal: AbortSignal;
}) {
  const localNodeId = (): string => input.federation()?.localOwner().ownerNodeId
    ?? String(
      (input.baseRuntime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId
      ?? 'local',
    );
  const publishExecutionChange = (change: {
    projectId: string;
    nodeId: string;
    executionId: string;
    record: ReturnType<ProjectTaskState['executions']['find']>;
    remote?: boolean;
  }): void => {
    input.invalidateProject(change.projectId, [{
      entityType: 'execution',
      entityId: change.executionId,
    }]);
    const payload = {
      remote: change.remote === true,
      projectId: change.projectId,
      nodeId: change.nodeId,
      executionId: change.executionId,
      taskId: change.record?.metadata.taskId ?? '',
      sourceCardId: change.record?.metadata.sourceCardId ?? '',
      phase: change.record?.lifecycle.phase ?? 'deleted',
      phaseSince: change.record?.lifecycle.phaseSince ?? '',
      revision: change.record?.lifecycle.revision ?? 0,
      executorNodeId: change.record?.lifecycle.executorNodeId ?? '',
    };
    for (const client of input.globalClients) {
      try {
        client.write(`event: codex-execution-change\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // A disconnected event client cannot fail the committed execution transition.
      }
    }
    const pipelineRunId = change.record?.metadata.pipelineRunId;
    if (pipelineRunId) {
      input.publishPipelineSnapshot(change.projectId, pipelineRunId, change.executionId);
    }
  };

  const localTaskRuntime = createLocalTaskRuntime({
    federationNodeId: localNodeId,
    incidentLedger: input.incidentLedger,
    incidentSupervisor: input.incidentSupervisor,
    invalidateProject: input.invalidateProject,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    migrationAdmissionForProject: input.migrationAdmissionForProject,
    onExecutionChange: (project, executionId, record) => publishExecutionChange({
      projectId: project.id,
      nodeId: localNodeId(),
      executionId,
      record,
    }),
    publishContentChange: () => input.federation()?.publishContentChange(),
    publishDelta: (delta: TaskStateDelta) => input.replicator()?.publishDelta(delta),
    replicationAvailable: () => Boolean(input.replicator()),
    scheduleAutomaticRecovery: input.scheduleAutomaticRecovery,
    serverCloseSignal: input.serverCloseSignal,
  });

  let processCoordinator!: ReturnType<typeof createCodexProcessCoordinator>;
  const routerRegistry = createTaskExecutionRouterRegistry({
    capacity: () => processCoordinator.capacity(),
    federation: input.federation,
    incidentSupervisor: input.incidentSupervisor,
    invalidateProject: (projectId, entities) => input.invalidateProject(projectId, entities),
    localNodeId,
    localTaskRuntime,
    schedule: () => processCoordinator.schedule(),
  });
  const federatedTaskRuntime = createFederatedTaskRuntime({
    incidentLedger: input.incidentLedger,
    incidentSupervisor: input.incidentSupervisor,
    localNodeId,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    onExecutionChange: (projectId, executionId, record) => publishExecutionChange({
      projectId,
      nodeId: localNodeId(),
      executionId,
      record,
    }),
    publishContentChange: () => input.federation()?.publishContentChange(),
    publishDelta: (delta) => input.replicator()?.publishDelta(delta),
    reconcileProject: (projectId) => input.replicator()?.reconcileProject('relay', projectId),
  });

  let projectRuntimeRegistry: ReturnType<typeof createProjectRuntimeRegistry> | null = null;
  processCoordinator = createCodexProcessCoordinator({
    contexts: () => [
      ...[...(projectRuntimeRegistry?.contexts.entries() ?? [])].map(([root, context]) => ({
        root,
        runtime: context.runtime,
      })),
      ...input.federatedSchedulerContexts.values(),
    ],
    incidentSupervisor: input.incidentSupervisor,
    runtime: input.baseRuntime,
  });
  projectRuntimeRegistry = createProjectRuntimeRegistry({
    baseRuntime: input.baseRuntime,
    contentScheduler: input.contentScheduler,
    contentStore: input.contentStore,
    federation: input.federation,
    globalClients: input.globalClients,
    incidentLedger: input.incidentLedger,
    invalidateProject: input.invalidateProject,
    isExecutionScopedFailure: isExecutionScopedCodexFailure,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    pausedBackgroundComponents: input.incidentSupervisor.pausedBackgroundComponents,
    pausedProjectRuntimes: input.incidentSupervisor.pausedProjectRuntimes,
    pausedProjectWatchers: input.incidentSupervisor.pausedProjectWatchers,
    pausedTaskProjects: input.incidentSupervisor.pausedTaskProjects,
    presentations: input.presentations,
    processCoordinator,
    projectCatalogStore: input.projectCatalogStore,
    publishPipelineSnapshot: input.publishPipelineSnapshot,
    recordBackgroundFailure: input.incidentSupervisor.recordBackgroundFailure,
    recordContentFailure: localTaskRuntime.recordBackgroundFailure,
    recordIncident: input.incidentSupervisor.recordIncident,
    recordStoppedOperation: input.incidentSupervisor.recordStoppedOperation,
    routerRegistry,
    scheduleCodex: processCoordinator.schedule,
    serverCloseSignal: input.serverCloseSignal,
    serverClosing: input.serverClosing,
    stateForProject: localTaskRuntime.stateForProject,
    tryStateForProject: localTaskRuntime.tryStateForProject,
  });

  const taskStoreForProject = (
    projectId: string,
    ownerNodeId = '',
  ): TaskCurrentStateStore | null => {
    if (input.incidentSupervisor.pausedTaskProjects.has(projectId)) return null;
    const local = localTaskRuntime.states.get(projectId)?.store;
    if (local) return local;
    const project = input.projectCatalogStore.projects()
      .find((entry) => entry.id === projectId && entry.available);
    if (project) return localTaskRuntime.tryStateForProject(project)?.store ?? null;
    return federatedTaskRuntime.storeForProject(projectId, ownerNodeId);
  };
  const executionStateForProject = (
    projectId: string,
    ownerNodeId: string,
  ): ExecutionState | null => {
    const project = input.projectCatalogStore.projects()
      .find((entry) => entry.id === projectId && entry.available);
    return project
      ? localTaskRuntime.tryStateForProject(project)
      : federatedTaskRuntime.executionStateForProject(projectId, ownerNodeId);
  };

  return {
    executionStateForProject,
    federatedTaskRuntime,
    localTaskRuntime,
    processCoordinator,
    projectRuntimeRegistry,
    publishExecutionChange,
    routerRegistry,
    taskStoreForProject,
  };
}
