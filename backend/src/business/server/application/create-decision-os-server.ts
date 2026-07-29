/**
 * WHAT: Creates the Decision OS HTTP server, workspace routes, and scoped content event stream.
 * WHY: Ledger IO, SSE publication, and Codex process callbacks share one server lifecycle for the active workspace.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from '../helper/resolve-decision-os-root.js';
import { normalizeLedgerNotes } from '../helper/normalize-ledger-notes.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { resolveCardContentChange, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';
import { watchProjectFiles } from '../../refresh/helper/watch-project-files.js';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { createLedgerRevisionTracker } from '../helper/create-ledger-revision-tracker.js';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { readCodexPipelineRunController } from '../../codex/controller/read-codex-pipeline-run-controller.js';
import { unifiedCodexQueuePosition } from '../../codex/helper/codex-process-scheduler.js';
import {
  taskExecutionNodeId,
  taskExecutionState,
} from '../../codex/helper/task-execution-runtime.js';
import { buildTaskExecutionPresentation } from '../../codex/helper/task-execution-presentation.js';
import { taskExecutionPresentationHttpResult } from '../../codex/helper/task-execution-presentation-http-result.js';
import { replicatedCardSkillRunStatus } from '../../codex/helper/replicated-card-skill-run-status.js';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { TaskEntityChange } from '../../task-state/helper/task-current-state-types.js';
import { resolveCatalogProject, tasksLedgerId, type DecisionOsProject } from '../helper/project-catalog.js';
import { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint, parseProjectUrlScope } from '../helper/project-url-scope.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import { ledgerCardProjection, ledgerThreadProjection } from '../helper/ledger-read-models.js';
import { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import { NodeReleaseError } from '../../delivery/helper/node-release-store.js';
import { materializeTaskMutationInputs, TaskContentMaterializationError } from '../../federation/helper/materialize-task-mutation-inputs.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { createRuntimeIncidentLedger, RuntimeScopePausedError } from '../helper/runtime-incident-ledger.js';
import { createRuntimeIncidentReviewScheduler } from '../helper/create-runtime-incident-review-scheduler.js';
import { runtimeIncidentReviewProjectId } from '../helper/synchronize-runtime-incident-review-task.js';
import { exportFederatedPipelineSnapshot } from '../../federation/helper/federated-library-cache.js';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import { migrateLegacyProjectPipelines } from '../../codex/helper/server-pipeline-catalog.js';
import { tryServeDecisionOsAsset } from '../http/decision-os-asset-handler.js';
import { serveStaticApplication } from '../http/static-application-handler.js';
import { handleProjectCatalogRoutes } from '../http/project-catalog-routes.js';
import { handleSettingsRoutes } from '../http/settings-routes.js';
import { handleTranscriptionRoutes } from '../../transcription/http/transcription-routes.js';
import { handleThreadUploadRoutes } from '../../transcription/http/thread-upload-routes.js';
import { handleGitReviewRoutes } from '../../git-review/http/git-review-routes.js';
import { handleContentEventRoutes } from '../http/content-event-routes.js';
import {
  createIncidentSupervisor,
  isExecutionScopedCodexFailure,
} from '../runtime/incident-supervisor.js';
import { handleOperationalRoutes } from '../http/operational-routes.js';
import { createNodeHttpListener } from '../http/create-node-http-listener.js';
import { handleControlRoomRoutes } from '../http/control-room-routes.js';
import { handleDiagnosticReadRoutes } from '../http/diagnostic-routes.js';
import { handleCodexPipelineRoutes } from '../../codex/http/pipeline-routes.js';
import { handleCodexSkillLibraryRoutes } from '../../codex/http/skill-library-routes.js';
import { handleCodexSkillRunRoutes } from '../../codex/http/skill-run-routes.js';
import { createLocalTaskRuntime } from '../../task-state/runtime/local-task-runtime.js';
import { createTaskExecutionRouterRegistry } from '../../codex/runtime/task-execution-router-registry.js';
import { createFederatedTaskRuntime } from '../../task-state/runtime/federated-task-runtime.js';
import { handleTaskStateRoutes } from '../../task-state/http/task-state-routes.js';
import { handleFederationContentRoutes } from '../../federation/http/content-routes.js';
import { handleFederatedLibraryRoutes } from '../../federation/http/library-routes.js';
import { handleNodeMessageRoutes } from '../../federation/http/node-message-routes.js';
import { handleProjectSyncRoutes } from '../../project-sync/http/project-sync-routes.js';
import { executeFederatedProjectSyncRole } from '../../project-sync/runtime/execute-federated-project-sync-role.js';
import { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import { handleLedgerReadRoutes } from '../../ledger/http/ledger-read-routes.js';
import { handleCardContentRoutes } from '../../ledger/http/card-content-routes.js';
import { handleTaskExecutionReadRoutes } from '../../codex/http/task-execution-read-routes.js';
import { handleInternalTaskExecutionRoutes } from '../../codex/http/internal-task-execution-routes.js';
import { handleFederatedExecutionAdmissionRoutes } from '../../codex/http/federated-execution-admission-routes.js';
import { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import { handleDeliveryRoutes } from '../../delivery/http/delivery-routes.js';
import { handleRuntimeRecoveryRoute } from '../http/runtime-recovery-route.js';
import { handleLegacyLedgerRoutes } from '../../ledger/http/legacy-ledger-routes.js';
import { createLedgerPersistence } from '../../ledger/runtime/ledger-persistence.js';
import { handleMarkdownTargetRoutes } from '../../content-authoring/http/markdown-target-routes.js';
import {
  buildDeliveryAdmissionState,
  buildDeliveryStatusEvidence,
} from '../../delivery/runtime/delivery-admission-state.js';
import { createDeliveryNodeRuntime } from '../../delivery/runtime/delivery-node-runtime.js';
import { createFederatedLibraryRuntime } from '../../federation/runtime/federated-library-runtime.js';
import { handleRemoteProjectGateway } from '../../federation/http/remote-project-gateway.js';
import { createFederatedExecutionObservationHandler } from '../../federation/runtime/federated-execution-observation-handler.js';
import { createProjectRuntimeRegistry } from '../runtime/project-runtime-registry.js';
import { createRuntimeRecoveryService } from '../runtime/runtime-recovery-service.js';

type AnyRecord = Record<string, unknown>;
type MutationError = { statusCode: number; body: AnyRecord };

const federationNodeMessageTimeoutMs = 30 * 60_000;
function safeAssetSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function ledgerSlug(value: unknown): string {
  return safeAssetSegment(String(value || 'New Ledger').toLowerCase()).slice(0, 80) || 'new-ledger';
}

function projectNameForDecisionOsRoot(decisionOsRoot: string): string {
  return basename(dirname(decisionOsRoot)) || 'Project';
}

export function createDecisionOsServer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('create-http-server', { role: 'helper', action: 'create-http-server' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const port = Number(payload.port ?? runtime.port ?? 0);
  const configuredFrontendRoot = payload.decisionOsFrontendRoot ?? payload.frontendRoot ?? process.env.DECISION_OS_FRONTEND_ROOT ?? runtime.decisionOsFrontendRoot;
  const frontendRoot = configuredFrontendRoot
    ? resolve(String(configuredFrontendRoot))
    : existsSync(resolve(process.cwd(), 'frontend'))
      ? resolve(process.cwd(), 'frontend')
      : resolve(process.cwd(), '..', 'frontend');
  const masterDecisionOsRoot = resolveDecisionOsRoot({ action_payload: payload, runtime_state: runtime });
  const masterRoot = dirname(masterDecisionOsRoot);
  const decisionOsRoot = masterDecisionOsRoot;
  const migrationAdmissionFile = resolve(masterDecisionOsRoot, 'runtime', 'epoch-4-migration-admission.json');
  let migrationAdmission: AnyRecord | null = null;
  if (existsSync(migrationAdmissionFile)) {
    try { migrationAdmission = JSON.parse(readFileSync(migrationAdmissionFile, 'utf8')) as AnyRecord; }
    catch (error) { migrationAdmission = { phase: 'invalid', error: error instanceof Error ? error.message : String(error) }; }
  }
  const migrationAdmissionBlocked = Boolean(migrationAdmission && !['verified', 'rolled-back'].includes(String(migrationAdmission.phase ?? '')));
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: masterDecisionOsRoot });
  runtime.decisionOsRoot = masterDecisionOsRoot;
  runtime.serverRoot = masterRoot;
  runtime.port = port;
  runtime.ledgerCliShimDirectory = ensureLedgerCliShim({
    masterDecisionOsRoot,
    launcher: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../bin/ledger-cli.mjs'),
  });
  if (payload.mode === 'dry-run') {
    return { ok: true, port, server: { listening: false, port } };
  }
  const globalContentEventClients = new Set<ServerResponse>();
  let projectRuntimeRegistry: ReturnType<typeof createProjectRuntimeRegistry> | null = null;
  const federatedSchedulerContexts = new Map<string, { root: string; runtime: AnyRecord }>();
  const projectCatalogStore = createProjectCatalogStore({ masterRoot, masterDecisionOsRoot });
  let controlRoomProjectionStore: ReturnType<typeof createControlRoomProjectionStore> | null = null;
  let federation: ReturnType<typeof createFederationNodeConnector> | null = null;
  let federationTaskStateReplicator: ReturnType<typeof createFederationTaskStateReplicator> | null = null;
  let resumeProjectSyncRuntime: (() => void) | null = null;
  const federationContentStore = createFederationContentReplicaStore({ decisionOsRoot: masterDecisionOsRoot });
  let federationContentScheduler: ReturnType<typeof createFederationContentScheduler> | null = null;
  type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;
  const federatedExecutionObservations = new Map<string, TaskExecutionObservation>();
  const executionPresentations = createTaskExecutionPresentationRegistry({
    contentStore: federationContentStore,
    federation: () => federation,
  });
  const federatedPipelinePresentations = new Map<string, AnyRecord>();
  let serverClosing = false;
  const serverCloseAbort = new AbortController();
  let publishPipelineRunSnapshot = (
    _projectId: string,
    _pipelineRunId: string,
    _executionId: string,
  ): void => {};

  const incidentSupervisor = createIncidentSupervisor({ incidentLedger });
  const {
    assertCodexRuntimeAvailable,
    pauseGlobalRuntime,
    pauseTaskProject,
    pausedBackgroundComponents,
    pausedProjectRuntimes,
    pausedProjectWatchers,
    pausedTaskProjects,
    recordBackgroundFailure,
    recordIncident,
    recordStoppedOperation,
  } = incidentSupervisor;
  const onUncaughtException = (error: Error): void => pauseGlobalRuntime(error, 'uncaught-exception');
  const onUnhandledRejection = (reason: unknown): void => pauseGlobalRuntime(reason, 'unhandled-rejection');
  process.on('uncaughtException', onUncaughtException);
  process.on('unhandledRejection', onUnhandledRejection);

  const publishExecutionChange = (input: {
    projectId: string;
    nodeId: string;
    executionId: string;
    record: ReturnType<ProjectTaskState['executions']['find']>;
    remote?: boolean;
  }): void => {
    controlRoomProjectionStore?.invalidate(input.projectId, [{ entityType: 'execution', entityId: input.executionId }]);
    const payload = {
      remote: input.remote === true,
      projectId: input.projectId,
      nodeId: input.nodeId,
      executionId: input.executionId,
      taskId: input.record?.metadata.taskId ?? '',
      sourceCardId: input.record?.metadata.sourceCardId ?? '',
      phase: input.record?.lifecycle.phase ?? 'deleted',
      phaseSince: input.record?.lifecycle.phaseSince ?? '',
      revision: input.record?.lifecycle.revision ?? 0,
      executorNodeId: input.record?.lifecycle.executorNodeId ?? '',
    };
    for (const client of globalContentEventClients) {
      try { client.write(`event: codex-execution-change\ndata: ${JSON.stringify(payload)}\n\n`); } catch {
        // A disconnected event client cannot fail the committed execution transition.
      }
    }
    if (input.record?.metadata.pipelineRunId) {
      publishPipelineRunSnapshot(input.projectId, input.record.metadata.pipelineRunId, input.executionId);
    }
  };


  const localTaskRuntime = createLocalTaskRuntime({
    federationNodeId: () => federation?.localOwner().ownerNodeId
      ?? String((runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId ?? 'local'),
    incidentLedger,
    incidentSupervisor,
    invalidateProject: (projectId, entities) => controlRoomProjectionStore?.invalidate(
      projectId,
      entities ? [...entities] : undefined,
    ),
    masterDecisionOsRoot,
    migrationAdmission,
    migrationAdmissionBlocked,
    onExecutionChange: (project, executionId, record) => publishExecutionChange({
      projectId: project.id,
      nodeId: federation?.localOwner().ownerNodeId ?? 'local',
      executionId,
      record,
    }),
    publishContentChange: () => federation?.publishContentChange(),
    publishDelta: (delta) => federationTaskStateReplicator?.publishDelta(delta),
    replicationAvailable: () => Boolean(federationTaskStateReplicator),
    serverCloseSignal: serverCloseAbort.signal,
  });
  const projectTaskStates = localTaskRuntime.states;
  const taskStateForProject = localTaskRuntime.stateForProject;
  const tryTaskStateForProject = localTaskRuntime.tryStateForProject;
  const taskProjectionForProject = localTaskRuntime.projectionForProject;
  const recordProjectBackgroundFailure = localTaskRuntime.recordBackgroundFailure;

  const taskExecutionRouterRegistry = createTaskExecutionRouterRegistry({
    capacity: () => globalCodexProcessCapacity(),
    federation: () => federation,
    incidentSupervisor,
    invalidateProject: (projectId, entities) => controlRoomProjectionStore?.invalidate(
      projectId,
      [...entities],
    ),
    localNodeId: () => federation?.localOwner().ownerNodeId
      ?? String((runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId ?? 'local'),
    localTaskRuntime,
    schedule: () => scheduleGlobalCodexProcesses(),
  });
  const taskExecutionRouters = taskExecutionRouterRegistry.routers;
  const taskExecutionRouterForProject = taskExecutionRouterRegistry.forProject;
  const federatedTaskRuntime = createFederatedTaskRuntime({
    incidentSupervisor,
    localNodeId: () => federation?.localOwner().ownerNodeId ?? 'local',
    masterDecisionOsRoot,
    onExecutionChange: (projectId, executionId, record) => publishExecutionChange({
      projectId,
      nodeId: federation?.localOwner().ownerNodeId ?? 'local',
      executionId,
      record,
    }),
    publishContentChange: () => federation?.publishContentChange(),
    publishDelta: (delta) => federationTaskStateReplicator?.publishDelta(delta),
  });
  const federatedTaskStores = federatedTaskRuntime.taskStores;
  const federatedProjectTaskStates = federatedTaskRuntime.projectStates;
  const federatedTaskRevisions = federatedTaskRuntime.revisions;
  const federatedExecutionStates = federatedTaskRuntime.executionStates;
  const federatedTaskStoreForProject = federatedTaskRuntime.storeForProject;
  const federatedTaskStateForProject = federatedTaskRuntime.stateForProject;
  const federatedTaskRevisionForProject = federatedTaskRuntime.revisionForProject;
  const taskStoreForProject = (projectId: string, ownerNodeId = ''): TaskCurrentStateStore | null => {
    if (pausedTaskProjects.has(projectId)) return null;
    const local = projectTaskStates.get(projectId)?.store;
    if (local) return local;
    const project = projectCatalogStore.projects()
      .find((entry) => entry.id === projectId && entry.available);
    if (project) return tryTaskStateForProject(project)?.store ?? null;
    return federatedTaskStoreForProject(projectId, ownerNodeId);
  };
  const executionStateForProject = (projectId: string, ownerNodeId: string): ExecutionState | null => {
    const project = projectCatalogStore.projects()
      .find((entry) => entry.id === projectId && entry.available);
    return project
      ? tryTaskStateForProject(project)
      : federatedTaskRuntime.executionStateForProject(projectId, ownerNodeId);
  };
  const codexProcessCoordinator = createCodexProcessCoordinator({
    contexts: () => [
      ...[...(projectRuntimeRegistry?.contexts.entries() ?? [])].map(([root, context]) => ({
        root,
        runtime: context.runtime,
      })),
      ...federatedSchedulerContexts.values(),
    ],
    incidentSupervisor,
    runtime,
  });
  const globalCodexProcessCapacity = codexProcessCoordinator.capacity;
  const globalCodexRunningProcessCount = codexProcessCoordinator.runningCount;
  const globalCodexQueuePosition = codexProcessCoordinator.queuePosition;
  const scheduleGlobalCodexProcesses = codexProcessCoordinator.schedule;
  const sharedCodexCapacitySlots = codexProcessCoordinator.sharedCapacitySlots;
  projectRuntimeRegistry = createProjectRuntimeRegistry({
    baseRuntime: runtime,
    contentScheduler: () => federationContentScheduler,
    contentStore: federationContentStore,
    federation: () => federation,
    globalClients: globalContentEventClients,
    incidentLedger,
    invalidateProject: (projectId, changes) => controlRoomProjectionStore?.invalidate(
      projectId,
      changes ? [...changes] as TaskEntityChange[] : undefined,
    ),
    isExecutionScopedFailure: isExecutionScopedCodexFailure,
    masterDecisionOsRoot,
    pausedBackgroundComponents,
    pausedProjectRuntimes,
    pausedProjectWatchers,
    pausedTaskProjects,
    presentations: executionPresentations,
    processCoordinator: codexProcessCoordinator,
    projectCatalogStore,
    publishPipelineSnapshot: (...args) => publishPipelineRunSnapshot(...args),
    recordBackgroundFailure,
    recordContentFailure: recordProjectBackgroundFailure,
    recordIncident,
    recordStoppedOperation,
    routerRegistry: taskExecutionRouterRegistry,
    scheduleCodex: scheduleGlobalCodexProcesses,
    serverCloseSignal: serverCloseAbort.signal,
    serverClosing: () => serverClosing,
    stateForProject: taskStateForProject,
    tryStateForProject: tryTaskStateForProject,
  });
  const projectContexts = projectRuntimeRegistry.contexts;
  const projectContext = projectRuntimeRegistry.context;
  const disposeProjectContext = projectRuntimeRegistry.dispose;
  const startupProjectTasks = projectRuntimeRegistry.startupTasks;
  publishPipelineRunSnapshot = (projectId, pipelineRunId, executionId): void => {
    const localProject = projectCatalogStore.projects().find((project) => project.id === projectId && project.available);
    const pipelineRuntime = localProject ? projectContexts.get(localProject.decisionOsRoot)?.runtime : null;
    if (!localProject || !pipelineRuntime || !federation || !pipelineRunId) return;
    void readCodexPipelineRunController({
      action_payload: { runId: pipelineRunId },
      runtime_state: pipelineRuntime,
    }).then((result) => {
      if (result.ok !== true) return;
      federation?.publishExecutionObservation(projectId, {
        executionId,
        pipeline: { runId: pipelineRunId, result },
      });
    }).catch((error: unknown) => {
      recordStoppedOperation({
        scope: `pipeline-presentation-publish:${projectId}:${pipelineRunId}`,
        component: 'codex-pipeline-presentation',
        operation: 'publish-pipeline-presentation-snapshot',
        error,
        context: { projectId, pipelineRunId, executionId },
      });
    });
  };
  const tryProjectContext = projectRuntimeRegistry.tryContext;
  const migrateProjectPipelines = (): void => {
    migrateLegacyProjectPipelines({
      serverDecisionOsRoot: masterDecisionOsRoot,
      projectDecisionOsRoots: projectCatalogStore.projects()
        .filter((project) => project.available)
        .map((project) => project.decisionOsRoot),
    });
  };
  if (!pausedBackgroundComponents.has('pipeline-migration')) {
    try { migrateProjectPipelines(); }
    catch (error) { recordBackgroundFailure('pipeline-migration', 'migrate-legacy-project-pipelines', error); }
  }
  const projectCatalog = () => projectCatalogStore.projects();
  let federationServerPort = port;
  const localWorkspaceRoots = (): string[] => [
    masterRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.root),
  ];
  const localDecisionOsRoots = (): string[] => [
    masterDecisionOsRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.decisionOsRoot),
  ];
  const federatedLibraryRuntime = createFederatedLibraryRuntime({
    clearPaused: (component) => pausedBackgroundComponents.delete(component),
    federation: () => federation,
    incidentLedger,
    localDecisionOsRoots,
    localWorkspaceRoots,
    masterDecisionOsRoot,
    masterRoot,
    paused: (component) => pausedBackgroundComponents.has(component),
    recordBackgroundFailure,
    recordIncident,
    runtime,
  });
  if (!pausedBackgroundComponents.has('pipeline-catalog')) {
    try {
      federatedLibraryRuntime.initialize();
    } catch (error) {
      recordBackgroundFailure('pipeline-catalog', 'initialize-pipeline-catalog', error);
    }
  }
  const publishLocalExecutionPresentationSnapshots = (): void => {
    const localNodeId = federation?.localOwner().ownerNodeId ?? 'local';
    const pipelineRuns = new Map<string, { projectId: string; executionId: string }>();
    for (const [projectId, state] of [...projectTaskStates, ...federatedExecutionStates]) {
      for (const record of state.executions.all()) {
        if (record.lifecycle.executorNodeId !== localNodeId) {
          executionPresentations.hydrateTerminalArtifacts(
            projectId,
            record.lifecycle.executorNodeId,
            record,
            recordStoppedOperation,
          );
        }
        if (record.metadata.pipelineRunId) {
          pipelineRuns.set(record.metadata.pipelineRunId, { projectId, executionId: record.metadata.executionId });
        }
      }
    }
    for (const [pipelineRunId, identity] of pipelineRuns) {
      publishPipelineRunSnapshot(identity.projectId, pipelineRunId, identity.executionId);
    }
  };
  const handleFederatedExecutionObservation = createFederatedExecutionObservationHandler({
    clients: globalContentEventClients,
    executionObservations: federatedExecutionObservations,
    executionState: executionStateForProject,
    invalidateProject: (projectId) => controlRoomProjectionStore?.invalidate(projectId),
    pipelinePresentations: federatedPipelinePresentations,
    presentationRegistry: executionPresentations,
    recordStoppedOperation,
    sourceOwnsProject: (projectId, nodeId) => federation?.remoteProjects().some((project) => (
      project.ownerNodeId === nodeId && project.localProjectId === projectId
    )) === true,
  });
  federation = createFederationNodeConnector({
    settings: runtime.decisionOsSettings,
    localProjects: projectCatalog,
    localServerUrl: () => `http://127.0.0.1:${federationServerPort}`,
    catalogFile: resolve(masterDecisionOsRoot, 'cache', 'federation-project-catalog.json'),
    onRemoteContentChange: () => {
      for (const client of globalContentEventClients) client.write('event: ledger-content-change\ndata: {"remote":true}\n\n');
    },
    onRemoteCatalogChange: () => {
      for (const project of projectCatalog().filter((entry) => entry.available)) tryTaskStateForProject(project);
      controlRoomProjectionStore?.invalidate();
      federationTaskStateReplicator?.reconcileRelay();
      for (const project of federation?.remoteProjects().filter((entry) => entry.online) ?? []) {
        federationTaskStateReplicator?.reconcileProject(project.ownerNodeId, project.localProjectId);
      }
      publishLocalExecutionPresentationSnapshots();
      if (!pausedBackgroundComponents.has('federated-library-sync')) void federatedLibraryRuntime.synchronize()
        .catch(() => undefined);
      resumeProjectSyncRuntime?.();
    },
    onStateFrame: async (frame) => {
      try {
        await federationTaskStateReplicator?.handleFrame(frame);
        if (!pausedBackgroundComponents.has('codex-process-scheduler')) {
          void scheduleGlobalCodexProcesses().catch((error: unknown) => {
            recordBackgroundFailure('codex-process-scheduler', 'schedule-after-federated-state-frame', error, {
              projectId: frame.projectId,
              frameType: frame.type,
            });
          });
        }
        if (!pausedBackgroundComponents.has('federation-content-scheduler')) void federationContentScheduler?.drain()
          .catch((error: unknown) => recordBackgroundFailure('federation-content-scheduler', 'drain-after-state-frame', error, { projectId: frame.projectId, frameType: frame.type }));
      } catch (error) {
        recordStoppedOperation({
          scope: `federation-state-frame:${frame.projectId}:${frame.from}`,
          component: 'federation-task-state-replicator',
          operation: 'handle-state-frame',
          error,
          context: { projectId: frame.projectId, frameType: frame.type, from: frame.from },
        });
      }
    },
    onExecutionObservation: handleFederatedExecutionObservation,
    onStateConnected: () => {
      federationTaskStateReplicator?.reconcileRelay();
      for (const project of federation?.remoteProjects().filter((entry) => entry.online) ?? []) {
        federationTaskStateReplicator?.reconcileProject(project.ownerNodeId, project.localProjectId);
      }
      publishLocalExecutionPresentationSnapshots();
      if (!pausedBackgroundComponents.has('federated-library-sync')) void federatedLibraryRuntime.synchronize().catch(() => undefined);
    },
    onError: (error, context) => {
      recordStoppedOperation({
        scope: `federation-operation:${context.operation}`,
        component: 'federation-node-connector',
        operation: context.operation,
        error,
        context: { frameType: context.frameType ?? '' },
      });
    },
  });
  for (const project of projectCatalog().filter((entry) => entry.available)) tryTaskStateForProject(project);
  const reconcileMergeableTaskConflicts = (
    projectId: string,
    targets?: Array<{ entityType: TaskEntityChange['entityType']; entityId: string }>,
  ): void => {
    const state = projectTaskStates.get(projectId) ?? federatedProjectTaskStates.get(projectId);
    if (!state) return;
    void state.reconcileMergeableConflicts(targets).then((result) => {
      if (!result.changed) return;
      controlRoomProjectionStore?.invalidate(projectId, result.localChanges);
      for (const executionId of new Set(result.localChanges
        .filter((change) => change.entityType === 'execution')
        .map((change) => change.entityId))) {
        publishExecutionChange({
          projectId,
          nodeId: federation?.localOwner().ownerNodeId ?? 'local',
          executionId,
          record: state.executions.all().find((candidate) => candidate.metadata.executionId === executionId) ?? null,
        });
      }
      for (const client of globalContentEventClients) {
        try { client.write(`event: ledger-content-change\ndata: ${JSON.stringify({ remote: false, projectId, nodeId: federation?.localOwner().ownerNodeId ?? 'local' })}\n\n`); } catch {
          // A disconnected event client cannot fail the durable conflict resolution.
        }
      }
    }).catch((error: unknown) => {
      recordStoppedOperation({
        scope: `task-conflict-reconciliation:${projectId}`,
        component: 'task-current-state',
        operation: 'reconcile-mergeable-conflicts',
        error,
        context: { projectId },
      });
    });
  };
  federationTaskStateReplicator = createFederationTaskStateReplicator({
    stores: () => new Map([...projectTaskStates]
      .filter(([projectId]) => !pausedTaskProjects.has(projectId))
      .map(([projectId, state]) => [projectId, state.store])),
    storeFor: taskStoreForProject,
    publish: (nodeId, frame) => federation!.publishStateFrame(nodeId, frame),
    onProjectionChange: ({ projectId, from, delta }) => {
      const store = taskStoreForProject(projectId, from);
      const keys = delta.entities.filter((entity) => entity.entityType === 'resource').map((entity) => entity.entityId);
      const heads = keys.flatMap((key) => store?.contentHeads(key) ?? []);
      for (const sourceReplicaId of new Set(heads.map((head) => head.sourceReplicaId))) {
        federationContentStore.applyManifest(sourceReplicaId, { version: 1, projectId, generatedAt: new Date().toISOString(), complete: false, resources: heads.filter((head) => head.sourceReplicaId === sourceReplicaId).map(({ sourceReplicaId: _sourceReplicaId, ...head }) => head) });
      }
      const localProject = projectCatalogStore.projects().find((project) => project.id === projectId && project.available);
      const context = localProject ? projectContexts.get(localProject.decisionOsRoot) : null;
      if (localProject && context) {
        for (const key of keys) {
          const scoped = resolveCardContentChange({
            decisionOsRoot: localProject.decisionOsRoot,
            taskProjection: () => projectTaskStates.get(projectId)?.projection().ledger ?? null,
            change: {
              contentFile: key,
              file: resolve(localProject.decisionOsRoot, key.replace(/^\/?\.decision-os\//, '')),
              kind: key.includes('/threads/') ? 'thread-content' : 'card-content',
            },
          });
          if (!scoped) continue;
          const invalidationRevision = context.revisions.advance(scoped.ledgerId);
          const message = `event: card-content-change\ndata: ${JSON.stringify({
            ...scoped,
            remote: true,
            projectId,
            nodeId: from,
            invalidationRevision,
          })}\n\n`;
          // WHAT: Publish the exact replicated Markdown owner to the hosted project's stream.
          // WHY: An open thread must rehydrate when its causal resource head changes remotely.
          for (const client of context.clients) {
            try { client.write(message); } catch {
              // A disconnected client cannot fail replicated state installation.
            }
          }
        }
      }
      controlRoomProjectionStore?.invalidate(projectId, delta.entities);
      for (const executionId of new Set(delta.entities.filter((entity) => entity.entityType === 'execution').map((entity) => entity.entityId))) {
        const executionState = executionStateForProject(projectId, from);
        const record = executionState?.executions.all().find((candidate) => candidate.metadata.executionId === executionId) ?? null;
        publishExecutionChange({
          projectId,
          nodeId: from,
          executionId,
          // WHAT: Publish only conflict-free execution records while retaining repository diagnostics.
          // WHY: An expected causal execution conflict must not escape federation invalidation and pause the project.
          record,
          remote: true,
        });
        executionPresentations.hydrateTerminalArtifacts(
          projectId,
          record?.lifecycle.executorNodeId ?? from,
          record,
          recordStoppedOperation,
        );
      }
      for (const client of globalContentEventClients) client.write(`event: ledger-content-change\ndata: ${JSON.stringify({ remote: true, projectId, nodeId: from })}\n\n`);
      reconcileMergeableTaskConflicts(projectId, delta.entities);
    },
    onProjectionError: ({ projectId, from, error }) => {
      recordStoppedOperation({
        scope: `federation-projection:${projectId}:${from}`,
        component: 'federation-task-state-replicator',
        operation: 'publish-projection-change',
        error,
        context: { projectId, from },
      });
    },
  });
  for (const [projectId, state] of projectTaskStates) {
    localTaskRuntime.scheduleContentHeadRepair(projectId, state);
  }
  for (const projectId of new Set([...projectTaskStates.keys(), ...federatedProjectTaskStates.keys()])) {
    reconcileMergeableTaskConflicts(projectId);
  }
  federationContentScheduler = createFederationContentScheduler({
    store: federationContentStore,
    hasPriorityStateWork: () => {
      const diagnostics = federationTaskStateReplicator?.diagnostics();
      return Boolean(diagnostics && (diagnostics.runtimeDirty.length > 0 || diagnostics.pendingDeliveryIds.length > 0));
    },
    fetchContent: async ({ ownerNodeId, projectId, key, hash }) => {
      const online = new Set(federation!.remoteProjects().filter((project) => project.online && project.localProjectId === projectId).map((project) => project.ownerNodeId));
      const sources = [...new Set([ownerNodeId, ...federationContentStore.sources(projectId, key, hash)])].filter((source) => online.has(source));
      const failures: string[] = [];
      for (const source of sources) {
        const result = await federation!.requestToFile(source, `/api/federation/content-object?projectId=${encodeURIComponent(projectId)}&hash=${encodeURIComponent(hash)}`, federationContentStore.objectFile(hash), hash);
        if (result.status === 200) return;
        failures.push(`${source}:${result.status}`);
      }
      throw new Error(`content_object_sources_failed:${failures.join(',') || 'none-online'}`);
    },
  });
  const projectSyncRuntime = createProjectSyncRuntime({
    catalog: projectCatalogStore,
    decisionOsRoot: masterDecisionOsRoot,
    federation,
    incidentLedger,
    masterRoot,
    onBackgroundFailure: recordBackgroundFailure,
    onRunChange: (run) => {
      controlRoomProjectionStore?.invalidate();
      for (const client of globalContentEventClients) {
        client.write(`event: project-sync-change\\ndata: ${JSON.stringify({
          syncId: run.syncId,
          phase: run.phase,
          preparationPhase: run.preparationPhase,
        })}\\n\\n`);
      }
    },
    paused: (component) => pausedBackgroundComponents.has(component),
    projectRuntime: (project) => projectContext(project.decisionOsRoot, project.id).runtime,
    projects: projectCatalog,
  });
  resumeProjectSyncRuntime = projectSyncRuntime.resume;
  const activeProjectSyncController = projectSyncRuntime.controller;
  const recoverRuntimeScope = createRuntimeRecoveryService({
    codexCoordinator: codexProcessCoordinator,
    contentScheduler: () => federationContentScheduler,
    federatedLibrary: federatedLibraryRuntime,
    federatedTaskRuntime,
    incidentLedger,
    incidentSupervisor,
    initializePipelineCatalog: federatedLibraryRuntime.initialize,
    localTaskRuntime,
    migrateProjectPipelines,
    projectById: (projectId) => projectCatalogStore.projects()
      .find((project) => project.id === projectId && project.available) ?? null,
    projectRuntimeRegistry,
    projectSyncRuntime,
    replicator: () => federationTaskStateReplicator,
  });
  Object.defineProperty(runtime, 'federationNodeConnector', { value: federation, configurable: true, enumerable: false });
  controlRoomProjectionStore = createControlRoomProjectionStore({
    cacheFile: resolve(masterDecisionOsRoot, 'cache', 'control-room-v3.json'),
    taskProjectionForProject,
    runtimeForProject: (project) => projectContexts.get(project.decisionOsRoot)?.runtime,
    taskEntityForProject: (project, entityType, entityId) => tryTaskStateForProject(project)?.store.projectedEntity(entityType, entityId) ?? null,
    taskExecutionsForProject: (project) => tryTaskStateForProject(project)?.executions.all() ?? [],
    taskExecutionDiagnosticsForProject: (project) => tryTaskStateForProject(project)?.executions.diagnostics() ?? [],
    taskExecutionForProject: (project, executionId) => {
      try { return tryTaskStateForProject(project)?.executions.find(executionId) ?? null; }
      catch { return null; }
    },
    taskRootForProject: (project) => tryTaskStateForProject(project)?.store.rootHash() ?? `paused:${project.id}`,
  });
  // WHAT: Build the first projection during startup, then let project watchers maintain it.
  // WHY: Control Room requests must read a ready snapshot instead of traversing every registered project.
  try {
    controlRoomProjectionStore.get(projectCatalog().filter((project) => project.available));
  } catch (error) {
    recordIncident({
      scope: 'control-room-projection',
      component: 'control-room-projection-store',
      operation: 'build-startup-projection',
      error,
    });
  }
  for (const project of projectCatalog()) {
    // WHAT: Start runtimes only for paths that passed registry validation.
    // WHY: An unavailable registration must remain visible without recreating directories through watcher setup.
    if (project.available) tryProjectContext(project, 'start-project-runtime');
  }
  const reconcileProjectRuntimes = (): void => {
    const registered = projectCatalog();
    const activeRoots = new Set(registered.filter((project) => project.available).map((project) => project.decisionOsRoot));
    for (const project of registered) {
      // WHAT: Reconcile only validated project roots.
      // WHY: Missing registrations remain catalog diagnostics rather than implicit directory creation requests.
      if (project.available) tryProjectContext(project, 'reconcile-project-runtime');
    }
    for (const [root, context] of projectContexts) {
      if (activeRoots.has(root)) continue;
      disposeProjectContext(context);
      projectContexts.delete(root);
    }
    controlRoomProjectionStore?.reconcile(registered);
  };
  const runtimeIncidentReviewScheduler = createRuntimeIncidentReviewScheduler({
    incidentLedger,
    intervalMs: Number(payload.runtimeIncidentReviewIntervalMs ?? 5_000),
    targetProject: () => projectCatalog().find((entry) => entry.available && entry.id === runtimeIncidentReviewProjectId) ?? null,
    taskState: taskStateForProject,
    assignedNodeId: () => federation.localOwner().ownerNodeId,
    paused: () => pausedBackgroundComponents.has('runtime-incident-review'),
    onChanged: (projectId) => controlRoomProjectionStore?.invalidate(projectId),
    onBootstrapGate: (error, context) => {
      recordStoppedOperation({
        scope: 'runtime-incident-review',
        component: 'runtime-incident-review',
        operation: 'synchronize-admin-master-task',
        error,
        context,
      });
    },
    onFailure: (error, context) => {
      recordBackgroundFailure('runtime-incident-review', 'synchronize-decision-os-project-master-task', error, context);
    },
  });
  const deliveryAdmissionInput = () => ({
    contentStatus: () => federationContentStore.status(),
    executionStates: projectTaskStates.values(),
    federationPhase: federation.status().phase,
    incidentLedger,
    localNodeId: federation.localOwner().ownerNodeId,
    projectIds: projectCatalog().filter((project) => project.available)
      .map((project) => project.id)
      .sort(),
    replicationStatus: () => federationTaskStateReplicator?.diagnostics() ?? {
      convergence: [],
      runtimeDirty: [],
      pendingDeliveryIds: [],
    },
    releaseSettings: runtime.decisionOsSettings,
    schedulerContexts: [
      ...[...projectContexts.entries()].map(([root, context]) => ({
        root,
        runtime: context.runtime,
      })),
      ...federatedSchedulerContexts.values(),
    ],
  });
  const deliveryNodeRuntime = createDeliveryNodeRuntime({
    decisionOsRoot: masterDecisionOsRoot,
    incidentLedger,
    localNodeId: () => federation.localOwner().ownerNodeId,
    readStatusEvidence: () => buildDeliveryStatusEvidence(deliveryAdmissionInput()),
    settings: () => runtime.decisionOsSettings as AnyRecord,
  });
  const runLocalDeliveryCommand = deliveryNodeRuntime.run;
  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requestPath = requestUrl.pathname;
    const runtimeRecoveryRoute = await handleRuntimeRecoveryRoute({
      request,
      response,
      resume: recoverRuntimeScope,
      url: requestPath,
    });
    if (runtimeRecoveryRoute.handled) return;
    const diagnosticReadRoute = handleDiagnosticReadRoutes({
      incidentLedger,
      incidentSupervisor,
      request,
      requestPath,
      response,
      settings: runtime.decisionOsSettings,
    });
    if (diagnosticReadRoute.handled) return;
    const deliveryRoute = await handleDeliveryRoutes({
      admissionState: () => buildDeliveryAdmissionState(deliveryAdmissionInput()),
      consumeCapability: (capability) => federation.consumeDeliveryCapability(capability),
      dispatchRemote: (nodeId, command, signal) => federation.requestDelivery(
        nodeId,
        command,
        { timeoutMs: 30_000, signal },
      ),
      localNodeId: federation.localOwner().ownerNodeId,
      projectScoped: false,
      request,
      response,
      runCommand: (command, signal) => runLocalDeliveryCommand(command, signal),
      settings: runtime.decisionOsSettings,
      targetOnline: (nodeId) => federation.nodes()
        .some((node) => node.nodeId === nodeId && node.online),
      url: requestPath,
    });
    if (deliveryRoute.handled) return;
    const globalRuntimeIncident = incidentSupervisor.globalRuntimeIncident();
    if (globalRuntimeIncident) throw new RuntimeScopePausedError('server-runtime', globalRuntimeIncident.id);
    const projectScope = parseProjectUrlScope(requestPath);
    if (requestPath.startsWith('/p/') && !projectScope) {
      response.statusCode = 400;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: false, error: 'Malformed project URL.' }));
      return;
    }
    const requestedReplicaNodeId = String(request.headers['x-decision-os-replica-node']
      ?? (request.method === 'GET' ? requestUrl.searchParams.get('replica') : '')
      ?? '').trim();
    const localNodeId = federation.localOwner().ownerNodeId;
    const projects = projectCatalog();
    const activeProject = projectScope
      ? resolveCatalogProject({ projects, projectId: projectScope.projectId, fallbackDecisionOsRoot: masterDecisionOsRoot })
      : projects.length === 1 && isProjectSensitiveEndpoint(requestPath) && !isGlobalProjectEndpoint(requestPath)
        ? projects[0]
        : null;
    const internalTaskExecutionRoute = await handleInternalTaskExecutionRoutes({
      artifactFile: (projectId, requesterNodeId, hash) => {
        const store = taskStoreForProject(projectId, requesterNodeId);
        return store && /^[a-f0-9]{64}$/i.test(hash)
          ? resolve(store.root, 'objects', hash.slice(0, 2), hash)
          : '';
      },
      authenticateNode: (nodeId) => federation.nodes()
        .some((node) => node.nodeId === nodeId && node.online),
      baseRuntime: (executionId, projectId) => {
        const localProject = projects.find((project) => project.id === projectId && project.available);
        return federatedSchedulerContexts.get(executionId)?.runtime
          ?? (localProject ? projectContext(localProject.decisionOsRoot, localProject.id).runtime : runtime);
      },
      localNodeId: federation.localOwner().ownerNodeId,
      request,
      response,
      stateForProject: executionStateForProject,
      url: requestUrl,
    });
    if (internalTaskExecutionRoute.handled) return;
    // A hosted project is always authoritative locally. Stale replica selectors apply only to remote-only resources.
    if (projectScope && !activeProject && requestedReplicaNodeId && requestedReplicaNodeId !== localNodeId) {
      const ownerNodeId = requestedReplicaNodeId;
      const localProjectId = projectScope.projectId;
      await handleRemoteProjectGateway({
        contentScheduler: federationContentScheduler,
        contentStore: federationContentStore,
        federation,
        invalidateProject: (projectId, changes) => controlRoomProjectionStore?.invalidate(
          projectId,
          [...changes] as TaskEntityChange[],
        ),
        localNodeId,
        masterDecisionOsRoot,
        ownerNodeId,
        pausedContentScheduler: () => pausedBackgroundComponents.has('federation-content-scheduler'),
        pipelinePresentation: (projectId, runId, nodeId) => federatedPipelinePresentations.get(
          `${projectId}\0${runId}\0${nodeId}`,
        ) ?? null,
        presentationRegistry: executionPresentations,
        presentationRuntime: (executionId) => federatedSchedulerContexts.get(executionId)?.runtime ?? null,
        projectId: localProjectId,
        recordBackgroundFailure: (operation, error, context) => {
          recordBackgroundFailure('federation-content-scheduler', operation, error, context);
        },
        remoteProject: federation.remoteProjects().find((project) => (
          project.ownerNodeId === ownerNodeId && project.localProjectId === localProjectId
        )) ?? null,
        replicator: federationTaskStateReplicator,
        request,
        response,
        revision: (projectId) => federatedTaskRevisionForProject(projectId).advance('tasks'),
        scopedPath: projectScope.scopedPath,
        stateForProject: federatedTaskStateForProject,
        storeForProject: federatedTaskStoreForProject,
        url: requestUrl,
      });
      return;
    }
    const url = projectScope && isProjectSensitiveEndpoint(projectScope.scopedPath) ? projectScope.scopedPath : requestPath;
    if (requestPath === '/api/federation/task-replica') {
      response.statusCode = 404;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: false, error: 'The hydrated task replica endpoint has been retired.' }));
      return;
    }
    if (projectScope && !activeProject) {
      response.statusCode = 404;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: false, error: 'Unknown project id.' }));
      return;
    }
    if (projectScope && activeProject && !activeProject.available) {
      response.statusCode = 503;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: false, error: activeProject.diagnostic, projectId: activeProject.id }));
      return;
    }
    const markdownTargetRoute = handleMarkdownTargetRoutes({
      masterRoot,
      projectId: projectScope?.projectId,
      projectRoot: activeProject?.decisionOsRoot,
      projects: projectCatalogStore.projects(),
      request,
      requestPath,
      response,
      scopedPath: projectScope?.scopedPath,
      taskLedger: (project) => taskStateForProject(project).projection().ledger,
    });
    if (markdownTargetRoute.handled) return;
    const federatedAdmissionRoute = await handleFederatedExecutionAdmissionRoutes({
      authenticateNode: (nodeId) => federation.nodes()
        .some((node) => node.nodeId === nodeId && node.online),
      project: activeProject,
      projectScoped: Boolean(projectScope),
      recordFailure: recordStoppedOperation,
      request,
      response,
      router: taskExecutionRouterForProject,
      runtime: (project) => projectContext(project.decisionOsRoot, project.id).runtime,
      url,
    });
    if (federatedAdmissionRoute.handled) return;
    const nodeMessageRoute = await handleNodeMessageRoutes({
      federation,
      messageTimeoutMs: federationNodeMessageTimeoutMs,
      projectRuntime: (project) => projectContext(project.decisionOsRoot, project.id).runtime,
      projects,
      recordFailure: recordStoppedOperation,
      projectScoped: Boolean(projectScope),
      request,
      response,
      url,
    });
    if (nodeMessageRoute.handled) return;
    const gitReviewRoute = await handleGitReviewRoutes({
      activeProject,
      request,
      requestUrl,
      response,
      url,
    });
    if (gitReviewRoute.handled) return;
    const controlRoomRoute = handleControlRoomRoutes({
      controlRoomProjectionStore,
      executionObservation: (projectId, executionId, ownerNodeId) => {
        const observation = federatedExecutionObservations.get(
          `${projectId}\0${executionId}\0${ownerNodeId}`,
        ) ?? null;
        if (!observation || Date.parse(observation.expiresAt) <= Date.now()) return null;
        return observation;
      },
      federation,
      hydrateProject: (project) => {
        projectContext(project.decisionOsRoot, project.id);
      },
      listProjectSyncRuns: () => projectSyncRuntime.store().list(),
      projectScope,
      projects,
      request,
      requestUrl,
      response,
      taskStoreForProject,
      url,
    });
    if (controlRoomRoute.handled) return;
    if (request.method === 'GET') {
      const query = (request.url ?? '').includes('?') ? `?${(request.url ?? '').split('?').slice(1).join('?')}` : '';
      let destination = '';
      if (requestPath === '/control-room') destination = `/${query}`;
      if (projectScope?.scopedPath === '/control-room') destination = `/${query}`;
      if (projectScope?.scopedPath === '/projects') destination = `/projects${query}`;
      if (projectScope?.scopedPath.startsWith('/projects/')) destination = `${projectScope.scopedPath}${query}`;
      if (destination) {
        response.statusCode = 302;
        response.setHeader('location', destination);
        response.end();
        return;
      }
    }
    const decisionOsRoot = activeProject?.decisionOsRoot ?? masterDecisionOsRoot;
    const context = projectContext(decisionOsRoot, activeProject?.id ?? '');
    const requestRuntime = context.runtime;
    const contentEventClients = context.clients;
    const ledgerRevisions = context.revisions;
    const publishCardContentChange = context.publishCard;
    const publishLedgerContentChange = context.publishLedger;
    const localProject = activeProject ?? projectCatalog().find((project) => project.decisionOsRoot === decisionOsRoot);
    const ledgerAuthoringDocument = (ledgerId: string): { ledger: AnyRecord; ledgerPath: string } | null => {
      const registered = readCanonicalDecisionOsState({
        action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') },
      }).ledgers.find((entry) => entry.id === ledgerId);
      if (!registered) return null;
      const ledgerPath = resolve(decisionOsRoot, registered.ledgerFile.replace(/^\.decision-os\//, ''));
      if (ledgerId === tasksLedgerId && localProject) {
        return { ledger: structuredClone(taskStateForProject(localProject).projection().ledger), ledgerPath };
      }
      if (!existsSync(ledgerPath)) return null;
      return { ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord, ledgerPath };
    };
    const cardContentRoute = await handleCardContentRoutes({
      decisionOsRoot,
      loadLedger: ledgerAuthoringDocument,
      localProject,
      patchCard: async ({ cardId, ledgerId, markdown, mutationId }) => {
        if (!localProject) throw new Error('The card is not locally owned.');
        const latest = ledgerAuthoringDocument(ledgerId);
        if (!latest) throw new Error('The ledger disappeared before the card mutation.');
        const before = structuredClone(latest.ledger);
        const after = structuredClone(latest.ledger);
        const mutation: LedgerMutation = {
          action: 'patch-card',
          mutationId,
          cardPatch: { id: cardId, description: markdown },
        };
        if (ledgerId === tasksLedgerId) {
          await materializeTaskMutationInputs({
            projectId: localProject.id,
            decisionOsRoot,
            ledger: before,
            mutation,
            store: taskStateForProject(localProject).store,
            contentStore: federationContentStore,
            drain: federationContentScheduler?.drain ?? null,
          });
        }
        const applied = applyLedgerMutation({
          decisionOsRoot,
          ledgerPath: latest.ledgerPath,
          ledger: after,
          mutation,
        });
        if (applied.error) {
          throw new Error(String(applied.error.body.error ?? 'The card mutation was rejected.'));
        }
        if (ledgerId === tasksLedgerId) {
          const committed = await taskStateForProject(localProject).executeMutation(
            mutation,
            before,
            after,
            applied.changedContentFiles,
          );
          if (committed.changed) {
            controlRoomProjectionStore?.invalidate(localProject.id, committed.localChanges);
          }
          const taskClock = taskStateForProject(localProject).store.clientClock();
          return {
            changedCard: ledgerCardProjection({
              decisionOsRoot,
              ledgerId,
              ledger: committed.ledger,
              cardId,
            }),
            taskClock,
            receipt: {
              mutationId,
              clock: taskClock,
              entities: committed.localChanges,
            },
          };
        }
        context.watcher.ignoreNext(latest.ledgerPath);
        writeFileSync(latest.ledgerPath, JSON.stringify(after, null, 2));
        context.watcher.refreshOwnership();
        controlRoomProjectionStore?.invalidate(localProject.id);
        federation.publishContentChange();
        ledgerRevisions.advance(ledgerId);
        return {
          changedCard: ledgerCardProjection({
            decisionOsRoot,
            ledgerId,
            ledger: after,
            cardId,
          }),
        };
      },
      request,
      requestUrl,
      response,
      serverCloseSignal: serverCloseAbort.signal,
      url,
    });
    if (cardContentRoute.handled) return;
    const taskExecutionReadRoute = await handleTaskExecutionReadRoutes({
      presentation: async (executionId) => {
        const state = taskExecutionState(requestRuntime);
        const execution = state?.executions.find(executionId) ?? null;
        if (!state || !execution) {
          return {
            statusCode: 404,
            body: JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }),
          };
        }
        const executorNodeId = execution.lifecycle.executorNodeId;
        const localExecutorNodeId = taskExecutionNodeId(requestRuntime);
        if (executorNodeId !== localExecutorNodeId) {
          const projection = executionPresentations.presentation(
            execution.metadata.projectId,
            executionId,
            executorNodeId,
          );
          if (!projection?.hydrated) {
            const hydrated = executionPresentations.locallyHydrated(state, execution);
            if (hydrated) {
              executionPresentations.setHydrated(
                execution.metadata.projectId,
                executionId,
                executorNodeId,
                hydrated.events,
              );
              return { statusCode: 200, body: JSON.stringify(hydrated) };
            }
            const remote = await executionPresentations.remotePresentation({
              projectId: execution.metadata.projectId,
              execution,
              request,
              response,
            });
            return 'presentation' in remote
              ? {
                statusCode: 200,
                body: JSON.stringify(executionPresentations.replicated(execution, {
                  events: remote.presentation.events,
                  hydrated: true,
                })),
              }
              : { statusCode: remote.statusCode, body: remote.body };
          }
          return {
            statusCode: 200,
            body: JSON.stringify(executionPresentations.replicated(execution, projection)),
          };
        }
        const presentationRuntime = federatedSchedulerContexts.get(executionId)?.runtime
          ?? requestRuntime;
        const projection = executionPresentations.presentation(
          execution.metadata.projectId,
          executionId,
          localExecutorNodeId,
        );
        const result = projection?.hydrated
          ? {
            ok: true as const,
            presentation: executionPresentations.replicated(execution, projection),
          }
          : buildTaskExecutionPresentation({
            executionId,
            state,
            runtime: presentationRuntime,
          });
        if ('presentation' in result && !projection?.hydrated) {
          executionPresentations.setHydrated(
            execution.metadata.projectId,
            executionId,
            localExecutorNodeId,
            result.presentation.events,
          );
        }
        const http = taskExecutionPresentationHttpResult(executionId, result);
        return { statusCode: http.statusCode, body: http.body };
      },
      queuePosition: (record) => unifiedCodexQueuePosition({
        decisionOsRoot: String(requestRuntime.decisionOsRoot ?? ''),
        id: record?.metadata.executionId ?? '',
        createdAt: record?.metadata.requestedAt ?? '',
        runtime: requestRuntime,
      }),
      request,
      response,
      state: taskExecutionState(requestRuntime),
      url,
    });
    if (taskExecutionReadRoute.handled) return;
    const ledgerPersistence = createLedgerPersistence({
      decisionOsRoot,
      invalidateProject: (projectId, entities) => controlRoomProjectionStore?.invalidate(
        projectId,
        entities ? [...entities] : undefined,
      ),
      localProject,
      projectId: activeProject?.id ?? '',
      publishContentChange: () => federation.publishContentChange(),
      revisions: ledgerRevisions,
      stateForProject: taskStateForProject,
      watcher: context.watcher,
    });
    const persistLedgerAndRespond = (
      ledgerId: string,
      ledgerPath: string,
      ledger: AnyRecord,
      activeResponse: ServerResponse,
    ): Promise<void> => ledgerPersistence.persistLedger(
      ledgerId,
      ledgerPath,
      ledger,
      activeResponse,
    );
    const persistLedgerMutationAndRespond = (
      ledgerId: string,
      ledgerPath: string,
      before: AnyRecord,
      ledger: AnyRecord,
      mutation: LedgerMutation,
      changedFiles: readonly string[],
      activeResponse: ServerResponse,
    ): Promise<void> => ledgerPersistence.persistMutation(
      ledgerId,
      ledgerPath,
      before,
      ledger,
      mutation,
      changedFiles,
      activeResponse,
    );
    const ledgerReadRoute = await handleLedgerReadRoutes({
      contentDrain: federationContentScheduler?.drain ?? null,
      contentStore: federationContentStore,
      decisionOsRoot,
      localProject,
      request,
      response,
      revisions: ledgerRevisions,
      stateForProject: taskStateForProject,
      url,
    });
    if (ledgerReadRoute.handled) return;
    const federationContentRoute = await handleFederationContentRoutes({
      contentObjectFile: (hash) => federationContentStore.objectFile(hash),
      contentStatus: () => federationContentStore.status() as AnyRecord,
      localNodeId: federation.localOwner().ownerNodeId,
      projectScoped: Boolean(projectScope),
      projects,
      remoteProjectKnown: (projectId) => federation.remoteProjects()
        .some((project) => project.localProjectId === projectId),
      replicationDiagnostics: () => federationTaskStateReplicator?.diagnostics() ?? {},
      replicationStores: () => [
        ...[...projectTaskStates].map(([projectId, state]) => ({
          projectId,
          ownerNodeId: federation.localOwner().ownerNodeId,
          store: state.store,
        })),
        ...[...federatedTaskStores].map(([projectId, store]) => ({
          projectId,
          ownerNodeId: 'replicated',
          store,
        })),
      ],
      request,
      response,
      schedulerRunning: federationContentScheduler?.running ?? false,
      stateForProject: taskStateForProject,
      url,
    });
    if (federationContentRoute.handled) return;
    const taskStateRoute = await handleTaskStateRoutes({
      invalidateProject: (projectId, entities) => controlRoomProjectionStore?.invalidate(
        projectId,
        [...entities],
      ),
      projectScoped: Boolean(projectScope),
      projects,
      request,
      response,
      stateForProject: taskStateForProject,
      url,
    });
    if (taskStateRoute.handled) return;
    const federatedLibraryRoute = await handleFederatedLibraryRoutes({
      exportPipelines: () => exportFederatedPipelineSnapshot(localDecisionOsRoots()),
      invalidateSkillIndex: federatedLibraryRuntime.invalidateIndex,
      projectScoped: Boolean(projectScope),
      readSkillIndex: federatedLibraryRuntime.readSkillIndex,
      request,
      response,
      status: () => runtime.federatedLibrarySyncStatus as AnyRecord | undefined,
      synchronize: async () => {
        pausedBackgroundComponents.delete('federated-library-sync');
        await federatedLibraryRuntime.synchronize(true);
      },
      url,
    });
    if (federatedLibraryRoute.handled) return;
    const settingsRoute = await handleSettingsRoutes({
      federation,
      masterDecisionOsRoot,
      onCodexSettingsChanged: () => {
        pausedBackgroundComponents.delete('codex-process-scheduler');
        void scheduleGlobalCodexProcesses()
          .catch((error: unknown) => recordBackgroundFailure(
            'codex-process-scheduler',
            'settings-change-schedule',
            error,
          ));
      },
      request,
      response,
      runtime,
      url,
    });
    if (settingsRoute.handled) return;
    const projectSyncRoute = await handleProjectSyncRoutes({
      controller: activeProjectSyncController,
      executeRole: (body, authenticatedNodeId) => executeFederatedProjectSyncRole({
        authenticatedNodeId,
        body,
        executionState: executionStateForProject,
        installSchedulerRuntime: (executionId, root, activeRuntime) => {
          federatedSchedulerContexts.set(executionId, { root, runtime: activeRuntime });
        },
        localNodeId: federation.localOwner().ownerNodeId,
        projectRuntime: (project) => projectContext(project.decisionOsRoot, project.id).runtime,
        projects,
        removeSchedulerRuntime: (executionId) => {
          federatedSchedulerContexts.delete(executionId);
        },
        store: projectSyncRuntime.store(),
      }),
      federation,
      projects,
      request,
      response,
      store: projectSyncRuntime.store(),
      url,
    });
    if (projectSyncRoute.handled) return;
    const projectCatalogRoute = await handleProjectCatalogRoutes({
      controlRoomInvalidation: (projectId) => controlRoomProjectionStore?.invalidate(projectId),
      federation,
      masterDecisionOsRoot,
      masterRoot,
      projectCatalog,
      projectCatalogStore,
      projectScope,
      projects,
      reconcileProjectRuntimes,
      request,
      response,
      taskStoreForProject,
      url,
    });
    if (projectCatalogRoute.handled) return;
    if (tryServeDecisionOsAsset({ url, decisionOsRoot, response })) return;
    const operationalRoute = await handleOperationalRoutes({
      request,
      response,
      restartServer: runtime.restartServer,
      url,
    });
    if (operationalRoute.handled) return;
    const contentEventRoute = handleContentEventRoutes({
      contentEventClients,
      globalContentEventClients,
      request,
      response,
      url,
    });
    if (contentEventRoute.handled) return;
    const codexPipelineRoute = await handleCodexPipelineRoutes({
      assertRuntimeAvailable: () => assertCodexRuntimeAvailable(requestRuntime),
      masterDecisionOsRoot,
      onLedgerChange: publishLedgerContentChange,
      publishManifest: () => federation.publishManifest(),
      request,
      requestRuntime,
      response,
      url,
    });
    if (codexPipelineRoute.handled) return;
    const codexSkillLibraryRoute = await handleCodexSkillLibraryRoutes({
      applyOwnedDetail: federatedLibraryRuntime.applyOwnedDetail,
      applyOwnedMetadata: federatedLibraryRuntime.applyOwnedMetadata,
      masterDecisionOsRoot,
      publishAuthoredSkill: federatedLibraryRuntime.publishAuthoredSkill,
      recordRevisionFailure: (skillName, result) => {
        recordIncident({
          severity: 'warning',
          scope: `content-authoring:${skillName}`,
          component: 'codex-content-authoring',
          operation: 'commit-authored-content',
          error: String(result.error ?? 'Git revision failed.'),
          context: { skillName, recovery: result.recovery },
        });
      },
      request,
      requestRuntime,
      requestUrl,
      response,
      url,
    });
    if (codexSkillLibraryRoute.handled) return;
    const codexSkillRunRoute = await handleCodexSkillRunRoutes({
      assertRuntimeAvailable: () => assertCodexRuntimeAvailable(requestRuntime),
      onLedgerChange: publishLedgerContentChange,
      readReplicatedRun: ({ runId, ledgerId, cardId }) => {
        const state = taskExecutionState(requestRuntime);
        const execution = state?.executions.bySessionId(runId)
          .filter((record) => record.metadata.ledgerId === ledgerId && (
            record.metadata.sourceCardId === cardId || record.metadata.ownerCardId === cardId
          ))
          .sort((left, right) => (
            right.metadata.requestedAt.localeCompare(left.metadata.requestedAt)
            || right.metadata.executionId.localeCompare(left.metadata.executionId)
          ))[0] ?? null;
        if (!execution || execution.lifecycle.executorNodeId === federation.localOwner().ownerNodeId) {
          return null;
        }
        const events = executionPresentations.events(
          execution.metadata.projectId,
          execution.metadata.executionId,
          execution.lifecycle.executorNodeId,
        );
        const hydratedEvents = events.length > 0 ? events : (state
          ? executionPresentations.locallyHydrated(state, execution)?.events
          : undefined) ?? [];
        return replicatedCardSkillRunStatus({
          runId,
          ledgerId,
          cardId,
          executions: state?.executions.all() ?? [],
          events: hydratedEvents,
          queuePosition: null,
        });
      },
      request,
      requestRuntime,
      requestUrl,
      response,
      url,
    });
    if (codexSkillRunRoute.handled) return;
    const transcriptionRoute = await handleTranscriptionRoutes({
      invalidateProject: (projectId, entities) => controlRoomProjectionStore?.invalidate(
        projectId,
        [...entities],
      ),
      localProject,
      masterDecisionOsRoot,
      onCardContentChange: publishCardContentChange,
      onLedgerChange: publishLedgerContentChange,
      request,
      requestRuntime,
      response,
      runtime,
      taskStateForProject,
      url,
    });
    if (transcriptionRoute.handled) return;

    const uploadRoute = await handleThreadUploadRoutes({
      decisionOsRoot,
      invalidateProject: (projectId, entities) => controlRoomProjectionStore?.invalidate(
        projectId,
        [...entities],
      ),
      localProject,
      request,
      response,
      taskStateForProject,
      url,
    });
    if (uploadRoute.handled) return;
    const legacyLedgerRoute = await handleLegacyLedgerRoutes({
      activeExecutionPhase: (taskId) => taskExecutionState(requestRuntime)
        ?.executions.byTaskId(taskId)
        .find((execution) => [
          'preparing',
          'queued',
          'starting',
          'running',
          'cancelling',
        ].includes(execution.lifecycle.phase))?.lifecycle.phase ?? '',
      advanceRevision: (ledgerId) => ledgerRevisions.advance(ledgerId),
      currentRevision: (ledgerId) => ledgerRevisions.current(ledgerId),
      decisionOsRoot,
      materializeTaskMutation: async (before, mutation) => {
        if (!localProject) return null;
        try {
          await materializeTaskMutationInputs({
            projectId: localProject.id,
            decisionOsRoot,
            ledger: before,
            mutation,
            store: taskStateForProject(localProject).store,
            contentStore: federationContentStore,
            drain: federationContentScheduler?.drain ?? null,
          });
          return null;
        } catch (error) {
          if (!(error instanceof TaskContentMaterializationError)) throw error;
          return { error: error.code, key: error.key, statusCode: error.statusCode };
        }
      },
      persistLedger: (ledgerId, ledgerPath, ledger) => persistLedgerAndRespond(
        ledgerId,
        ledgerPath,
        ledger,
        response,
      ),
      persistMutation: (ledgerId, ledgerPath, before, ledger, mutation, changedFiles) => (
        persistLedgerMutationAndRespond(
          ledgerId,
          ledgerPath,
          before,
          ledger,
          mutation,
          changedFiles,
          response,
        )
      ),
      projectColor: activeProject?.color ?? '#38d9e8',
      projectId: activeProject?.id ?? '',
      projectName: projectNameForDecisionOsRoot(decisionOsRoot),
      request,
      response,
      runtime: requestRuntime,
      taskLedger: () => localProject
        ? taskStateForProject(localProject).projection().ledger
        : null,
      url,
    });
    if (legacyLedgerRoute.handled) return;
    serveStaticApplication({
      frontendRoot,
      projectScope,
      projects,
      request,
      requestPath,
      response,
      url,
    });
  };
  const codexQueueScanTimer = setInterval(() => {
    if (!pausedBackgroundComponents.has('codex-process-scheduler')) void scheduleGlobalCodexProcesses()
      .catch((error: unknown) => recordBackgroundFailure('codex-process-scheduler', 'periodic-queue-scan', error));
  }, 1_000);
  codexQueueScanTimer.unref?.();
  const server = createNodeHttpListener({
    handleRequest,
    host: String(payload.host ?? '127.0.0.1'),
    onClose: () => {
      serverClosing = true;
      serverCloseAbort.abort(new Error('server_closed'));
      clearInterval(codexQueueScanTimer);
      federatedLibraryRuntime.stop();
      runtimeIncidentReviewScheduler.stop();
      for (const context of projectContexts.values()) disposeProjectContext(context);
      globalContentEventClients.clear();
      federation.stop();
      process.off('uncaughtException', onUncaughtException);
      process.off('unhandledRejection', onUnhandledRejection);
    },
    onListening: (listeningPort) => {
      federationServerPort = listeningPort;
      incidentLedger.resolveScope(
        'server-launcher',
        'The server child started and opened its HTTP listener successfully.',
      );
      federation.start();
      void runtimeIncidentReviewScheduler.run();
    },
    port,
    recordIncident,
    recordStoppedOperation,
    startupTasks: startupProjectTasks,
  });
  runtime.server = server;
  return { ok: true, port, server };
}

export const createHttpServer = createDecisionOsServer;
