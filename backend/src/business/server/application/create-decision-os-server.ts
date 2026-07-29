/**
 * WHAT: Creates the Decision OS HTTP server, workspace routes, and scoped content event stream.
 * WHY: Ledger IO, SSE publication, and Codex process callbacks share one server lifecycle for the active workspace.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from '../helper/resolve-decision-os-root.js';
import { decisionOsReleaseHealthIdentity, readDecisionOsSettings } from '../helper/read-decision-os-settings.js';
import { readRequestBuffer } from '../helper/read-request-buffer.js';
import { normalizeLedgerNotes } from '../helper/normalize-ledger-notes.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { resolveCardContentChange, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';
import { watchProjectFiles } from '../../refresh/helper/watch-project-files.js';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { createLedgerRevisionTracker } from '../helper/create-ledger-revision-tracker.js';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { recoverTaskExecutions } from '../../codex/helper/recover-task-executions.js';
import { readCodexPipelineRunController } from '../../codex/controller/read-codex-pipeline-run-controller.js';
import { stopAdoptedTaskExecutionMonitors } from '../../codex/helper/monitor-adopted-task-execution.js';
import {
  TaskExecutionAdmissionError,
  resolveTaskLineage,
  type TaskExecutionLaunchRequest,
} from '../../codex/helper/task-execution-router.js';
import { pendingCodexProcessEntries, unifiedCodexQueuePosition } from '../../codex/helper/codex-process-scheduler.js';
import type { CodexSlotAcquireOptions } from '../../codex/helper/codex-capacity-slots.js';
import { scheduleCodexRuntimeTimer, stopCodexRuntimeTimers } from '../../codex/helper/codex-runtime-run-store.js';
import { installRemotePipelineRun, removeInstalledRemotePipelineRun } from '../../codex/helper/install-remote-pipeline-run.js';
import {
  stopTaskExecutionCancellationDeadlines,
  taskExecutionNodeId,
  taskExecutionState,
} from '../../codex/helper/task-execution-runtime.js';
import { committedTaskExecutionSettlement } from '../../codex/helper/commit-task-execution-settlement.js';
import { projectTaskExecutionState } from '../../codex/helper/project-task-execution-state.js';
import { buildTaskExecutionPresentation } from '../../codex/helper/task-execution-presentation.js';
import { taskExecutionPresentationHttpResult } from '../../codex/helper/task-execution-presentation-http-result.js';
import {
  applyTaskExecutionPresentationUpdate,
  isTaskExecutionPresentationEvent,
  isTaskExecutionPresentationUpdate,
  replicatedTaskExecutionPresentation,
} from '../../codex/helper/replicated-task-execution-presentation.js';
import { replicatedCardSkillRunStatus } from '../../codex/helper/replicated-card-skill-run-status.js';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { TaskExecutionPresentation, TaskExecutionPresentationEvent } from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { TaskEntityChange } from '../../task-state/helper/task-current-state-types.js';
import { resolveCatalogProject, tasksLedgerForProject, tasksLedgerId, type DecisionOsProject } from '../helper/project-catalog.js';
import { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint, parseProjectUrlScope } from '../helper/project-url-scope.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import { ledgerCardProjection, ledgerThreadProjection } from '../helper/ledger-read-models.js';
import { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { executeNodeMessage } from '../../federation/helper/execute-node-message.js';
import { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import { readTaskContentOnDemand } from '../../federation/helper/read-task-content-on-demand.js';
import { executeDeliveryNodeCommand, DeliveryNodeCommandError } from '../../delivery/controller/delivery-node-command-controller.js';
import { createDeliveryNodeReceiptStore } from '../../delivery/helper/delivery-node-receipt-store.js';
import { createNodeReleaseStore, NodeReleaseError } from '../../delivery/helper/node-release-store.js';
import { parseDeliveryNodeCommand } from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  authorizeLocalDeliveryDispatch,
  createDeliveryHttpRequestScope,
  DeliveryHttpBoundaryError,
  readDeliveryRequestJson,
} from '../../delivery/helper/delivery-http-boundary.js';
import { deliveryBlockingIncidents } from '../../delivery/helper/delivery-incident-boundary.js';
import { materializeTaskMutationInputs, materializeTaskResources, TaskContentMaterializationError } from '../../federation/helper/materialize-task-mutation-inputs.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import type { TaskProjectionCommand } from '../../task-state/helper/task-mutation-command.js';
import { createRuntimeIncidentLedger, RuntimeScopePausedError } from '../helper/runtime-incident-ledger.js';
import { createRuntimeIncidentReviewScheduler } from '../helper/create-runtime-incident-review-scheduler.js';
import { runtimeIncidentReviewProjectId } from '../helper/synchronize-runtime-incident-review-task.js';
import {
  MarkdownEditorTargetError,
  markdownEditorTargetLocation,
  resolveMarkdownEditorTarget,
} from '../../content-authoring/helper/resolve-markdown-editor-target.js';
import {
  exportFederatedPipelineSnapshot,
  createFederatedSkillExportIndex,
  importFederatedPipelineSnapshot,
  importFederatedSkillSnapshot,
  type FederatedPipelineSnapshot,
  type FederatedSkillManifest,
  type FederatedSkillSnapshot,
  type FederatedSkillExportIndex,
} from '../../federation/helper/federated-library-cache.js';
import type { FederationInternalResponse } from '../../federation/helper/federation-node-connector.js';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import { ensureServerPipelines, migrateLegacyProjectPipelines } from '../../codex/helper/server-pipeline-catalog.js';
import { applyCodexSkillMetadataOwner, migrateCodexSkillMetadataOwner } from '../../codex/helper/codex-skill-metadata-owner.js';
import { readCodexSkillCatalog } from '../../codex/helper/codex-skill-library.js';
import { readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import { createProjectSyncStore } from '../../project-sync/helper/project-sync-store.js';
import { createProjectSyncController } from '../../project-sync/controller/start-project-sync.js';
import { projectSyncGitSshCommand } from '../../project-sync/helper/project-sync-git-ssh-command.js';
import { decodeRouteSegment } from '../http/route-segment.js';
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
import { handleProjectSyncRoutes } from '../../project-sync/http/project-sync-routes.js';
import { executeFederatedProjectSyncRole } from '../../project-sync/runtime/execute-federated-project-sync-role.js';
import { handleLedgerReadRoutes } from '../../ledger/http/ledger-read-routes.js';
import { handleCardContentRoutes } from '../../ledger/http/card-content-routes.js';
import { handleTaskExecutionReadRoutes } from '../../codex/http/task-execution-read-routes.js';
import { handleInternalTaskExecutionRoutes } from '../../codex/http/internal-task-execution-routes.js';
import { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import { handleDeliveryRoutes } from '../../delivery/http/delivery-routes.js';
import { handleRuntimeRecoveryRoute } from '../http/runtime-recovery-route.js';
import { resumeRuntimeScope } from '../runtime/resume-runtime-scope.js';
import { handleLegacyLedgerRoutes } from '../../ledger/http/legacy-ledger-routes.js';
import { createLedgerPersistence } from '../../ledger/runtime/ledger-persistence.js';

type AnyRecord = Record<string, unknown>;
type MutationError = { statusCode: number; body: AnyRecord };

const federationNodeMessageTimeoutMs = 30 * 60_000;
const federatedLibraryRequestTimeoutMs = 60_000;
const federatedLibraryRetryDelaysMs = [1_000, 3_000] as const;
const federatedLibraryRecoveryDelayMs = 30_000;

class FederatedLibraryRequestError extends Error {
  constructor(readonly detail: {
    code: string;
    nodeId: string;
    nodeLabel: string;
    path: string;
    requestId: string;
    status: number;
    elapsedMs: number;
    deadlineMs: number;
    responseBytes: number;
  }, message: string) {
    super(message);
  }
}

const ledgerRevisionHeader = 'x-decision-os-ledger-revision';

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
  type ProjectContext = {
    clients: Set<ServerResponse>;
    revisions: ReturnType<typeof createLedgerRevisionTracker>;
    runtime: AnyRecord;
    publishCard: (event: CardContentChange | AnyRecord) => void;
    publishLedger: (event: AnyRecord) => void;
    watcher: ReturnType<typeof watchProjectFiles>;
  };
  const projectContexts = new Map<string, ProjectContext>();
  const federatedSchedulerContexts = new Map<string, { root: string; runtime: AnyRecord }>();
  const startupProjectTasks: Promise<void>[] = [];
  const projectCatalogStore = createProjectCatalogStore({ masterRoot, masterDecisionOsRoot });
  let controlRoomProjectionStore: ReturnType<typeof createControlRoomProjectionStore> | null = null;
  let federation: ReturnType<typeof createFederationNodeConnector> | null = null;
  let federationTaskStateReplicator: ReturnType<typeof createFederationTaskStateReplicator> | null = null;
  const federationContentStore = createFederationContentReplicaStore({ decisionOsRoot: masterDecisionOsRoot });
  let federationContentScheduler: ReturnType<typeof createFederationContentScheduler> | null = null;
  type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;
  const federatedExecutionObservations = new Map<string, TaskExecutionObservation>();
  type ExecutionPresentationProjection = {
    events: readonly TaskExecutionPresentationEvent[];
    hydrated: boolean;
  };
  const executionPresentations = new Map<string, ExecutionPresentationProjection>();
  const executionPresentationKey = (projectId: string, executionId: string, executorNodeId: string): string => (
    `${projectId}\0${executionId}\0${executorNodeId}`
  );
  const applyExecutionPresentationEvents = (input: {
    projectId: string;
    executionId: string;
    executorNodeId: string;
    update: { reset: boolean; events: readonly TaskExecutionPresentationEvent[] };
    hydrated?: boolean;
  }): ExecutionPresentationProjection => {
    const key = executionPresentationKey(input.projectId, input.executionId, input.executorNodeId);
    const current = executionPresentations.get(key);
    const projection = {
      events: applyTaskExecutionPresentationUpdate(current?.events ?? [], input.update),
      hydrated: input.hydrated ?? current?.hydrated ?? input.update.reset,
    };
    executionPresentations.set(key, projection);
    return projection;
  };
  const federatedPipelinePresentations = new Map<string, AnyRecord>();
  const terminalArtifactHydrations = new Map<string, Promise<void>>();
  let serverClosing = false;
  const serverCloseAbort = new AbortController();
  let projectSyncController: ReturnType<typeof createProjectSyncController> | null = null;
  let resumeProjectSyncRuntime: (() => void) | null = null;
  let publishPipelineRunSnapshot = (
    _projectId: string,
    _pipelineRunId: string,
    _executionId: string,
  ): void => {};
  let scheduleTerminalArtifactHydration = (
    _projectId: string,
    _executorNodeId: string,
    _record: ReturnType<ProjectTaskState['executions']['find']>,
  ): void => {};

  const disposeProjectContext = (context: ProjectContext): void => {
    stopCodexRuntimeTimers(context.runtime);
    stopAdoptedTaskExecutionMonitors(context.runtime);
    stopTaskExecutionCancellationDeadlines(context.runtime);
    context.watcher.close();
    context.clients.clear();
  };

  const incidentSupervisor = createIncidentSupervisor({ incidentLedger });
  const {
    assertCodexRuntimeAvailable,
    pauseGlobalRuntime,
    pauseTaskProject,
    pausedBackgroundComponents,
    pausedFederatedTaskProjects,
    pausedProjectRuntimes,
    pausedProjectWatchers,
    pausedTaskProjects,
    recordBackgroundFailure,
    recordIncident,
    recordStoppedOperation,
    taskProjectsPendingFrameIncidentRevalidation,
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

  const publishTaskExecutionPresentationEvents = (input: {
    projectId: string;
    executionId: string;
    events: readonly TaskExecutionPresentationEvent[];
    reset?: boolean;
  }): void => {
    if (!input.projectId || !input.executionId) return;
    const executorNodeId = federation?.localOwner().ownerNodeId ?? 'local';
    applyExecutionPresentationEvents({
      projectId: input.projectId,
      executionId: input.executionId,
      executorNodeId,
      update: {
        reset: input.reset === true,
        events: input.events,
      },
    });
    if (!federation) return;
    const chunks = Array.from(
      { length: Math.max(1, Math.ceil(input.events.length / 128)) },
      (_, index) => input.events.slice(index * 128, (index + 1) * 128),
    );
    chunks.forEach((events, index) => {
      federation?.publishExecutionObservation(input.projectId, {
        executionId: input.executionId,
        presentation: {
          reset: input.reset === true && index === 0,
          events,
        },
      });
    });
  };

  const locallyHydratedTaskExecutionPresentation = (
    state: Pick<ProjectTaskState, 'executions'>,
    execution: NonNullable<ReturnType<ProjectTaskState['executions']['find']>>,
  ): TaskExecutionPresentation | null => {
    if (!['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.lifecycle.phase)) return null;
    const heads = [execution.artifacts.jsonl, execution.artifacts.stderr].filter((head) => head !== null);
    if (heads.some((head) => !existsSync(federationContentStore.objectFile(head.hash)))) return null;
    const artifactRuntime: AnyRecord = {
      taskExecutionNodeId: federation?.localOwner().ownerNodeId ?? 'local',
      taskExecutionArtifactFile: (hash: string) => /^[a-f0-9]{64}$/i.test(hash)
        ? federationContentStore.objectFile(hash)
        : '',
    };
    const result = buildTaskExecutionPresentation({
      executionId: execution.metadata.executionId,
      state,
      runtime: artifactRuntime,
    });
    return 'presentation' in result ? result.presentation : null;
  };
  const requestRemoteExecutionPresentation = async (input: {
    projectId: string;
    execution: NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;
    request: IncomingMessage;
    response: ServerResponse;
  }): Promise<
    | { ok: true; presentation: TaskExecutionPresentation }
    | { ok: false; statusCode: number; body: string }
  > => {
    const executionId = input.execution.metadata.executionId;
    const executorNodeId = input.execution.lifecycle.executorNodeId;
    if (!federation) {
      return {
        ok: false,
        statusCode: 503,
        body: JSON.stringify({ ok: false, error: 'assigned_node_unreachable', executionId, executorNodeId }),
      };
    }
    const requestScope = createDeliveryHttpRequestScope({
      request: input.request,
      response: input.response,
      timeoutMs: 10_000,
    });
    try {
      const remote = await federation.request(
        executorNodeId,
        `/api/internal/task-executions/${encodeURIComponent(executionId)}/presentation?projectId=${encodeURIComponent(input.projectId)}`,
        { timeoutMs: 10_000, signal: requestScope.signal },
      );
      if (remote.status < 200 || remote.status >= 300) {
        return { ok: false, statusCode: remote.status || 502, body: remote.body.toString('utf8') };
      }
      const presentation = JSON.parse(remote.body.toString('utf8') || '{}') as TaskExecutionPresentation;
      if (presentation.execution?.executionId !== executionId
        || !Array.isArray(presentation.events)
        || !presentation.events.every(isTaskExecutionPresentationEvent)) {
        return {
          ok: false,
          statusCode: 502,
          body: JSON.stringify({ ok: false, error: 'task_execution_remote_response_invalid', executionId }),
        };
      }
      const key = executionPresentationKey(input.projectId, executionId, executorNodeId);
      const events = applyTaskExecutionPresentationUpdate(presentation.events, {
        reset: false,
        events: executionPresentations.get(key)?.events ?? [],
      });
      executionPresentations.set(key, { events, hydrated: true });
      return {
        ok: true,
        presentation: { ...presentation, events },
      };
    } catch (error) {
      return {
        ok: false,
        statusCode: requestScope.signal.aborted ? 504 : 502,
        body: JSON.stringify({
          ok: false,
          error: requestScope.signal.aborted ? 'task_execution_read_timeout' : 'task_execution_remote_request_failed',
          executionId,
          message: error instanceof Error ? error.message : String(error),
        }),
      };
    } finally {
      requestScope.dispose();
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
      ...[...projectContexts.entries()].map(([root, context]) => ({
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
  const projectContext = (activeDecisionOsRoot: string, projectId: string): ProjectContext => {
    const existing = projectContexts.get(activeDecisionOsRoot);
    if (existing) return existing;
    const clients = new Set<ServerResponse>();
    const revisions = createLedgerRevisionTracker();
    const projectRuntime = activeDecisionOsRoot === masterDecisionOsRoot
      ? Object.assign(runtime, { decisionOsRoot: activeDecisionOsRoot, projectId })
      : Object.assign({}, runtime, { decisionOsRoot: activeDecisionOsRoot, projectId });
    const codexRuntimeComponent = `codex-runtime:${projectId}`;
    projectRuntime.codexRuntimePaused = pausedBackgroundComponents.has(codexRuntimeComponent);
    projectRuntime.onCodexBackgroundError = (event: AnyRecord): void => {
      const reported = event.error;
      const error = reported instanceof Error ? reported : new Error(String(reported ?? 'Unknown Codex background failure.'));
      const operation = String(event.operation ?? 'project-canonical-codex-execution');
      const context = event.context && typeof event.context === 'object' ? event.context as AnyRecord : {};
      if (isExecutionScopedCodexFailure(operation)) {
        const executionIdentity = String(context.executionId ?? context.runId ?? 'unknown');
        recordStoppedOperation({
          scope: `codex-execution:${projectId}:${executionIdentity}`,
          component: 'codex-execution',
          operation,
          error,
          context: { projectId, decisionOsRoot: activeDecisionOsRoot, ...context },
        });
        return;
      }
      if (isTaskStateBootstrapGate(reported)) {
        projectRuntime.taskStatePersistenceError = error.message;
        recordStoppedOperation({
          scope: `project-task-write:${projectId}`,
          component: codexRuntimeComponent,
          operation,
          error,
          context: {
            projectId,
            decisionOsRoot: activeDecisionOsRoot,
            ...context,
          },
        });
        return;
      }
      projectRuntime.codexRuntimePaused = true;
      recordBackgroundFailure(codexRuntimeComponent, operation, error, {
        projectId,
        decisionOsRoot: activeDecisionOsRoot,
        ...context,
      });
    };
    if (activeDecisionOsRoot !== masterDecisionOsRoot) {
      readDecisionOsSettings({ action_payload: { decisionOsRoot: activeDecisionOsRoot }, runtime_state: projectRuntime });
    }
    projectRuntime.globalCodexProcessCapacity = globalCodexProcessCapacity;
    projectRuntime.globalCodexRunningProcessCount = globalCodexRunningProcessCount;
    projectRuntime.globalCodexQueuePosition = globalCodexQueuePosition;
    // WHAT: Bind every direct-child capacity wait to the owning server lifecycle.
    // WHY: Server close must settle waits even when the caller supplied no cancellation signal.
    projectRuntime.acquireProjectSyncCodexSlot = (options: CodexSlotAcquireOptions = {}) => sharedCodexCapacitySlots.acquire({
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, serverCloseAbort.signal])
        : serverCloseAbort.signal,
    });
    projectRuntime.persistTaskLedgerProjection = async (ledger: AnyRecord, command: TaskProjectionCommand): Promise<{ ledger: AnyRecord }> => {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId);
      if (!project) throw new Error(`Task-state authority has no project ${projectId}.`);
      return taskStateForProject(project).executeProjectionCommand(command, ledger);
    };
    projectRuntime.readTaskLedgerProjection = (): AnyRecord => {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId);
      if (!project) throw new Error(`Task-state authority has no project ${projectId}.`);
      return taskStateForProject(project).projection().ledger;
    };
    projectRuntime.materializeTaskResources = async (
      keys: string[],
      validate?: (key: string, body: string) => void | Promise<void>,
    ): Promise<void> => {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
      if (!project) throw new Error(`Task-state authority has no available project ${projectId}.`);
      await materializeTaskResources({
        projectId,
        decisionOsRoot: project.decisionOsRoot,
        keys,
        store: taskStateForProject(project).store,
        contentStore: federationContentStore,
        drain: federationContentScheduler?.drain ?? null,
        validate,
      });
    };
    projectRuntime.persistTaskLedgerMutation = async (mutation: LedgerMutation): Promise<{ ledger: AnyRecord }> => {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
      if (!project) throw new Error(`Task-state authority has no available project ${projectId}.`);
      const state = taskStateForProject(project);
      const before = structuredClone(state.projection().ledger);
      const ledgerPath = resolve(
        project.decisionOsRoot,
        tasksLedgerForProject(project).ledgerFile.replace(/^\.decision-os\//, ''),
      );
      // WHAT: Resolve every projected task resource before entering the synchronous mutation layer.
      // WHY: Local messages and voice updates must persist immediately without converting missing replica bytes into empty content.
      await materializeTaskMutationInputs({
        projectId,
        decisionOsRoot: project.decisionOsRoot,
        ledger: before,
        mutation,
        store: state.store,
        contentStore: federationContentStore,
        drain: federationContentScheduler?.drain ?? null,
      });
      const after = structuredClone(before);
      const mutationResult = applyLedgerMutation({
        decisionOsRoot: project.decisionOsRoot,
        ledgerPath,
        ledger: after,
        mutation,
      });
      if (mutationResult.error) {
        throw new Error(String(mutationResult.error.body.error ?? 'Task ledger mutation failed.'));
      }
      const committed = await state.executeMutation(mutation, before, after, mutationResult.changedContentFiles);
      if (committed.changed) controlRoomProjectionStore?.invalidate(projectId, committed.localChanges);
      return { ledger: committed.ledger };
    };
    let watcher: ReturnType<typeof watchProjectFiles> | null = null;
    const broadcast = (message: string): void => {
      for (const client of clients) client.write(message);
      for (const client of globalContentEventClients) client.write(message);
    };
    const publishCard = (event: CardContentChange | AnyRecord): void => {
      const ledgerId = String(event.ledgerId ?? '');
      const hasCompleteScope = Boolean(ledgerId && (event.kind !== 'thread-content' || String(event.threadId ?? '')));
      const resolvedEvent = hasCompleteScope ? null : resolveCardContentChange({
        decisionOsRoot: activeDecisionOsRoot,
        taskProjection: () => activeTaskState?.projection().ledger ?? null,
        change: {
          contentFile: String(event.contentFile ?? ''),
          file: String(event.file ?? resolve(activeDecisionOsRoot, String(event.contentFile ?? '').replace(/^\/?\.decision-os\//, ''))),
          kind: event.kind === 'thread-content' ? 'thread-content' : 'card-content'
        }
      });
      const scopedEvent = hasCompleteScope ? event : resolvedEvent ? { ...event, ...resolvedEvent } : null;
      if (!scopedEvent) return;
      // WHAT: Capture the changed task resource directly from its watcher ownership record.
      // WHY: Exact heads must replicate without rebuilding a complete content manifest.
      if (String(scopedEvent.ledgerId) === 'tasks') {
        const taskId = String(scopedEvent.cardId ?? (String(scopedEvent.threadId ?? '').startsWith('thread-') ? String(scopedEvent.threadId).slice('thread-'.length) : ''));
        const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
        if (!serverClosing && project && taskId) void Promise.resolve()
          .then(() => taskStateForProject(project).recordContentContribution(taskId, String(scopedEvent.contentFile ?? '')))
          .then((delta) => controlRoomProjectionStore?.invalidate(projectId, delta.entities))
          .catch((error: unknown) => {
            if (!serverClosing) recordProjectBackgroundFailure(project, error, 'capture-watched-task-content');
          });
      }
      const invalidationRevision = revisions.advance(String(scopedEvent.ledgerId));
      broadcast(`event: card-content-change\ndata: ${JSON.stringify({ ...scopedEvent, projectId, invalidationRevision })}\n\n`);
      federation?.publishContentChange();
    };
    const publishLedger = (event: AnyRecord): void => {
      if (event.kind === 'state') projectCatalogStore.refresh(projectId);
      controlRoomProjectionStore?.invalidate(projectId);
      watcher?.refreshOwnership();
      const ledgerId = String(event.ledgerId ?? '');
      const invalidationRevision = ledgerId ? revisions.advance(ledgerId) : 0;
      broadcast(`event: ledger-content-change\ndata: ${JSON.stringify({ ...event, projectId, invalidationRevision })}\n\n`);
      federation?.publishContentChange();
      const pipelineRunId = String(event.pipelineRunId ?? '');
      if (pipelineRunId) {
        publishPipelineRunSnapshot(projectId, pipelineRunId, String(event.executionId ?? ''));
      }
    };
    let activeTaskState: ProjectTaskState | null = null;
    if (projectId) {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId);
      if (!project) throw new Error(`Canonical Codex execution runtime has no project ${projectId}.`);
      const nodeId = String(federation?.localOwner().ownerNodeId
        ?? (projectRuntime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId
        ?? (runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId
        ?? 'local').trim() || 'local';
      const taskProjection = (): ProjectTaskState => taskStateForProject(project);
      Object.defineProperty(projectRuntime, 'taskExecutionNodeId', {
        value: nodeId,
        configurable: true,
        enumerable: false,
      });
      Object.defineProperty(projectRuntime, 'routeTaskExecutionCancellation', {
        value: async (executionId: string, executorNodeId: string) => {
          if (!federation || !federation.nodes().some((peer) => peer.nodeId === executorNodeId && peer.online)) {
            return { ok: false, statusCode: 503, error: 'assigned_node_unreachable', executionId, executorNodeId };
          }
          const remote = await federation.request(
            executorNodeId,
            `/api/internal/task-executions/${encodeURIComponent(executionId)}/cancel`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: Buffer.from(JSON.stringify({ projectId })),
            },
          );
          try {
            const result = JSON.parse(remote.body.toString('utf8') || '{}') as AnyRecord;
            return { ...result, statusCode: remote.status };
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
      activeTaskState = pausedTaskProjects.has(projectId) ? null : tryTaskStateForProject(project);
      if (activeTaskState) {
        Object.defineProperty(projectRuntime, 'taskExecutionRouter', {
          value: taskExecutionRouterForProject(project),
          configurable: true,
          enumerable: false,
        });
        Object.defineProperty(projectRuntime, 'taskExecutionState', {
          value: activeTaskState,
          configurable: true,
          enumerable: false,
        });
        Object.defineProperty(projectRuntime, 'taskExecutionArtifactFile', {
          value: (hash: string) => /^[a-f0-9]{64}$/i.test(hash)
            ? resolve(activeTaskState.store.root, 'objects', hash.slice(0, 2), hash)
            : '',
          configurable: true,
          enumerable: false,
        });
      }
    }
    projectRuntime.onPipelineLedgerChange = publishLedger;
    projectRuntime.scheduleCodexProcesses = scheduleGlobalCodexProcesses;
    projectRuntime.publishTaskExecutionPresentationEvents = (event: AnyRecord): void => {
      publishTaskExecutionPresentationEvents({
        projectId: String(event.projectId ?? ''),
        executionId: String(event.executionId ?? ''),
        events: Array.isArray(event.events) ? event.events as TaskExecutionPresentationEvent[] : [],
      });
    };
    projectRuntime.onCodexRunAccepted = (event: AnyRecord): void => {
      publishLedger({
        reason: 'codex-run-accepted', ledgerId: String(event.ledgerId ?? ''), runId: String(event.runId ?? ''),
        executionId: String(event.executionId ?? ''), status: String(event.status ?? 'pending'),
        cardId: String(event.cardId ?? ''), outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
        threadId: String(event.threadId ?? '')
      });
    };
    projectRuntime.onCodexTurnStarted = (event: AnyRecord): void => {
      publishLedger({
        reason: 'codex-turn-started', ledgerId: String(event.ledgerId ?? ''), runId: String(event.runId ?? ''),
        executionId: String(event.executionId ?? ''), status: String(event.status ?? 'running'),
        cardId: String(event.cardId ?? ''), outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
        threadId: String(event.threadId ?? ''), startedAt: String(event.startedAt ?? '')
      });
    };
    projectRuntime.onCodexRunSettled = async (event: AnyRecord): Promise<void> => {
      const ledgerId = String(event.ledgerId ?? '');
      const cardId = String(event.cardId ?? event.outputCardId ?? '');
      const executionId = String(event.executionId ?? '');
      let status = String(event.status ?? '');
      let finishedAt = String(event.finishedAt ?? '');
      let durablePipelineExecution = false;
      let taskId = '';
      if (ledgerId === 'tasks') {
        if (!activeTaskState) throw new Error(`task_execution_state_unavailable:${projectId}`);
        const execution = activeTaskState.executions.find(executionId);
        if (!execution) throw new Error(`task_execution_not_found:${executionId}`);
        if (execution.metadata.ledgerId !== 'tasks') throw new Error(`task_execution_ledger_mismatch:${executionId}`);
        const committedExecution = committedTaskExecutionSettlement(execution);
        status = committedExecution.status;
        finishedAt = committedExecution.finishedAt;
        taskId = String(execution.metadata.taskId ?? '');
        if (!taskId) throw new Error(`task_execution_task_missing:${executionId}`);
        durablePipelineExecution = execution.metadata.kind === 'pipeline-skill';
        if (!durablePipelineExecution || event.pipelineTerminal === true) {
          const committedTask = await activeTaskState.transitionCardLifecycle(taskId, 'todo', finishedAt);
          if (committedTask.changed) controlRoomProjectionStore?.invalidate(projectId, committedTask.localChanges);
        }
      }
      const directSettlementEvent = {
        reason: 'codex-thread-settled', ledgerId, status, finishedAt,
        runId: String(event.runId ?? ''), executionId, cardId,
        outputCardId: String(event.outputCardId ?? event.cardId ?? ''), threadId: String(event.threadId ?? '')
      };
      if (!event.pipelineRunId && !durablePipelineExecution) {
        publishLedger(directSettlementEvent);
      }
      if (event.pipelineRunId && event.pipelineTerminal === true) {
        const reportedPipelineStatus = String(event.pipelineStatus ?? status);
        const pipelineStatus = status === 'cancelled' || status === 'failed'
          ? status
          : reportedPipelineStatus;
        publishLedger({
          reason: pipelineStatus === 'complete' ? 'pipeline-completed' : pipelineStatus === 'cancelled' ? 'pipeline-cancelled' : 'pipeline-failed',
          ledgerId: String(event.ledgerId ?? ''), pipelineRunId: String(event.pipelineRunId), pipelineStatus,
          status, finishedAt, runId: String(event.runId ?? ''),
          executionId,
          cardId: String(event.cardId ?? event.outputCardId ?? ''), outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
          threadId: String(event.threadId ?? '')
        });
      }
    };
    watcher = watchProjectFiles({
      decisionOsRoot: activeDecisionOsRoot,
      taskProjection: () => activeTaskState?.projection().ledger ?? null,
      onContentChange: publishCard,
      onProjectChange: publishLedger,
      onError: (error, context) => {
        const incident = recordIncident({
          scope: `project-watcher:${projectId}`,
          component: 'project-file-watcher',
          operation: context.operation,
          error,
          context: { projectId, decisionOsRoot: activeDecisionOsRoot, file: context.file },
        });
        telemetry('runtime-scope-paused', { scope: incident.scope, incidentId: incident.id, projectId });
        pausedProjectWatchers.add(projectId);
        watcher?.close();
      },
    });
    const context: ProjectContext = { clients, revisions, runtime: projectRuntime, publishCard, publishLedger, watcher };
    projectContexts.set(activeDecisionOsRoot, context);
    const startupComponent = `codex-startup-${projectId}`;
    const recoverCodexStartup = async (recordBootstrapGate = true): Promise<void> => {
      try {
        await recoverTaskExecutions(projectRuntime);
        const codexScope = `background:${codexRuntimeComponent}`;
        const retainedRecoverableIncidents = incidentLedger.active().filter((incident) => incident.scope === codexScope);
        if (retainedRecoverableIncidents.length > 0 && retainedRecoverableIncidents.every((incident) => (
          isTaskStateBootstrapGate(incident.code) || isExecutionScopedCodexFailure(incident.operation)
        ))) {
          incidentLedger.resolveScope(codexScope, 'Replicated execution recovery completed; execution-scoped failures no longer pause the project runtime.');
          pausedBackgroundComponents.delete(codexRuntimeComponent);
          projectRuntime.codexRuntimePaused = false;
        }
        delete projectRuntime.taskStatePersistenceError;
      } catch (error) {
        projectRuntime.taskStatePersistenceError = error instanceof Error ? error.message : String(error);
        // WHAT: Defer write-required Codex recovery until the local task root matches the relay.
        // WHY: Federation starts only after the HTTP listener opens, so this startup gate is expected and retryable.
        if (isTaskStateBootstrapGate(error)) {
          if (recordBootstrapGate) recordStoppedOperation({
            scope: `project-task-write:${projectId}`,
            component: startupComponent,
            operation: 'reconcile-codex-startup-state',
            error,
            context: { projectId, decisionOsRoot: activeDecisionOsRoot },
          });
          scheduleCodexRuntimeTimer(
            projectRuntime,
            'task-state-bootstrap-recovery',
            1_000,
            'retry-codex-startup-state',
            () => recoverCodexStartup(false),
            { projectId, decisionOsRoot: activeDecisionOsRoot },
          );
          return;
        }
        recordBackgroundFailure(startupComponent, 'reconcile-codex-startup-state', error, { projectId, decisionOsRoot: activeDecisionOsRoot });
      }
    };
    const startupTask = pausedTaskProjects.has(projectId) || pausedBackgroundComponents.has(startupComponent) || projectRuntime.codexRuntimePaused === true
      ? Promise.resolve()
      : recoverCodexStartup();
    startupProjectTasks.push(startupTask);
    return context;
  };
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
  const tryProjectContext = (project: DecisionOsProject, operation: string): ProjectContext | null => {
    if (pausedProjectWatchers.has(project.id) || pausedProjectRuntimes.has(project.id)) return null;
    try { return projectContext(project.decisionOsRoot, project.id); }
    catch (error) {
      // WHAT: Preserve the incident boundary that already paused the owning task-state scope.
      // WHY: Promoting a contained project-state failure into a second runtime incident
      // misreports one root cause as two unavailable components.
      if (error instanceof RuntimeScopePausedError) return null;
      recordIncident({
        scope: `project-runtime:${project.id}`,
        component: 'project-runtime',
        operation,
        error,
        context: { projectId: project.id, projectName: project.name, decisionOsRoot: project.decisionOsRoot },
      });
      pausedProjectRuntimes.add(project.id);
      return null;
    }
  };
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
  let federationSyncRequested = false;
  let federationSyncForceRefresh = false;
  let federationSyncPromise: Promise<void> | null = null;
  const localWorkspaceRoots = (): string[] => [
    masterRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.root),
  ];
  const localDecisionOsRoots = (): string[] => [
    masterDecisionOsRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.decisionOsRoot),
  ];
  let availableServerSkillNames: string[] = [];
  let federatedSkillExportIndex: FederatedSkillExportIndex | null = null;
  let federatedSkillExportIndexPromise: Promise<FederatedSkillExportIndex> | null = null;
  let federatedSkillExportIndexGeneration = 0;
  const invalidateFederatedSkillExportIndex = (): void => {
    federatedSkillExportIndexGeneration += 1;
    federatedSkillExportIndex = null;
    federatedSkillExportIndexPromise = null;
  };
  const readFederatedSkillExportIndex = async (): Promise<FederatedSkillExportIndex> => {
    if (federatedSkillExportIndex) return federatedSkillExportIndex;
    if (federatedSkillExportIndexPromise) return await federatedSkillExportIndexPromise;
    const generation = federatedSkillExportIndexGeneration;
    const pending = createFederatedSkillExportIndex(masterRoot, localWorkspaceRoots());
    federatedSkillExportIndexPromise = pending;
    try {
      const index = await pending;
      if (generation === federatedSkillExportIndexGeneration) federatedSkillExportIndex = index;
      return index;
    } finally {
      if (federatedSkillExportIndexPromise === pending) federatedSkillExportIndexPromise = null;
    }
  };
  const initializePipelineCatalog = (): void => {
    invalidateFederatedSkillExportIndex();
    availableServerSkillNames = readCodexSkillCatalog({ decisionOsRoot: masterDecisionOsRoot, runtime }).skills.map((skill) => skill.name);
    ensureServerPipelines({ serverDecisionOsRoot: masterDecisionOsRoot, availableSkillNames: availableServerSkillNames });
    migrateCodexSkillMetadataOwner({
      ownerDecisionOsRoot: masterDecisionOsRoot,
      sourceDecisionOsRoots: localDecisionOsRoots(),
      availableSkillNames: availableServerSkillNames,
    });
  };
  if (!pausedBackgroundComponents.has('pipeline-catalog')) {
    try {
      initializePipelineCatalog();
    } catch (error) {
      recordBackgroundFailure('pipeline-catalog', 'initialize-pipeline-catalog', error);
    }
  }
  const ownedSkillMetadata = () => new Map(
    readCodexPipelineStore({ decisionOsRoot: masterDecisionOsRoot, availableSkillNames: availableServerSkillNames })
      .store.skillLibrary.map((record) => [record.skillName, record]),
  );
  const applyOwnedSkillMetadata = <T extends { name: string; favorite?: boolean; tags?: string[] }>(skill: T): T =>
    applyCodexSkillMetadataOwner(skill, ownedSkillMetadata());
  const applyOwnedSkillDetail = (result: AnyRecord): AnyRecord => {
    const skill = result.skill;
    return result.ok === true && skill && typeof skill === 'object'
      ? { ...result, skill: applyOwnedSkillMetadata(skill as AnyRecord & { name: string; favorite?: boolean; tags?: string[] }) }
      : result;
  };
  let federationSyncRetryTimer: NodeJS.Timeout | null = null;
  const parseFederationResponse = <T>(input: {
    result: FederationInternalResponse;
    nodeId: string;
    nodeLabel: string;
    path: string;
    startedAt: number;
  }): T => {
    const elapsedMs = Date.now() - input.startedAt;
    let payload: AnyRecord = {};
    try { payload = JSON.parse(input.result.body.toString('utf8')) as AnyRecord; }
    catch { /* The typed error below retains response size and transport status. */ }
    if (input.result.status !== 200) {
      const code = String(payload.error ?? `federation_http_${input.result.status}`);
      throw new FederatedLibraryRequestError({
        code,
        nodeId: input.nodeId,
        nodeLabel: input.nodeLabel,
        path: input.path,
        requestId: input.result.requestId,
        status: input.result.status,
        elapsedMs,
        deadlineMs: federatedLibraryRequestTimeoutMs,
        responseBytes: input.result.body.byteLength,
      }, `${input.nodeLabel} ${input.path} returned HTTP ${input.result.status}.`);
    }
    try { return JSON.parse(input.result.body.toString('utf8')) as T; }
    catch {
      throw new FederatedLibraryRequestError({
        code: 'federation_invalid_json',
        nodeId: input.nodeId,
        nodeLabel: input.nodeLabel,
        path: input.path,
        requestId: input.result.requestId,
        status: input.result.status,
        elapsedMs,
        deadlineMs: federatedLibraryRequestTimeoutMs,
        responseBytes: input.result.body.byteLength,
      }, `${input.nodeLabel} ${input.path} returned invalid JSON.`);
    }
  };
  const requestFederatedLibrary = async <T>(peer: { nodeId: string; nodeLabel: string }, path: string): Promise<T> => {
    const startedAt = Date.now();
    return parseFederationResponse<T>({
      result: await federation!.request(peer.nodeId, path, { timeoutMs: federatedLibraryRequestTimeoutMs }),
      nodeId: peer.nodeId,
      nodeLabel: peer.nodeLabel,
      path,
      startedAt,
    });
  };
  const wait = (delayMs: number): Promise<void> => new Promise((resolveWait) => {
    const timer = setTimeout(resolveWait, delayMs);
    timer.unref?.();
  });
  const performFederatedLibrarySynchronization = async (forceRefresh: boolean): Promise<number> => {
    const peers = federation?.nodes().filter((node) => node.online) ?? [];
    if (peers.length === 0) return 0;
    // WHAT: Complete skill materialization is the first synchronization phase.
    // WHY: Pipeline validation and every Process Card consumer require local skill packages.
    for (const peer of peers) {
      const manifestPath = forceRefresh ? '/api/federation/skills-manifest?refresh=1' : '/api/federation/skills-manifest';
      const manifest = await requestFederatedLibrary<FederatedSkillManifest>(peer, manifestPath);
      const local = new Map((await readFederatedSkillExportIndex()).manifest.skills.map((skill) => [skill.name, skill.revision]));
      for (const skill of manifest.skills) {
        if (local.get(skill.name) === skill.revision) continue;
        const path = `/api/federation/skills-snapshot?name=${encodeURIComponent(skill.name)}`;
        const snapshot = await requestFederatedLibrary<FederatedSkillSnapshot>(peer, path);
        const imported = importFederatedSkillSnapshot({ serverRoot: masterRoot, snapshot });
        if (imported.imported.length > 0) invalidateFederatedSkillExportIndex();
      }
    }
    // WHAT: Pipeline definitions synchronize only after every available skill package is local.
    // WHY: The persisted pipeline catalog must normalize against the complete local skill set.
    for (const peer of peers) {
      const snapshot = await requestFederatedLibrary<FederatedPipelineSnapshot>(peer, '/api/federation/pipelines-snapshot');
      importFederatedPipelineSnapshot({ decisionOsRoot: masterDecisionOsRoot, snapshot });
    }
    return peers.length;
  };
  const synchronizeFederatedLibraries = (forceRefresh = false): Promise<void> => {
    federationSyncRequested = true;
    federationSyncForceRefresh ||= forceRefresh;
    if (federationSyncPromise) return federationSyncPromise;
    if (federationSyncRetryTimer) {
      clearTimeout(federationSyncRetryTimer);
      federationSyncRetryTimer = null;
    }
    const run = (async () => {
      do {
        federationSyncRequested = false;
        const forceRemoteRefresh = federationSyncForceRefresh;
        federationSyncForceRefresh = false;
        let synchronizedPeerCount = 0;
        for (let attempt = 1; attempt <= federatedLibraryRetryDelaysMs.length + 1; attempt += 1) {
          try {
            synchronizedPeerCount = await performFederatedLibrarySynchronization(forceRemoteRefresh);
            break;
          } catch (error) {
            if (!(error instanceof FederatedLibraryRequestError)) {
              recordBackgroundFailure('federated-library-sync', 'synchronize-federated-libraries', error);
              throw error;
            }
            runtime.federatedLibrarySyncStatus = { phase: 'retrying', attempt, ...error.detail, observedAt: new Date().toISOString() };
            recordIncident({
              severity: 'warning',
              scope: 'background:federated-library-sync',
              component: 'federated-library-sync',
              operation: 'synchronize-federated-libraries',
              code: 'federated_library_remote_unavailable',
              error,
              context: { ...error.detail, connectorCode: error.detail.code, attempt },
            });
            const retryDelay = federatedLibraryRetryDelaysMs[attempt - 1];
            if (retryDelay !== undefined) {
              await wait(retryDelay);
              continue;
            }
            federationSyncRetryTimer = setTimeout(() => {
              federationSyncRetryTimer = null;
              if (!pausedBackgroundComponents.has('federated-library-sync')) void synchronizeFederatedLibraries().catch(() => undefined);
            }, federatedLibraryRecoveryDelayMs);
            federationSyncRetryTimer.unref?.();
            return;
          }
        }
        if (synchronizedPeerCount === 0) {
          runtime.federatedLibrarySyncStatus = { phase: 'waiting-for-peer', observedAt: new Date().toISOString() };
          federationSyncRetryTimer = setTimeout(() => {
            federationSyncRetryTimer = null;
            if (!pausedBackgroundComponents.has('federated-library-sync')) void synchronizeFederatedLibraries().catch(() => undefined);
          }, federatedLibraryRecoveryDelayMs);
          federationSyncRetryTimer.unref?.();
          return;
        }
        runtime.federatedLibrarySyncStatus = { phase: 'synchronized', synchronizedPeerCount, observedAt: new Date().toISOString() };
        incidentLedger.resolveScope('background:federated-library-sync', 'Complete skills-then-pipelines synchronization succeeded.');
        pausedBackgroundComponents.delete('federated-library-sync');
      } while (federationSyncRequested);
    })().finally(() => {
      if (federationSyncPromise === run) federationSyncPromise = null;
      if (federationSyncRequested && !pausedBackgroundComponents.has('federated-library-sync')) void synchronizeFederatedLibraries()
        .catch(() => undefined);
    });
    federationSyncPromise = run;
    Object.defineProperty(runtime, 'federatedLibrarySyncPromise', { value: run, writable: true, configurable: true, enumerable: false });
    return run;
  };
  const publishLocalExecutionPresentationSnapshots = (): void => {
    const localNodeId = federation?.localOwner().ownerNodeId ?? 'local';
    const pipelineRuns = new Map<string, { projectId: string; executionId: string }>();
    for (const [projectId, state] of [...projectTaskStates, ...federatedExecutionStates]) {
      for (const record of state.executions.all()) {
        if (record.lifecycle.executorNodeId !== localNodeId) {
          scheduleTerminalArtifactHydration(projectId, record.lifecycle.executorNodeId, record);
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
  const publishAuthoredFederatedSkill = async (skillName: string, operation: 'create' | 'save' | 'retry'): Promise<AnyRecord> => {
    invalidateFederatedSkillExportIndex();
    federation?.publishManifest();
    const failed = (error: unknown): AnyRecord => {
      const incident = recordIncident({
        severity: 'warning',
        scope: `federated-skill-publication:${skillName}`,
        component: 'federated-library-sync',
        operation: 'publish-authored-federated-skill',
        code: 'federated_skill_publication_failed',
        error,
        context: { skillName, operation },
      });
      return {
        status: 'failed',
        retryable: true,
        retryPath: '/api/federation/libraries/synchronize',
        incidentId: incident.id,
      };
    };
    if (!federation || federation.status().phase !== 'connected') {
      return failed(new Error('The federation relay is not connected.'));
    }
    try {
      await synchronizeFederatedLibraries(true);
      const status = runtime.federatedLibrarySyncStatus as AnyRecord | undefined;
      if (status?.phase !== 'synchronized') {
        return failed(new Error('Federated library synchronization did not reach synchronized state.'));
      }
      incidentLedger.resolveScope(`federated-skill-publication:${skillName}`, 'Federated skill publication succeeded.');
      return { status: 'published' };
    } catch (error) {
      return failed(error);
    }
  };
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
      if (!pausedBackgroundComponents.has('federated-library-sync')) void synchronizeFederatedLibraries()
        .catch(() => undefined);
      projectSyncController?.resume();
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
    onExecutionObservation: (frame) => {
      const executionId = String(frame.payload?.executionId ?? '').trim();
      const key = `${frame.projectId}\0${executionId}\0${frame.from}`;
      if (!executionId || !frame.projectId || !frame.from) return;
      const record = executionStateForProject(frame.projectId, frame.from)?.executions.find(executionId) ?? null;
      let changed = false;
      const hasObservation = Object.prototype.hasOwnProperty.call(frame.payload, 'observation');
      const observation = frame.payload?.observation;
      const now = Date.now();
      const observedAt = observation ? Date.parse(observation.observedAt) : Number.NaN;
      const expiresAt = observation ? Date.parse(observation.expiresAt) : Number.NaN;
      if (hasObservation && observation === null) {
        federatedExecutionObservations.delete(key);
        changed = true;
      } else if (hasObservation && observation
        && observation.executionId === executionId
        && observation.executorNodeId === frame.from
        && (observation.phase === 'starting' || observation.phase === 'running')
        && Number.isSafeInteger(observation.revision) && observation.revision >= 1
        && Number.isFinite(observedAt) && observedAt <= now + 5_000
        && Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + 60_000
        && expiresAt > observedAt && expiresAt - observedAt <= 60_000) {
        federatedExecutionObservations.set(key, observation);
        changed = true;
      } else if (hasObservation) {
        recordStoppedOperation({
          scope: `federation-execution-observation:${frame.projectId}:${frame.from}`,
          component: 'federation-execution-observation',
          operation: 'validate-execution-observation',
          error: new Error('invalid_federated_execution_observation'),
          context: { projectId: frame.projectId, nodeId: frame.from, executionId },
        });
      }
      if (frame.payload?.presentation !== undefined) {
        if ((!record || record.lifecycle.executorNodeId === frame.from)
          && isTaskExecutionPresentationUpdate(frame.payload.presentation)) {
          applyExecutionPresentationEvents({
            projectId: frame.projectId,
            executionId,
            executorNodeId: frame.from,
            update: frame.payload.presentation,
          });
          changed = true;
        } else {
          recordStoppedOperation({
            scope: `federation-execution-presentation:${frame.projectId}:${frame.from}`,
            component: 'federation-execution-presentation',
            operation: 'validate-execution-presentation',
            error: new Error('invalid_federated_execution_presentation'),
            context: { projectId: frame.projectId, nodeId: frame.from, executionId },
          });
        }
      }
      if (frame.payload?.pipeline !== undefined) {
        const pipeline = frame.payload.pipeline;
        const result = pipeline?.result;
        const run = result?.run;
        const sourceOwnsProject = federation?.remoteProjects().some((project) => (
          project.ownerNodeId === frame.from && project.localProjectId === frame.projectId
        )) === true;
        let bytes = Number.POSITIVE_INFINITY;
        try { bytes = Buffer.byteLength(JSON.stringify(result)); } catch { /* Invalid cyclic payloads remain rejected. */ }
        if (sourceOwnsProject
          && typeof pipeline.runId === 'string'
          && pipeline.runId.length > 0
          && pipeline.runId.length <= 256
          && result && typeof result === 'object' && !Array.isArray(result)
          && run && typeof run === 'object' && !Array.isArray(run)
          && String((run as AnyRecord).id ?? '') === pipeline.runId
          && bytes <= 256 * 1024) {
          federatedPipelinePresentations.set(
            `${frame.projectId}\0${pipeline.runId}\0${frame.from}`,
            structuredClone(result),
          );
          changed = true;
        } else {
          recordStoppedOperation({
            scope: `federation-pipeline-presentation:${frame.projectId}:${frame.from}`,
            component: 'federation-pipeline-presentation',
            operation: 'validate-pipeline-presentation',
            error: new Error('invalid_federated_pipeline_presentation'),
            context: { projectId: frame.projectId, nodeId: frame.from, pipelineRunId: String(pipeline?.runId ?? '') },
          });
        }
      }
      if (!changed) return;
      controlRoomProjectionStore?.invalidate(frame.projectId);
      for (const client of globalContentEventClients) client.write(`event: codex-execution-change\ndata: ${JSON.stringify({
        remote: true,
        projectId: frame.projectId,
        nodeId: frame.from,
        executionId,
        taskId: record?.metadata.taskId ?? '',
        sourceCardId: record?.metadata.sourceCardId ?? '',
        phase: record?.lifecycle.phase ?? '',
        revision: record?.lifecycle.revision ?? 0,
      })}\n\n`);
    },
    onStateConnected: () => {
      federationTaskStateReplicator?.reconcileRelay();
      for (const project of federation?.remoteProjects().filter((entry) => entry.online) ?? []) {
        federationTaskStateReplicator?.reconcileProject(project.ownerNodeId, project.localProjectId);
      }
      publishLocalExecutionPresentationSnapshots();
      if (!pausedBackgroundComponents.has('federated-library-sync')) void synchronizeFederatedLibraries().catch(() => undefined);
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
  scheduleTerminalArtifactHydration = (projectId, executorNodeId, record): void => {
    if (!record
      || !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(record.lifecycle.phase)
      || executorNodeId === federation?.localOwner().ownerNodeId
      || !federation?.nodes().some((node) => node.nodeId === executorNodeId && node.online)) return;
    const heads = [record.artifacts.jsonl, record.artifacts.stderr].filter((head) => (
      head !== null && !existsSync(federationContentStore.objectFile(head.hash))
    ));
    if (heads.length === 0) return;
    const key = `${projectId}\0${record.metadata.executionId}\0${executorNodeId}`;
    if (terminalArtifactHydrations.has(key)) return;
    const hydration = Promise.all(heads.map(async (head) => {
      const result = await federation!.requestToFile(
        executorNodeId,
        `/api/federation/content-object?projectId=${encodeURIComponent(projectId)}&hash=${encodeURIComponent(head.hash)}`,
        federationContentStore.objectFile(head.hash),
        head.hash,
      );
      if (result.status !== 200) throw new Error(`terminal_execution_artifact_fetch_failed:${result.status}`);
    })).then(() => undefined).catch((error: unknown) => {
      recordStoppedOperation({
        scope: `terminal-execution-artifact:${projectId}:${record.metadata.executionId}`,
        component: 'task-execution-artifact-cache',
        operation: 'hydrate-terminal-execution-artifacts',
        error,
        context: { projectId, executionId: record.metadata.executionId, executorNodeId },
      });
    }).finally(() => {
      terminalArtifactHydrations.delete(key);
    });
    terminalArtifactHydrations.set(key, hydration);
  };
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
        scheduleTerminalArtifactHydration(projectId, record?.lifecycle.executorNodeId ?? from, record);
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
  let projectSyncStore = createProjectSyncStore({ decisionOsRoot: masterDecisionOsRoot });
  const installProjectSyncRuntime = (store = createProjectSyncStore({ decisionOsRoot: masterDecisionOsRoot })): void => {
    if (store.corruptionError) throw store.corruptionError;
    const controller = createProjectSyncController({
      masterRoot,
      localNodeId: () => federation!.localOwner().ownerNodeId,
      projects: projectCatalog,
      catalog: projectCatalogStore,
      federation: federation!,
      store: projectSyncStore,
      runtimeForProject: (project) => projectContext(project.decisionOsRoot, project.id).runtime,
      gitSshCommand: () => projectSyncGitSshCommand(
        readDecisionOsSettings({
          action_payload: { decisionOsRoot: masterDecisionOsRoot },
          runtime_state: {},
        }).settings,
      ),
      onRunChange: (run) => {
        controlRoomProjectionStore?.invalidate();
        for (const client of globalContentEventClients) client.write(`event: project-sync-change\ndata: ${JSON.stringify({ syncId: run.syncId, phase: run.phase, preparationPhase: run.preparationPhase })}\n\n`);
      },
      onBackgroundError: (error, context) => {
        projectSyncController = null;
        recordBackgroundFailure('project-sync-runtime', context.operation, error, context);
      },
    });
    controller.resume();
    projectSyncStore = store;
    projectSyncController = controller;
  };
  resumeProjectSyncRuntime = installProjectSyncRuntime;
  if (projectSyncStore.corruptionError) {
    recordBackgroundFailure('project-sync-store', 'read-project-sync-store', projectSyncStore.corruptionError, { file: projectSyncStore.file });
  } else if (!pausedBackgroundComponents.has('project-sync-store') && !pausedBackgroundComponents.has('project-sync-runtime')) {
    installProjectSyncRuntime(projectSyncStore);
  }
  const activeProjectSyncController = (): NonNullable<typeof projectSyncController> => {
    if (projectSyncController) return projectSyncController;
    const incident = incidentLedger.active('background:project-sync-store')[0]
      ?? incidentLedger.active('background:project-sync-runtime')[0];
    if (incident) throw new RuntimeScopePausedError(incident.scope, incident.id);
    throw new Error('Project synchronization runtime is unavailable.');
  };
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
  let deliveryNodeContext: {
    receiptStore: ReturnType<typeof createDeliveryNodeReceiptStore>;
    releaseStore: ReturnType<typeof createNodeReleaseStore>;
  } | null = null;
  const requireDeliveryNodeContext = () => {
    if (deliveryNodeContext) return deliveryNodeContext;
    const settings = runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
      ? runtime.decisionOsSettings as AnyRecord
      : {};
    if (settings.deliveryProtocol !== 1) {
      throw new DeliveryNodeCommandError('delivery_node_not_bootstrapped', 'The local node has not adopted delivery protocol 1.', 503);
    }
    deliveryNodeContext = {
      receiptStore: createDeliveryNodeReceiptStore({ decisionOsRoot: masterDecisionOsRoot, incidentLedger }),
      releaseStore: createNodeReleaseStore({
        repositoryRoot: String(settings.deliveryRepositoryRoot ?? ''),
        releaseRoot: String(settings.deliveryReleaseRoot ?? ''),
        settings,
        decisionOsRoot: masterDecisionOsRoot,
        incidentLedger,
      }),
    };
    return deliveryNodeContext;
  };
  const runLocalDeliveryCommand = async (command: unknown, signal?: AbortSignal) => {
    const context = requireDeliveryNodeContext();
    const settings = runtime.decisionOsSettings as AnyRecord;
    return await executeDeliveryNodeCommand({
      command,
      nodeId: federation!.localOwner().ownerNodeId,
      settings,
      receiptStore: context.receiptStore,
      releaseStore: context.releaseStore,
      signal,
      readStatusEvidence: () => {
        const projectIds = projectCatalog()
          .filter((project) => project.available)
          .map((project) => project.id)
          .sort();
        const blockingIncidents = deliveryBlockingIncidents(incidentLedger.snapshot().incidents);
        const stateStatus = federationTaskStateReplicator?.diagnostics() ?? {
          convergence: [],
          runtimeDirty: [],
          pendingDeliveryIds: [],
        };
        const contentStatus = federationContentStore.status();
        const activePhases = new Set(['preparing', 'starting', 'running', 'cancelling']);
        const pendingPhases = new Set(['queued']);
        const localNodeId = federation!.localOwner().ownerNodeId;
        const localExecutions = [...projectTaskStates.values()]
          .flatMap((state) => state.executions.all())
          .filter((execution) => execution.lifecycle.executorNodeId === localNodeId);
        const pendingProcessQueueDepth = [
          ...[...projectContexts.entries()].map(([root, context]) => ({ root, runtime: context.runtime })),
          ...federatedSchedulerContexts.values(),
        ].reduce((count, candidate) => count + pendingCodexProcessEntries(candidate.root, candidate.runtime).length, 0);
        const release = decisionOsReleaseHealthIdentity(runtime.decisionOsSettings);
        const convergedProjectIds = projectIds.filter((projectId) => stateStatus.convergence.some((entry) => (
          entry.peerId === 'relay' && entry.projectId === projectId && entry.converged
        )));
        return [
          { key: 'observedAt', value: new Date().toISOString() },
          { key: 'ready', value: blockingIncidents.length === 0 },
          { key: 'catalogReady', value: projectIds.length > 0 },
          { key: 'projectCount', value: projectIds.length },
          { key: 'projectIds', value: projectIds.join(',') },
          { key: 'releaseSha', value: release.releaseSha },
          { key: 'processStartedAt', value: release.processStartedAt },
          { key: 'deliveryProtocol', value: release.deliveryProtocol },
          { key: 'activeReleasePointer', value: release.activeReleasePointer },
          { key: 'activeIncidentCount', value: blockingIncidents.length },
          { key: 'federationPhase', value: federation!.status().phase },
          { key: 'activeExecutionCount', value: localExecutions.filter((execution) => activePhases.has(execution.lifecycle.phase)).length },
          { key: 'pendingExecutionCount', value: localExecutions.filter((execution) => pendingPhases.has(execution.lifecycle.phase)).length },
          { key: 'pendingProcessQueueDepth', value: pendingProcessQueueDepth },
          { key: 'pausedScopeCount', value: blockingIncidents.length },
          { key: 'fatalIncidentCount', value: blockingIncidents.filter((incident) => incident.scope === 'server-runtime' && incident.severity === 'fatal').length },
          { key: 'stateRuntimeDirtyCount', value: stateStatus.runtimeDirty.length },
          { key: 'statePendingDeliveryCount', value: stateStatus.pendingDeliveryIds.length },
          { key: 'contentQueueDepth', value: contentStatus.queueDepth },
          { key: 'unavailableContentResourceCount', value: contentStatus.resources.filter((resource) => resource.state !== 'available').length },
          { key: 'convergedProjectIds', value: convergedProjectIds.join(',') },
          { key: 'converged', value: convergedProjectIds.length === projectIds.length },
        ];
      },
      scheduleSupervisedExit: () => {
        setImmediate(() => process.exit(0));
      },
    });
  };
  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requestPath = requestUrl.pathname;
    const runtimeRecoveryRoute = await handleRuntimeRecoveryRoute({
      request,
      response,
      resume: (scope, resolution) => resumeRuntimeScope({
        incidentLedger,
        incidentSupervisor,
        resolution,
        resumeBackground: async (component) => {
          if (component === 'pipeline-migration') migrateProjectPipelines();
          if (component === 'pipeline-catalog') initializePipelineCatalog();
          if (component === 'federated-library-sync') await synchronizeFederatedLibraries();
          if (component === 'codex-process-scheduler') await scheduleGlobalCodexProcesses();
          if (component === 'federation-content-scheduler') {
            await federationContentScheduler?.drain();
          }
          if (component === 'project-sync-store' || component === 'project-sync-runtime') {
            if (!resumeProjectSyncRuntime) {
              throw new Error('Project synchronization runtime is unavailable.');
            }
            resumeProjectSyncRuntime();
          }
          if (component.startsWith('codex-runtime:')) {
            const projectId = component.slice('codex-runtime:'.length);
            const project = projectCatalogStore.projects()
              .find((entry) => entry.id === projectId && entry.available);
            const activeContext = project
              ? projectContexts.get(project.decisionOsRoot)
              : null;
            if (!project || !activeContext) {
              throw new Error(`Codex runtime ${projectId} is unavailable.`);
            }
            try {
              await recoverTaskExecutions(activeContext.runtime);
              activeContext.runtime.codexRuntimePaused = false;
              await scheduleGlobalCodexProcesses();
            } catch (error) {
              activeContext.runtime.codexRuntimePaused = true;
              throw error;
            }
          }
          if (component.startsWith('codex-startup-')) {
            const projectId = component.slice('codex-startup-'.length);
            const project = projectCatalogStore.projects()
              .find((entry) => entry.id === projectId && entry.available);
            const activeContext = project
              ? projectContexts.get(project.decisionOsRoot)
              : null;
            if (!project || !activeContext) {
              throw new Error(`Project runtime ${projectId} is unavailable.`);
            }
            await recoverTaskExecutions(activeContext.runtime);
          }
          return true;
        },
        resumeFederatedTaskProject: (projectId) => {
          pausedFederatedTaskProjects.delete(projectId);
          federatedExecutionStates.delete(projectId);
          federatedTaskStores.delete(projectId);
          const resumed = Boolean(federatedTaskStoreForProject(projectId, 'operator-resume'));
          if (resumed) federationTaskStateReplicator?.reconcileProject('relay', projectId);
          return resumed;
        },
        resumeProjectRuntime: (projectId) => {
          const project = projectCatalogStore.projects()
            .find((entry) => entry.id === projectId && entry.available);
          if (!project) return false;
          pausedProjectRuntimes.delete(projectId);
          return Boolean(tryProjectContext(project, 'operator-resume-project-runtime'));
        },
        resumeProjectWatcher: (projectId) => {
          const project = projectCatalogStore.projects()
            .find((entry) => entry.id === projectId && entry.available);
          if (!project) return false;
          pausedProjectWatchers.delete(projectId);
          const activeContext = projectContexts.get(project.decisionOsRoot);
          if (activeContext) disposeProjectContext(activeContext);
          projectContexts.delete(project.decisionOsRoot);
          return Boolean(tryProjectContext(project, 'operator-resume-project-runtime'));
        },
        resumeTaskProject: (projectId) => {
          const project = projectCatalogStore.projects()
            .find((entry) => entry.id === projectId && entry.available);
          if (!project) return false;
          pausedTaskProjects.delete(projectId);
          projectTaskStates.delete(projectId);
          let resumed = Boolean(tryTaskStateForProject(project));
          if (resumed) {
            const activeContext = projectContexts.get(project.decisionOsRoot);
            if (activeContext) disposeProjectContext(activeContext);
            projectContexts.delete(project.decisionOsRoot);
            resumed = Boolean(tryProjectContext(project, 'operator-resume-task-state'));
          }
          if (resumed) federationTaskStateReplicator?.reconcileProject('relay', projectId);
          return resumed;
        },
        scope,
      }),
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
      admissionState: () => {
        const localNodeId = federation.localOwner().ownerNodeId;
        const projectIds = projectCatalog()
          .filter((project) => project.available)
          .map((project) => project.id)
          .sort();
        const activePhases = new Set(['preparing', 'starting', 'running', 'cancelling']);
        const pendingPhases = new Set(['queued']);
        const localExecutions = [...projectTaskStates.values()]
          .flatMap((state) => state.executions.all())
          .filter((execution) => execution.lifecycle.executorNodeId === localNodeId);
        const pendingProcessQueueDepth = [
          ...[...projectContexts.entries()].map(([root, activeContext]) => ({
            root,
            runtime: activeContext.runtime,
          })),
          ...federatedSchedulerContexts.values(),
        ].reduce((count, activeContext) => count
          + pendingCodexProcessEntries(activeContext.root, activeContext.runtime).length, 0);
        const blockingIncidents = deliveryBlockingIncidents(incidentLedger.snapshot().incidents);
        const stateStatus = federationTaskStateReplicator?.diagnostics() ?? {
          convergence: [],
          runtimeDirty: [],
          pendingDeliveryIds: [],
        };
        const contentStatus = federationContentStore.status();
        const convergedProjectIds = projectIds.filter((projectId) => (
          stateStatus.convergence.some((entry) => (
            entry.peerId === 'relay' && entry.projectId === projectId && entry.converged
          ))
        ));
        return {
          ok: true,
          nodeId: localNodeId,
          observedAt: new Date().toISOString(),
          projectIds,
          release: {
            ok: true,
            status: blockingIncidents.length > 0 ? 'degraded' : 'ready',
            observedAt: new Date().toISOString(),
            ...decisionOsReleaseHealthIdentity(runtime.decisionOsSettings),
            activeIncidentCount: blockingIncidents.length,
          },
          federationPhase: federation.status().phase,
          activeExecutionCount: localExecutions.filter((execution) => (
            activePhases.has(execution.lifecycle.phase)
          )).length,
          pendingExecutionCount: localExecutions.filter((execution) => (
            pendingPhases.has(execution.lifecycle.phase)
          )).length,
          pendingProcessQueueDepth,
          pausedScopeCount: blockingIncidents.length,
          fatalIncidentCount: blockingIncidents.filter((incident) => (
            incident.scope === 'server-runtime' && incident.severity === 'fatal'
          )).length,
          stateRuntimeDirtyCount: stateStatus.runtimeDirty.length,
          statePendingDeliveryCount: stateStatus.pendingDeliveryIds.length,
          contentQueueDepth: contentStatus.queueDepth,
          unavailableContentResourceCount: contentStatus.resources.filter((resource) => (
            resource.state !== 'available'
          )).length,
          convergedProjectIds,
        };
      },
      consumeCapability: (capability) => federation.consumeDeliveryCapability(capability),
      request,
      response,
      runCommand: (command, signal) => runLocalDeliveryCommand(command, signal),
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
      const remoteProject = federation.remoteProjects().find((project) => project.ownerNodeId === ownerNodeId && project.localProjectId === localProjectId);
      if (!remoteProject) {
        response.statusCode = 404;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'replica_unknown', projectId: localProjectId, nodeId: ownerNodeId }));
        return;
      }
      const taskStore = federatedTaskStoreForProject(localProjectId, ownerNodeId);
      const projection = taskStore && taskStore.diagnostics().entityCount > 0 ? taskStore.projection() : null;
      const remoteTaskExecutionStateRead = request.method === 'GET'
        ? projectScope.scopedPath.match(/^\/api\/tasks\/([^/]+)\/execution-state$/)
        : null;
      if (remoteTaskExecutionStateRead) {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        const state = federatedTaskStateForProject(localProjectId, ownerNodeId);
        if (!state || !projection) {
          response.statusCode = 202;
          response.end(JSON.stringify({ ok: false, error: 'task_execution_state_synchronizing' }));
          return;
        }
        const requestedCardId = decodeRouteSegment(remoteTaskExecutionStateRead[1]);
        const taskId = resolveTaskLineage({
          ledger: projection.ledger,
          sourceCardId: requestedCardId,
        }).taskId;
        response.end(JSON.stringify(projectTaskExecutionState({
          taskId,
          state,
          queuePosition: (record) => {
            if (record.lifecycle.executorNodeId !== localNodeId) return null;
            const schedulerRuntime = federatedSchedulerContexts.get(record.metadata.executionId)?.runtime;
            return schedulerRuntime
              ? unifiedCodexQueuePosition({
                decisionOsRoot: String(schedulerRuntime.decisionOsRoot ?? ''),
                id: record.metadata.executionId,
                createdAt: record.metadata.requestedAt,
                runtime: schedulerRuntime,
              })
              : null;
          },
        })));
        return;
      }
      const remoteTaskExecutionPresentationRead = request.method === 'GET'
        ? projectScope.scopedPath.match(/^\/api\/task-executions\/([^/]+)$/)
        : null;
      if (remoteTaskExecutionPresentationRead) {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        const executionId = decodeRouteSegment(remoteTaskExecutionPresentationRead[1]);
        const state = federatedTaskStateForProject(localProjectId, ownerNodeId);
        const execution = state?.executions.find(executionId) ?? null;
        if (!state || !execution) {
          response.statusCode = 404;
          response.end(JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }));
          return;
        }
        if (execution.lifecycle.executorNodeId === localNodeId) {
          const executionRuntime = federatedSchedulerContexts.get(executionId)?.runtime;
          const key = executionPresentationKey(localProjectId, executionId, localNodeId);
          const projection = executionPresentations.get(key);
          const result = projection?.hydrated
            ? { ok: true as const, presentation: replicatedTaskExecutionPresentation(execution, projection.events) }
            : executionRuntime
              ? buildTaskExecutionPresentation({ executionId, state, runtime: executionRuntime })
              : { ok: false as const, statusCode: 202, error: 'task_execution_presentation_synchronizing' };
          if ('presentation' in result && !projection?.hydrated) {
            executionPresentations.set(key, { events: result.presentation.events, hydrated: true });
          }
          const httpResult = taskExecutionPresentationHttpResult(executionId, result);
          response.statusCode = httpResult.statusCode;
          response.end(httpResult.body);
          return;
        }
        const projection = executionPresentations.get(
          executionPresentationKey(localProjectId, executionId, execution.lifecycle.executorNodeId),
        );
        if (!projection?.hydrated) {
          const hydrated = locallyHydratedTaskExecutionPresentation(state, execution);
          if (hydrated) {
            executionPresentations.set(
              executionPresentationKey(localProjectId, executionId, execution.lifecycle.executorNodeId),
              { events: hydrated.events, hydrated: true },
            );
            response.end(JSON.stringify(hydrated));
            return;
          }
          const remote = await requestRemoteExecutionPresentation({
            projectId: localProjectId,
            execution,
            request,
            response,
          });
          if ('presentation' in remote) {
            response.end(JSON.stringify(replicatedTaskExecutionPresentation(execution, remote.presentation.events)));
          } else {
            response.statusCode = remote.statusCode;
            response.end(remote.body);
          }
          return;
        }
        response.end(JSON.stringify(replicatedTaskExecutionPresentation(execution, projection.events)));
        return;
      }
      const remotePipelineRunRead = request.method === 'GET'
        ? projectScope.scopedPath.match(/^\/api\/codex\/pipelines\/runs\/([^/]+)$/)
        : null;
      if (remotePipelineRunRead) {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        const pipelineRunId = decodeRouteSegment(remotePipelineRunRead[1]);
        const result = federatedPipelinePresentations.get(
          `${localProjectId}\0${pipelineRunId}\0${ownerNodeId}`,
        );
        if (!result) {
          response.statusCode = 202;
          response.end(JSON.stringify({ ok: false, error: 'pipeline_presentation_synchronizing', runId: pipelineRunId }));
          return;
        }
        response.end(JSON.stringify(result));
        return;
      }
      const remoteCardSkillRunRead = request.method === 'GET'
        ? projectScope.scopedPath.match(/^\/api\/codex\/skills\/runs\/([^/]+)$/)
        : null;
      if (remoteCardSkillRunRead) {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        const runId = decodeRouteSegment(remoteCardSkillRunRead[1]);
        const ledgerId = requestUrl.searchParams.get('ledgerId') ?? '';
        const cardId = requestUrl.searchParams.get('cardId') ?? '';
        const state = federatedTaskStateForProject(localProjectId, ownerNodeId);
        const execution = state?.executions.bySessionId(runId)
          .filter((candidate) => candidate.metadata.ledgerId === ledgerId
            && (candidate.metadata.sourceCardId === cardId || candidate.metadata.ownerCardId === cardId))
          .sort((left, right) => right.metadata.requestedAt.localeCompare(left.metadata.requestedAt)
            || right.metadata.executionId.localeCompare(left.metadata.executionId))[0] ?? null;
        if (!state || !execution) {
          response.statusCode = 404;
          response.end(JSON.stringify({ ok: false, error: 'Execution not found.', runId }));
          return;
        }
        const events = executionPresentations.get(
          executionPresentationKey(localProjectId, execution.metadata.executionId, execution.lifecycle.executorNodeId),
        )?.events ?? locallyHydratedTaskExecutionPresentation(state, execution)?.events ?? [];
        response.end(JSON.stringify(replicatedCardSkillRunStatus({
          runId,
          ledgerId,
          cardId,
          executions: state.executions.all(),
          events,
          queuePosition: null,
        })));
        return;
      }
      const relayConvergence = federationTaskStateReplicator?.diagnostics().convergence.find((entry) => entry.peerId === 'relay' && entry.projectId === localProjectId);
      const taskRootReady = Boolean(projection);
      const relayRootCurrent = Boolean(
        relayConvergence?.converged
        && relayConvergence.root === taskStore?.rootHash(),
      );
      const taskStateStatus = !remoteProject.online
        ? { status: 'offline', updatedAt: relayConvergence?.lastRepairAt ?? '', message: 'Serving the durable local task replica while its owner is offline.', resource: '', root: relayConvergence?.root ?? '' }
        : relayRootCurrent
          ? { status: 'synchronized', updatedAt: relayConvergence?.lastRepairAt ?? '', message: '', resource: '', root: relayConvergence?.root ?? '' }
          : { status: 'synchronizing', updatedAt: relayConvergence?.lastRepairAt ?? '', message: 'Publishing the local task revision and reconciling the relay root.', resource: projectScope.scopedPath, root: relayConvergence?.root ?? '' };
      const ledgerRead = projectScope.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/navigation$/);
      const cardRead = projectScope.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)$/);
      const threadRead = projectScope.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/threads\/([^/]+)$/);
      let replicaBody: unknown = null;
      let resourceReady = true;
      let contentDegraded = false;
      let contentStatus: AnyRecord = { status: 'not-required', resource: '', error: '' };
      if (request.method === 'GET' && projection && taskRootReady) {
        const ledger = projection.ledger;
        if (projectScope.scopedPath === '/decision-os/state') replicaBody = { projectId: localProjectId, projectName: remoteProject.name, projectColor: remoteProject.color, ledgers: remoteProject.ledgers };
        if (ledgerRead) replicaBody = { ...ledger, cards: (Array.isArray(ledger.cards) ? ledger.cards : []).map((card) => {
          const value = card as AnyRecord;
          return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'comment'));
        }) };
        if (cardRead) {
          const cardId = decodeRouteSegment(cardRead[2]);
          const card = (Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : []).find((entry) => String(entry.id ?? '') === cardId);
          if (card) {
            const comment = card.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
            const key = String(comment.contentFile ?? '');
            const heads = taskStore?.contentHeads(key) ?? [];
            for (const head of heads) federationContentStore.applyManifest(head.sourceReplicaId, { version: 1, projectId: localProjectId, generatedAt: new Date().toISOString(), complete: false, resources: [{ type: head.type, key: head.key, hash: head.hash, bytes: head.bytes, changedAt: head.changedAt }] });
            const contentOwner = heads.find((head) => head.sourceReplicaId === ownerNodeId)?.sourceReplicaId ?? heads[0]?.sourceReplicaId ?? ownerNodeId;
            const content = federationContentStore.resource(contentOwner, localProjectId, key);
            // WHAT: Keep structurally synchronized cards readable while exposing a referenced missing head as degraded.
            // WHY: A content-file reference without causal authority is not an intentionally empty document.
            const missingReferencedHead = Boolean(key) && heads.length === 0 && relayRootCurrent;
            contentDegraded = missingReferencedHead;
            resourceReady = !key || Boolean(content.file) || missingReferencedHead;
            contentStatus = {
              status: missingReferencedHead ? 'missing-head' : content.state,
              resource: key,
              error: missingReferencedHead ? 'task_content_head_missing' : content.error,
              conflict: content.conflict,
              candidates: content.candidates,
            };
            if (!resourceReady && heads.length > 0) {
              federationContentStore.prioritize(contentOwner, localProjectId, key);
              if (!pausedBackgroundComponents.has('federation-content-scheduler')) void federationContentScheduler?.drain()
                .catch((error: unknown) => recordBackgroundFailure('federation-content-scheduler', 'drain-card-content-demand', error, { projectId: localProjectId, key }));
            }
            const body = content.file ? await readFileAsync(content.file, 'utf8') : '';
            replicaBody = { ...card, comment: { ...comment, ...(content.file ? { what: body } : {}) } };
          }
        }
        if (threadRead) {
          const threadId = decodeRouteSegment(threadRead[2]);
          const refs = ledger.threadFiles && typeof ledger.threadFiles === 'object' ? ledger.threadFiles as AnyRecord : {};
          const key = String(refs[threadId] ?? '');
          const heads = taskStore?.contentHeads(key) ?? [];
          for (const head of heads) federationContentStore.applyManifest(head.sourceReplicaId, { version: 1, projectId: localProjectId, generatedAt: new Date().toISOString(), complete: false, resources: [{ type: head.type, key: head.key, hash: head.hash, bytes: head.bytes, changedAt: head.changedAt }] });
          const contentOwner = heads.find((head) => head.sourceReplicaId === ownerNodeId)?.sourceReplicaId ?? heads[0]?.sourceReplicaId ?? ownerNodeId;
          const content = federationContentStore.resource(contentOwner, localProjectId, key);
          resourceReady = !key || Boolean(content.file);
          contentStatus = { status: content.state, resource: key, error: content.error, conflict: content.conflict, candidates: content.candidates };
          // WHAT: Queue only the thread file requested by this route.
          // WHY: Catalog and head synchronization must transfer zero body bytes.
          if (!resourceReady) {
            federationContentStore.prioritize(contentOwner, localProjectId, key);
            if (!pausedBackgroundComponents.has('federation-content-scheduler')) void federationContentScheduler?.drain()
              .catch((error: unknown) => recordBackgroundFailure('federation-content-scheduler', 'drain-thread-content-demand', error, { projectId: localProjectId, key }));
          }
          const notes = content.file ? parseThreadMarkdown(await readFileAsync(content.file, 'utf8')) : [];
          replicaBody = {
            ledgerId: decodeRouteSegment(threadRead[1]),
            threadId,
            threadFiles: key ? { [threadId]: key } : {},
            notes: { [threadId]: notes },
          };
        }
      }
      const stateStatus = {
        status: contentDegraded
          ? 'degraded'
          : !taskRootReady || !resourceReady
          ? 'synchronizing'
          : !remoteProject.online
            ? 'offline'
            : !relayRootCurrent
              ? 'synchronizing'
              : 'synchronized',
        resource: String(contentStatus.resource || projectScope.scopedPath),
        task: taskStateStatus,
        content: contentStatus,
      };
      const replicaRead = request.method === 'GET' && (projectScope.scopedPath === '/decision-os/state' || ledgerRead || cardRead || threadRead);
      if (replicaRead && replicaBody && taskRootReady && resourceReady) {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.setHeader('x-decision-os-state-status', stateStatus.status);
        response.end(JSON.stringify({ ...(replicaBody as AnyRecord), state: stateStatus }));
        return;
      }
      if (replicaRead) {
        response.statusCode = 202;
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'state_synchronizing', state: stateStatus }));
        return;
      }
      if (request.method === 'PATCH' && projectScope.scopedPath === '/decision-os/tasks') {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        const state = federatedTaskStateForProject(localProjectId, ownerNodeId);
        if (!state || !projection) {
          response.statusCode = 503;
          response.end(JSON.stringify({ ok: false, error: 'task_replica_not_ready', state: stateStatus }));
          return;
        }
        let mutation: LedgerMutation;
        try {
          mutation = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as LedgerMutation;
        } catch {
          response.statusCode = 400;
          response.end(JSON.stringify({ ok: false, error: 'invalid_task_mutation_json' }));
          return;
        }
        const before = structuredClone(state.projection().ledger);
        const threadId = String(mutation.note?.threadId ?? '');
        if (threadId) {
          const refs = before.threadFiles && typeof before.threadFiles === 'object' && !Array.isArray(before.threadFiles)
            ? before.threadFiles as AnyRecord
            : {};
          const key = String(refs[threadId] ?? '');
          if (!key) {
            response.statusCode = 409;
            response.end(JSON.stringify({ ok: false, error: 'task_thread_reference_missing', threadId }));
            return;
          }
          const replicaRoot = resolve(masterDecisionOsRoot, 'cache', 'federation-task-state');
          const localFile = resolve(replicaRoot, key.replace(/^\/?\.decision-os\//, ''));
          const relativeFile = relative(replicaRoot, localFile);
          if (!relativeFile || relativeFile.startsWith('..') || isAbsolute(relativeFile)) {
            response.statusCode = 400;
            response.end(JSON.stringify({ ok: false, error: 'task_thread_reference_invalid', threadId }));
            return;
          }
          if (!existsSync(localFile)) {
            const content = await readTaskContentOnDemand({
              projectId: localProjectId,
              store: state.store,
              key,
              contentStore: federationContentStore,
              drain: federationContentScheduler?.drain ?? null,
            });
            if (!content.available || content.conflict) {
              response.statusCode = 409;
              response.end(JSON.stringify({
                ok: false,
                error: content.conflict ? 'task_thread_content_conflict' : 'task_thread_content_unavailable',
                threadId,
                candidates: content.candidates,
              }));
              return;
            }
            mkdirSync(dirname(localFile), { recursive: true });
            const temporary = `${localFile}.install-${process.pid}-${Date.now()}`;
            writeFileSync(temporary, content.body);
            renameSync(temporary, localFile);
          }
        }
        const after = structuredClone(before);
        const replicaRoot = resolve(masterDecisionOsRoot, 'cache', 'federation-task-state');
        const replicaLedgerPath = resolve(replicaRoot, 'replica-ledgers', `${localProjectId}.json`);
        const mutationResult = applyLedgerMutation({
          decisionOsRoot: replicaRoot,
          ledgerPath: replicaLedgerPath,
          ledger: after,
          mutation,
        });
        if (mutationResult.error) {
          response.statusCode = mutationResult.error.statusCode;
          response.end(JSON.stringify(mutationResult.error.body));
          return;
        }
        const committed = await state.executeMutation(mutation, before, after, mutationResult.changedContentFiles);
        if (committed.changed) controlRoomProjectionStore?.invalidate(localProjectId, committed.localChanges);
        const revision = federatedTaskRevisionForProject(localProjectId).advance('tasks');
        const taskClock = state.store.clientClock();
        response.setHeader(ledgerRevisionHeader, String(revision));
        response.setHeader('x-decision-os-task-clock', Buffer.from(JSON.stringify(taskClock)).toString('base64url'));
        response.end(JSON.stringify({
          ok: true,
          ledgerId: 'tasks',
          revision,
          taskClock,
          receipt: {
            mutationId: String(mutation.mutationId ?? ''),
            clock: taskClock,
            entities: committed.localChanges,
          },
          locallyCommitted: true,
          publicationPending: federationTaskStateReplicator?.diagnostics().pendingDeliveryIds.length > 0,
          ledger: committed.ledger,
        }));
        return;
      }
      await federation.proxy(request, response, ownerNodeId, localProjectId, projectScope.scopedPath);
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
    if ((request.method === 'GET' || request.method === 'HEAD')) {
      let decodedMarkdownPath = '';
      try {
        const candidate = decodeURIComponent(projectScope?.scopedPath ?? requestPath);
        if (candidate.toLowerCase().endsWith('.md')) {
          decodedMarkdownPath = projectScope && candidate.startsWith('/.decision-os/')
            ? resolve(activeProject!.decisionOsRoot, candidate.slice('/.decision-os/'.length))
            : candidate;
        }
      } catch {
        decodedMarkdownPath = '';
      }
      if (decodedMarkdownPath) {
        try {
          const target = resolveMarkdownEditorTarget({
            targetPath: decodedMarkdownPath,
            projects: projectCatalogStore.projects(),
            serverRoot: masterRoot,
            projectId: projectScope?.projectId,
            readLedger: (project, ledgerId, ledgerFile) => {
              try {
                if (ledgerId === tasksLedgerId) return structuredClone(taskStateForProject(project).projection().ledger);
                const file = resolve(project.decisionOsRoot, ledgerFile.replace(/^\.decision-os\//, ''));
                return JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
              } catch {
                return null;
              }
            },
          });
          response.statusCode = 302;
          response.setHeader('cache-control', 'no-store');
          response.setHeader('location', markdownEditorTargetLocation(target));
          response.end();
        } catch (error) {
          const targetError = error instanceof MarkdownEditorTargetError
            ? error
            : new MarkdownEditorTargetError('markdown_editor_target_not_found', 404);
          response.statusCode = targetError.statusCode;
          response.setHeader('cache-control', 'no-store');
          response.setHeader('content-type', 'application/json');
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ ok: false, error: targetError.code }));
        }
        return;
      }
    }
    if (projectScope
      && activeProject
      && (url === '/api/internal/task-executions/admit' || url === '/api/internal/task-executions/admit-batch')
      && request.method === 'POST') {
      response.setHeader('content-type', 'application/json');
      const requesterNodeId = String(request.headers['x-decision-os-federation-node'] ?? '').trim();
      const peer = federation.nodes().find((node) => node.nodeId === requesterNodeId && node.online);
      if (!requesterNodeId || !peer) {
        response.statusCode = 403;
        response.end(JSON.stringify({ ok: false, error: 'federation_node_authentication_failed' }));
        return;
      }
      let installedPipelineRunId = '';
      try {
        const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
        const batch = url.endsWith('/admit-batch');
        const requests = Array.isArray(body.requests) ? body.requests as TaskExecutionLaunchRequest[] : [];
        if (batch) {
          try {
            const installed = installRemotePipelineRun({
              decisionOsRoot: activeProject.decisionOsRoot,
              runtime: projectContext(activeProject.decisionOsRoot, activeProject.id).runtime,
              run: body.pipelineRun as CodexPipelineRun,
              requests,
            });
            if (installed.installed) installedPipelineRunId = installed.run.id;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'task_execution_pipeline_manifest_invalid';
            const code = message.split(':')[0] || 'task_execution_pipeline_manifest_invalid';
            throw new TaskExecutionAdmissionError(
              code,
              code.endsWith('_conflict') ? 409 : 400,
              { pipelineRunId: String((body.pipelineRun as AnyRecord | undefined)?.id ?? '') },
              message,
            );
          }
        }
        const receipts = batch
          ? await taskExecutionRouterForProject(activeProject).admitLocalBatch(
            requests,
          )
          : [await taskExecutionRouterForProject(activeProject).admitLocal(body as TaskExecutionLaunchRequest)];
        response.statusCode = 202;
        response.end(JSON.stringify(batch
          ? { ok: true, receipts }
          : { ok: true, receipt: receipts[0] }));
      } catch (error) {
        if (installedPipelineRunId) {
          try {
            removeInstalledRemotePipelineRun({
              decisionOsRoot: activeProject.decisionOsRoot,
              runId: installedPipelineRunId,
            });
          } catch (cleanupError) {
            recordStoppedOperation({
              scope: `task-execution-manifest-cleanup:${activeProject.id}:${installedPipelineRunId}`,
              component: 'task-execution-router',
              operation: 'remove-rejected-remote-pipeline-manifest',
              error: cleanupError,
              context: { projectId: activeProject.id, requesterNodeId, pipelineRunId: installedPipelineRunId },
            });
          }
        }
        const expected = error instanceof TaskExecutionAdmissionError;
        const syntax = error instanceof SyntaxError;
        response.statusCode = expected ? error.statusCode : syntax ? 400 : 500;
        const incidentId = !expected && !syntax
          ? recordStoppedOperation({
            scope: `task-execution-admission:${activeProject.id}:${requesterNodeId}`,
            component: 'task-execution-router',
            operation: 'admit-federated-task-execution',
            error,
            context: { projectId: activeProject.id, requesterNodeId },
          })
          : '';
        response.end(JSON.stringify({
          ok: false,
          error: expected ? error.code : syntax ? 'invalid_json' : 'task_execution_admission_failed',
          ...(expected ? { context: error.context } : {}),
          ...(incidentId ? { incidentId } : {}),
        }));
      }
      return;
    }
    const deliveryDispatch = !projectScope && request.method === 'POST'
      ? url.match(/^\/api\/federation\/nodes\/([^/]+)\/delivery$/)
      : null;
    if (deliveryDispatch) {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      const targetNodeId = decodeRouteSegment(deliveryDispatch[1]);
      const requestScope = createDeliveryHttpRequestScope({ request, response });
      try {
        authorizeLocalDeliveryDispatch({
          authorization: Array.isArray(request.headers.authorization)
            ? request.headers.authorization[0]
            : request.headers.authorization,
          settings: runtime.decisionOsSettings,
        });
        const command = parseDeliveryNodeCommand(await readDeliveryRequestJson(request, requestScope.signal));
        const localNodeId = federation.localOwner().ownerNodeId;
        if (targetNodeId === localNodeId) {
          const receipt = await runLocalDeliveryCommand(command, requestScope.signal);
          response.end(JSON.stringify({ ok: true, receipt }));
          return;
        }
        const peer = federation.nodes().find((node) => node.nodeId === targetNodeId && node.online);
        if (!peer) {
          response.statusCode = 503;
          response.end(JSON.stringify({ ok: false, error: 'delivery_node_offline', nodeId: targetNodeId }));
          return;
        }
        const remote = await federation.requestDelivery(targetNodeId, command, { timeoutMs: 30_000, signal: requestScope.signal });
        response.statusCode = remote.status;
        response.end(remote.body);
      } catch (error) {
        response.statusCode = error instanceof DeliveryHttpBoundaryError
          ? error.statusCode
          : requestScope.signal.aborted
            ? String(requestScope.signal.reason ?? '').includes('timeout') ? 504 : 499
            : error instanceof DeliveryNodeCommandError ? error.statusCode
              : error instanceof SyntaxError ? 400 : 422;
        response.end(JSON.stringify({
          ok: false,
          error: error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: unknown }).code)
            : error instanceof SyntaxError ? 'invalid_json' : 'delivery_node_command_invalid',
          message: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        requestScope.dispose();
      }
      return;
    }
    if (!projectScope && url === '/api/federation/nodes' && request.method === 'GET') {
      const localOwner = federation.localOwner();
      const nodes = [
        {
          nodeId: localOwner.ownerNodeId,
          nodeLabel: localOwner.ownerNodeLabel,
          online: true,
          local: true,
          projects: projects.filter((project) => project.available).map((project) => ({
            projectId: project.id,
            name: project.name,
            available: project.available,
            originFingerprint: project.originFingerprint,
          })),
        },
        ...federation.topologyNodes().map((node) => ({
          nodeId: node.nodeId,
          nodeLabel: node.nodeLabel,
          online: node.online,
          local: false,
          projects: node.projects.map((project) => ({
            projectId: project.projectId,
            name: project.projectId,
            available: node.online,
            originFingerprint: project.originFingerprint,
          })),
        })),
      ];
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, observedAt: new Date().toISOString(), nodes }));
      return;
    }
    if (!projectScope && url === '/api/federation/node-message-executions' && request.method === 'POST') {
      response.setHeader('content-type', 'application/json');
      const requesterNodeId = String(request.headers['x-decision-os-federation-node'] ?? '').trim();
      const peer = federation.nodes().find((node) => node.nodeId === requesterNodeId && node.online);
      if (!requesterNodeId || !peer) {
        response.statusCode = 403;
        response.end(JSON.stringify({ ok: false, error: 'Federation node authentication failed.' }));
        return;
      }
      const abort = new AbortController();
      const abortExecution = (): void => abort.abort(new Error('node_message_client_disconnected'));
      const abortOnResponseClose = (): void => { if (!response.writableEnded) abortExecution(); };
      request.once('aborted', abortExecution);
      response.once('close', abortOnResponseClose);
      try {
        const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
        const projectId = String(body.projectId ?? '').trim();
        const project = projects.find((entry) => entry.id === projectId && entry.available);
        if (!project) {
          response.statusCode = 404;
          response.end(JSON.stringify({ ok: false, error: 'Target project is unavailable.', projectId }));
          return;
        }
        const owner = federation.localOwner();
        const result = await executeNodeMessage({
          project,
          runtime: projectContext(project.decisionOsRoot, project.id).runtime,
          requesterNodeId,
          executorNodeId: owner.ownerNodeId,
          executorNodeLabel: owner.ownerNodeLabel,
          message: String(body.message ?? ''),
          codexModel: body.codexModel,
          codexEffort: body.codexEffort,
          signal: abort.signal,
        });
        response.end(JSON.stringify(result));
      } catch (error) {
        response.statusCode = abort.signal.aborted ? 499 : error instanceof RangeError ? 400 : 502;
        const incidentId = !abort.signal.aborted && !(error instanceof RangeError)
          ? recordStoppedOperation({
            scope: `node-message-execution:${requesterNodeId}`,
            component: 'federation-node-message',
            operation: 'execute-node-message',
            error,
            context: { requesterNodeId },
          })
          : '';
        response.end(JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'Node message execution failed.',
          ...(incidentId ? { incidentId } : {}),
        }));
      } finally {
        request.off('aborted', abortExecution);
        response.off('close', abortOnResponseClose);
      }
      return;
    }
    const nodeMessageDispatch = !projectScope && request.method === 'POST'
      ? url.match(/^\/api\/federation\/nodes\/([^/]+)\/messages$/)
      : null;
    if (nodeMessageDispatch) {
      response.setHeader('content-type', 'application/json');
      const targetNodeId = decodeRouteSegment(nodeMessageDispatch[1]);
      const abort = new AbortController();
      const abortExecution = (): void => abort.abort(new Error('node_message_client_disconnected'));
      const abortOnResponseClose = (): void => { if (!response.writableEnded) abortExecution(); };
      request.once('aborted', abortExecution);
      response.once('close', abortOnResponseClose);
      try {
        const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
        const projectId = String(body.projectId ?? '').trim();
        const owner = federation.localOwner();
        if (targetNodeId === owner.ownerNodeId) {
          const project = projects.find((entry) => entry.id === projectId && entry.available);
          if (!project) {
            response.statusCode = 404;
            response.end(JSON.stringify({ ok: false, error: 'Target project is unavailable.', projectId, nodeId: targetNodeId }));
            return;
          }
          const result = await executeNodeMessage({
            project,
            runtime: projectContext(project.decisionOsRoot, project.id).runtime,
            requesterNodeId: owner.ownerNodeId,
            executorNodeId: owner.ownerNodeId,
            executorNodeLabel: owner.ownerNodeLabel,
            message: String(body.message ?? ''),
            codexModel: body.codexModel,
            codexEffort: body.codexEffort,
            signal: abort.signal,
          });
          response.end(JSON.stringify(result));
          return;
        }
        const remoteProject = federation.remoteProjects().find((project) => project.ownerNodeId === targetNodeId
          && project.localProjectId === projectId && project.online);
        if (!remoteProject) {
          response.statusCode = 404;
          response.end(JSON.stringify({ ok: false, error: 'Target federation node project is unavailable.', projectId, nodeId: targetNodeId }));
          return;
        }
        const remote = await federation.request(targetNodeId, '/api/federation/node-message-executions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: Buffer.from(JSON.stringify({ projectId, message: body.message, codexModel: body.codexModel, codexEffort: body.codexEffort })),
          timeoutMs: federationNodeMessageTimeoutMs,
          signal: abort.signal,
        });
        response.statusCode = remote.status;
        response.end(remote.body);
      } catch (error) {
        response.statusCode = abort.signal.aborted ? 499 : error instanceof RangeError || error instanceof SyntaxError ? 400 : 502;
        const incidentId = !abort.signal.aborted && !(error instanceof RangeError) && !(error instanceof SyntaxError)
          ? recordStoppedOperation({
            scope: `node-message-dispatch:${targetNodeId}`,
            component: 'federation-node-message',
            operation: 'dispatch-node-message',
            error,
            context: { targetNodeId },
          })
          : '';
        response.end(JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'Node message dispatch failed.',
          ...(incidentId ? { incidentId } : {}),
        }));
      } finally {
        request.off('aborted', abortExecution);
        response.off('close', abortOnResponseClose);
      }
      return;
    }
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
      listProjectSyncRuns: () => projectSyncStore.list(),
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
          const key = executionPresentationKey(
            execution.metadata.projectId,
            executionId,
            executorNodeId,
          );
          const projection = executionPresentations.get(key);
          if (!projection?.hydrated) {
            const hydrated = locallyHydratedTaskExecutionPresentation(state, execution);
            if (hydrated) {
              executionPresentations.set(key, { events: hydrated.events, hydrated: true });
              return { statusCode: 200, body: JSON.stringify(hydrated) };
            }
            const remote = await requestRemoteExecutionPresentation({
              projectId: execution.metadata.projectId,
              execution,
              request,
              response,
            });
            return 'presentation' in remote
              ? {
                statusCode: 200,
                body: JSON.stringify(replicatedTaskExecutionPresentation(
                  execution,
                  remote.presentation.events,
                )),
              }
              : { statusCode: remote.statusCode, body: remote.body };
          }
          return {
            statusCode: 200,
            body: JSON.stringify(replicatedTaskExecutionPresentation(
              execution,
              projection.events,
            )),
          };
        }
        const presentationRuntime = federatedSchedulerContexts.get(executionId)?.runtime
          ?? requestRuntime;
        const key = executionPresentationKey(
          execution.metadata.projectId,
          executionId,
          localExecutorNodeId,
        );
        const projection = executionPresentations.get(key);
        const result = projection?.hydrated
          ? {
            ok: true as const,
            presentation: replicatedTaskExecutionPresentation(execution, projection.events),
          }
          : buildTaskExecutionPresentation({
            executionId,
            state,
            runtime: presentationRuntime,
          });
        if ('presentation' in result && !projection?.hydrated) {
          executionPresentations.set(key, {
            events: result.presentation.events,
            hydrated: true,
          });
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
      invalidateSkillIndex: invalidateFederatedSkillExportIndex,
      projectScoped: Boolean(projectScope),
      readSkillIndex: readFederatedSkillExportIndex,
      request,
      response,
      status: () => runtime.federatedLibrarySyncStatus as AnyRecord | undefined,
      synchronize: async () => {
        pausedBackgroundComponents.delete('federated-library-sync');
        await synchronizeFederatedLibraries(true);
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
        store: projectSyncStore,
      }),
      federation,
      projects,
      request,
      response,
      store: projectSyncStore,
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
      applyOwnedDetail: applyOwnedSkillDetail,
      applyOwnedMetadata: (skills) => {
        const metadata = ownedSkillMetadata();
        return skills.map((skill) => applyCodexSkillMetadataOwner(skill, metadata));
      },
      masterDecisionOsRoot,
      publishAuthoredSkill: publishAuthoredFederatedSkill,
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
        const events = executionPresentations.get(executionPresentationKey(
          execution.metadata.projectId,
          execution.metadata.executionId,
          execution.lifecycle.executorNodeId,
        ))?.events ?? (state
          ? locallyHydratedTaskExecutionPresentation(state, execution)?.events
          : undefined) ?? [];
        return replicatedCardSkillRunStatus({
          runId,
          ledgerId,
          cardId,
          executions: state?.executions.all() ?? [],
          events,
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
      if (federationSyncRetryTimer) clearTimeout(federationSyncRetryTimer);
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
