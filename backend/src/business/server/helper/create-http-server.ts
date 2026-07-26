/**
 * WHAT: Creates the Decision OS HTTP server, workspace routes, and scoped content event stream.
 * WHY: Ledger IO, SSE publication, and Codex process callbacks share one server lifecycle for the active workspace.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import sharp from 'sharp';
import { telemetry } from '@backend/telemetry/harness.js';
import { transcribeVoiceController } from '@backend/business/transcription/controller/transcribe-voice-controller.js';
import { readVoiceTranscriptionStatusController, startVoiceRetryOrchestrationController, startVoiceUploadOrchestrationController } from '@backend/business/transcription/controller/start-voice-upload-orchestration-controller.js';
import { resolveDecisionOsRoot } from './resolve-decision-os-root.js';
import { readDecisionOsSettings } from './read-decision-os-settings.js';
import { normalizedConcurrentCodexProcesses, saveCodexProcessSettings } from './save-codex-process-settings.js';
import { saveFederationSettings } from './save-federation-settings.js';
import { readRequestBuffer } from './read-request-buffer.js';
import { parseMultipartFormData } from './parse-multipart-form-data.js';
import { contentTypeFor } from './content-type-for.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, resolveThreadContentFile, stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { resolveCardContentChange, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';
import { watchProjectFiles } from '../../refresh/helper/watch-project-files.js';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { createLinkedLedger } from '../../ledger/helper/create-linked-ledger.js';
import { deleteLinkedLedger } from '../../ledger/helper/delete-linked-ledger.js';
import { createLedgerRevisionTracker } from './create-ledger-revision-tracker.js';
import { ensureLedgersCanvasDocument } from '../../ledger/helper/ensure-ledgers-canvas-document.js';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { renameLinkedLedger } from '../../ledger/helper/rename-linked-ledger.js';
import { startCardSkillProcessController } from '../../codex/controller/start-card-skill-process-controller.js';
import { startThreadCodexProcessController } from '../../codex/controller/start-thread-codex-process-controller.js';
import { readCardSkillRunController } from '../../codex/controller/read-card-skill-run-controller.js';
import { readCompactPipelineRunStatusController, readCompactSkillRunStatusController } from '../../codex/controller/read-compact-run-status-controller.js';
import { cancelCardSkillRunController } from '../../codex/controller/cancel-card-skill-run-controller.js';
import { deleteThreadCodexSessionController } from '../../codex/controller/delete-thread-codex-session-controller.js';
import { continueCardSkillRunController } from '../../codex/controller/continue-card-skill-run-controller.js';
import { listCodexPipelinesController } from '../../codex/controller/list-codex-pipelines-controller.js';
import { saveCodexPipelineController } from '../../codex/controller/save-codex-pipeline-controller.js';
import { readCodexSkillLibraryController } from '../../codex/controller/read-codex-skill-library-controller.js';
import { saveCodexSkillLibraryController } from '../../codex/controller/save-codex-skill-library-controller.js';
import { codexSkillTags, readCodexSkillCatalog } from '../../codex/helper/codex-skill-library.js';
import { startCodexPipelineRunController } from '../../codex/controller/start-codex-pipeline-run-controller.js';
import { readCodexPipelineRunController } from '../../codex/controller/read-codex-pipeline-run-controller.js';
import { cancelCodexPipelineRunController } from '../../codex/controller/cancel-codex-pipeline-run-controller.js';
import { restartCodexPipelineRunController } from '../../codex/controller/restart-codex-pipeline-run-controller.js';
import { recoverTaskExecutions } from '../../codex/helper/recover-task-executions.js';
import {
  TaskExecutionAdmissionError,
  createTaskExecutionRouter,
  isTaskExecutionReceipt,
  type TaskExecutionLaunchRequest,
  type TaskExecutionRouter,
} from '../../codex/helper/task-execution-router.js';
import { nextPendingCodexProcessCreatedAt, pendingCodexProcessEntries, runningCodexProcessCount, scheduleCodexProcesses, unifiedCodexQueuePosition } from '../../codex/helper/codex-process-scheduler.js';
import { createCodexCapacitySlots, type CodexSlotAcquireOptions } from '../../codex/helper/codex-capacity-slots.js';
import { scheduleCodexRuntimeTimer, stopCodexRuntimeTimers } from '../../codex/helper/codex-runtime-run-store.js';
import { installFederatedPipelineRun, installRemotePipelineRun, removeInstalledRemotePipelineRun } from '../../codex/helper/install-remote-pipeline-run.js';
import { taskExecutionState } from '../../codex/helper/task-execution-runtime.js';
import { cancelTaskExecutionLocally } from '../../codex/helper/cancel-task-execution.js';
import { projectTaskExecutionState } from '../../codex/helper/project-task-execution-state.js';
import { buildTaskExecutionPresentation } from '../../codex/helper/task-execution-presentation.js';
import { taskExecutionPresentationHttpResult } from '../../codex/helper/task-execution-presentation-http-result.js';
import { executeFederatedPipelineSkill } from '../../codex/helper/codex-pipeline-runner.js';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { TaskExecutionMetadata } from '../../task-state/helper/task-current-state-types.js';
import { resolveCatalogProject, tasksLedgerForProject, type DecisionOsProject } from './project-catalog.js';
import { createProjectCatalogStore } from './project-catalog-store.js';
import { listProjectDirectories } from './project-directory-browser.js';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint, parseProjectUrlScope } from './project-url-scope.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { controlRoomProjectionFromTaskLedger, createControlRoomProjectionStore, withProjectSyncRuns } from './control-room-projection-store.js';
import { ledgerCanvasProjection, ledgerCardProjection, ledgerNavigationProjection, ledgerSearchProjection, ledgerThreadProjection } from './ledger-read-models.js';
import { ensureProjectsCanvasDocument } from './ensure-projects-canvas-document.js';
import { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { executeNodeMessage } from '../../federation/helper/execute-node-message.js';
import { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import { resolveVerifiedManifestResourceFile, type FederationContentManifest } from '../../federation/helper/federation-content-manifest.js';
import { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import { readTaskContentOnDemand } from '../../federation/helper/read-task-content-on-demand.js';
import { materializeTaskMutationInputs, materializeTaskResources, TaskContentMaterializationError } from '../../federation/helper/materialize-task-mutation-inputs.js';
import { createProjectTaskState, type ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { createTaskExecutionRepository } from '../../task-state/helper/task-execution-repository.js';
import { captureTaskExecutionArtifact } from '../../task-state/helper/capture-task-execution-artifact.js';
import type { TaskProjectionCommand } from '../../task-state/helper/task-mutation-command.js';
import { createRuntimeIncidentLedger, RuntimeScopePausedError, type RuntimeIncident } from './runtime-incident-ledger.js';
import { createRuntimeIncidentReviewScheduler } from './create-runtime-incident-review-scheduler.js';
import { runtimeIncidentReviewProjectId } from './synchronize-runtime-incident-review-task.js';
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
import { federatedControlRoomProjection } from './federated-control-room-projection.js';
import { federatedProjectCatalog } from './federated-project-catalog.js';
import { ensureServerPipelines, migrateLegacyProjectPipelines } from '../../codex/helper/server-pipeline-catalog.js';
import { applyCodexSkillMetadataOwner, migrateCodexSkillMetadataOwner } from '../../codex/helper/codex-skill-metadata-owner.js';
import { readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import { createProjectSyncStore } from '../../project-sync/helper/project-sync-store.js';
import { isNetworkGitOrigin, readRepositoryOriginIdentity, readRepositorySyncStatus } from '../../project-sync/helper/repository-sync-status.js';
import { createProjectSyncController } from '../../project-sync/controller/start-project-sync.js';
import { executeProjectSyncPipelineSkill } from '../../project-sync/controller/execute-project-sync-pipeline-skill.js';
import { verifyProjectSyncPhase } from '../../project-sync/helper/verify-project-sync-phase.js';
import type { ProjectSyncRole } from '../../project-sync/helper/project-sync-types.js';
import { projectSyncGitSshCommand } from '../../project-sync/helper/project-sync-git-ssh-command.js';
import { applyGitReviewPatch, readGitReview } from '../../git-review/helper/git-review-patch.js';
import { transcribeGitReviewVoiceController } from '../../git-review/controller/transcribe-git-review-voice-controller.js';

type AnyRecord = Record<string, unknown>;
type MutationError = { statusCode: number; body: AnyRecord };

const federationNodeMessageTimeoutMs = 30 * 60_000;
const federatedLibraryRequestTimeoutMs = 60_000;
const federatedLibraryRetryDelaysMs = [1_000, 3_000] as const;
const federatedLibraryRecoveryDelayMs = 30_000;

function isExecutionScopedCodexFailure(operation: string): boolean {
  return operation === 'codex-execution-timeout'
    || operation === 'adopted-codex-execution-timeout'
    || operation === 'adopted-pipeline-execution-timeout'
    || operation === 'task-execution-dispatch-failed';
}

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

const decisionOsAssetPrefix = '/.decision-os/';
const ledgerRevisionHeader = 'x-decision-os-ledger-revision';
const allowedDecisionOsImageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
const allowedLedgerStaticAssetExtensions = ['.html', '.css', '.js', '.mjs', ...allowedDecisionOsImageExtensions];

function safeAssetSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return '';
  }
}

function ledgerSlug(value: unknown): string {
  return safeAssetSegment(String(value || 'New Ledger').toLowerCase()).slice(0, 80) || 'new-ledger';
}

function projectNameForDecisionOsRoot(decisionOsRoot: string): string {
  return basename(dirname(decisionOsRoot)) || 'Project';
}

function imageExtensionForMimeType(mimeType: unknown): string {
  const normalized = String(mimeType ?? '').toLowerCase().split(';')[0].trim();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
  if (normalized === 'image/webp') return '.webp';
  if (normalized === 'image/gif') return '.gif';
  if (normalized === 'image/svg+xml') return '.svg';
  return '.png';
}

function uploadOriginalFileName(value: unknown): string {
  let decoded = String(value || 'attachment');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = String(value || 'attachment');
  }
  const leaf = basename(decoded).replace(/[^a-zA-Z0-9._ -]+/g, '-').replace(/^-+|-+$/g, '') || 'attachment';
  return leaf.slice(0, 120);
}

function markdownLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

function markdownForThreadFile(input: { fileRef: string; originalName: string; contentType: string }): string {
  const label = markdownLabel(input.originalName || 'Attachment');
  return input.contentType.startsWith('image/')
    ? `![${label}](${input.fileRef})`
    : `[${label}](${input.fileRef})`;
}

function logCodexContinueDebug(phase: string, detail: AnyRecord): void {
  console.log(JSON.stringify({ codexContinueDebug: true, source: 'backend', phase, at: new Date().toISOString(), ...detail }));
}

function threadFileContentDisposition(filePath: string): string {
  const filename = basename(filePath).replace(/"/g, '');
  const type = contentTypeFor(filePath);
  const previewable = type.startsWith('image/')
    || type.startsWith('text/')
    || type === 'application/pdf'
    || type.startsWith('audio/')
    || type.startsWith('video/');
  return `${previewable ? 'inline' : 'attachment'}; filename="${filename}"`;
}

function isAllowedDecisionOsAsset(filePath: string, relativeAssetPath = ''): boolean {
  const normalized = filePath.toLowerCase();
  if (allowedDecisionOsImageExtensions.some((extension) => normalized.endsWith(extension))) return true;
  const normalizedRelative = relativeAssetPath.split('\\').join('/');
  if (/^thread-files\/[^/]+\/.+/.test(normalizedRelative)) return true;
  return /^cards\/[^/]+\/assets\/.+/.test(normalizedRelative)
    && allowedLedgerStaticAssetExtensions.some((extension) => normalized.endsWith(extension));
}

function tryServeDecisionOsAsset(input: { url: string; decisionOsRoot: string; response: ServerResponse }): boolean {
  let decodedUrl = '';
  try {
    decodedUrl = decodeURIComponent(input.url);
  } catch {
    decodedUrl = input.url;
  }
  if (!decodedUrl.startsWith(decisionOsAssetPrefix)) return false;
  const assetPath = resolve(input.decisionOsRoot, decodedUrl.slice(decisionOsAssetPrefix.length));
  const relativeAssetPath = relative(input.decisionOsRoot, assetPath);
  const isInsideDecisionOs = relativeAssetPath && !relativeAssetPath.startsWith('..') && !isAbsolute(relativeAssetPath);
  if (!isInsideDecisionOs || !isAllowedDecisionOsAsset(assetPath, relativeAssetPath) || !existsSync(assetPath)) {
    input.response.statusCode = 404;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, missing: decodedUrl }));
    return true;
  }
  input.response.setHeader('content-type', contentTypeFor(assetPath));
  if (/^thread-files\/[^/]+\/.+/.test(relativeAssetPath.split('\\').join('/'))) {
    input.response.setHeader('content-disposition', threadFileContentDisposition(assetPath));
  }
  input.response.setHeader('cache-control', 'no-store');
  input.response.end(readFileSync(assetPath));
  return true;
}

export function createHttpServer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
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
  const projectTaskStates = new Map<string, ProjectTaskState>();
  const taskExecutionRouters = new Map<string, TaskExecutionRouter>();
  const federatedTaskStores = new Map<string, TaskCurrentStateStore>();
  const federatedProjectTaskStates = new Map<string, ProjectTaskState>();
  const federatedTaskRevisions = new Map<string, ReturnType<typeof createLedgerRevisionTracker>>();
  type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;
  const federatedExecutionStates = new Map<string, ExecutionState>();
  const federatedExecutionObservations = new Map<string, TaskExecutionObservation>();
  const pausedTaskProjects = new Map<string, RuntimeIncident>();
  const pausedFederatedTaskProjects = new Map<string, RuntimeIncident>();
  const pausedBackgroundComponents = new Set<string>();
  const pausedProjectWatchers = new Set<string>();
  const pausedProjectRuntimes = new Set<string>();
  const taskProjectsPendingFrameIncidentRevalidation = new Map<string, RuntimeIncident>();
  let serverClosing = false;
  const serverCloseAbort = new AbortController();
  let globalRuntimeIncident: RuntimeIncident | null = null;
  let projectSyncController: ReturnType<typeof createProjectSyncController> | null = null;
  let resumeProjectSyncRuntime: (() => void) | null = null;

  const disposeProjectContext = (context: ProjectContext): void => {
    stopCodexRuntimeTimers(context.runtime);
    context.watcher.close();
    context.clients.clear();
  };

  for (const incident of incidentLedger.active()) {
    // WHAT: Reclassify diagnostics written before bootstrap gates became non-pausing.
    // WHY: A restart after upgrading must restore ready health once state convergence is complete.
    if (isTaskStateBootstrapGate(incident.code)
      && (incident.scope.startsWith('http-request:')
        || incident.scope.startsWith('project-task-write:')
        || incident.scope.startsWith('background:codex-startup-'))) {
      incidentLedger.resolveScope(incident.scope, 'Transient task-state bootstrap gates do not pause runtime scopes.');
      continue;
    }
    // WHAT: Retain pre-upgrade transient incidents as diagnostics without restoring their obsolete permanent pauses.
    // WHY: Successful relay reconciliation and library synchronization own resolution after startup.
    if (isTaskStateBootstrapGate(incident.code) && incident.scope.startsWith('background:codex-runtime:')) continue;
    if (incident.scope.startsWith('background:codex-runtime:') && isExecutionScopedCodexFailure(incident.operation)) continue;
    if (incident.scope === 'background:federated-library-sync'
      && (incident.code === 'federation_request_timeout' || /HTTP 504|request.+timeout/i.test(incident.message))) continue;
    if (incident.scope.startsWith('project-task-state:')) {
      const projectId = incident.scope.slice('project-task-state:'.length);
      if (incident.operation === 'handle-federated-state-frame') {
        // WHAT: Reopen the durable store before restoring a pause created by the retired broad frame catch.
        // WHY: A contained remote-frame failure must not keep valid local task state unavailable after restart.
        taskProjectsPendingFrameIncidentRevalidation.set(projectId, incident);
      } else {
        pausedTaskProjects.set(projectId, incident);
      }
    }
    if (incident.scope.startsWith('federated-task-state:')) pausedFederatedTaskProjects.set(incident.scope.slice('federated-task-state:'.length), incident);
    if (incident.scope.startsWith('background:')) pausedBackgroundComponents.add(incident.scope.slice('background:'.length));
    if (incident.scope.startsWith('project-watcher:')) pausedProjectWatchers.add(incident.scope.slice('project-watcher:'.length));
    if (incident.scope.startsWith('project-runtime:')) pausedProjectRuntimes.add(incident.scope.slice('project-runtime:'.length));
    if (incident.scope === 'server-runtime') globalRuntimeIncident = incident;
  }

  const recordIncident = (input: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    code?: string;
    context?: Record<string, unknown>;
    severity?: RuntimeIncident['severity'];
  }): RuntimeIncident => incidentLedger.record(input);

  const recordStoppedOperation = (input: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: Record<string, unknown>;
  }): string => {
    const incident = recordIncident({
      severity: 'warning',
      ...input,
    });
    incidentLedger.resolveScope(incident.scope, 'The failed operation stopped without changing project state.');
    return incident.id;
  };

  const recordBackgroundFailure = (component: string, operation: string, error: unknown, context: Record<string, unknown> = {}): RuntimeIncident => {
    pausedBackgroundComponents.add(component);
    return recordIncident({ scope: `background:${component}`, component, operation, error, context });
  };

  const assertCodexRuntimeAvailable = (activeRuntime: AnyRecord): void => {
    if (activeRuntime.codexRuntimePaused !== true) return;
    const component = `codex-runtime:${String(activeRuntime.projectId ?? '')}`;
    const incident = incidentLedger.active(`background:${component}`)[0];
    if (incident) throw new RuntimeScopePausedError(incident.scope, incident.id);
    throw new Error(`Codex runtime ${String(activeRuntime.projectId ?? '')} is paused without an active incident.`);
  };

  const pauseGlobalRuntime = (error: unknown, operation: string): void => {
    globalRuntimeIncident ??= recordIncident({
      severity: 'fatal',
      scope: 'server-runtime',
      component: 'node-process',
      operation,
      error,
    });
    telemetry('runtime-scope-paused', { scope: 'server-runtime', incidentId: globalRuntimeIncident.id, operation });
  };
  const onUncaughtException = (error: Error): void => pauseGlobalRuntime(error, 'uncaught-exception');
  const onUnhandledRejection = (reason: unknown): void => pauseGlobalRuntime(reason, 'unhandled-rejection');
  process.on('uncaughtException', onUncaughtException);
  process.on('unhandledRejection', onUnhandledRejection);

  const pauseTaskProject = (project: DecisionOsProject, error: unknown, operation: string): RuntimeScopePausedError => {
    const scope = `project-task-state:${project.id}`;
    const existing = pausedTaskProjects.get(project.id);
    const incident = existing ?? recordIncident({
      scope,
      component: 'task-current-state',
      operation,
      error,
      context: { projectId: project.id, projectName: project.name, decisionOsRoot: project.decisionOsRoot },
    });
    pausedTaskProjects.set(project.id, incident);
    return new RuntimeScopePausedError(scope, incident.id);
  };

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
  };

  const taskStateForProject = (project: DecisionOsProject): ProjectTaskState => {
    const paused = pausedTaskProjects.get(project.id);
    if (paused) throw new RuntimeScopePausedError(paused.scope, paused.id);
    if (migrationAdmissionBlocked) {
      throw pauseTaskProject(project, new Error(`task_migration_transaction_incomplete:${String(migrationAdmission?.phase ?? 'unknown')}`), 'admit-migrated-task-state');
    }
    const current = projectTaskStates.get(project.id);
    if (current) return current;
    try {
      const ledger = tasksLedgerForProject(project);
      const tasksLedgerFile = resolve(project.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, ''));
      const stateRoot = resolve(project.decisionOsRoot, 'task-state', project.id);
      let initialize = !existsSync(stateRoot) && !existsSync(tasksLedgerFile);
      if (!existsSync(stateRoot) && existsSync(tasksLedgerFile)) {
        const document = JSON.parse(readFileSync(tasksLedgerFile, 'utf8')) as AnyRecord;
        initialize = ['cards', 'annotations', 'relationships'].every((key) => !Array.isArray(document[key]) || document[key].length === 0);
      }
      const value = createProjectTaskState({
        projectId: project.id,
        writerId: federation?.localOwner().ownerNodeId ?? String((runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId ?? 'local'),
        decisionOsRoot: project.decisionOsRoot,
        tasksLedgerFile,
        publish: (delta) => federationTaskStateReplicator?.publishDelta(delta),
        onExecutionChange: ({ executionId, record }) => publishExecutionChange({
          projectId: project.id,
          nodeId: federation?.localOwner().ownerNodeId ?? 'local',
          executionId,
          record,
        }),
        onPersistenceError: (error) => { pauseTaskProject(project, error, 'materialize-local-task-state'); },
        initialize,
      });
      projectTaskStates.set(project.id, value);
      if (taskProjectsPendingFrameIncidentRevalidation.delete(project.id)) {
        incidentLedger.resolveScope(
          `project-task-state:${project.id}`,
          'Durable task state revalidated after the retired federation-frame pause.',
        );
      }
      return value;
    } catch (error) {
      if (error instanceof RuntimeScopePausedError) throw error;
      const retained = taskProjectsPendingFrameIncidentRevalidation.get(project.id);
      if (retained) {
        taskProjectsPendingFrameIncidentRevalidation.delete(project.id);
        pausedTaskProjects.set(project.id, retained);
      }
      throw pauseTaskProject(project, error, 'open-local-task-state');
    }
  };

  const taskExecutionRouterForProject = (project: DecisionOsProject): TaskExecutionRouter => {
    const existing = taskExecutionRouters.get(project.id);
    if (existing) return existing;
    const router = createTaskExecutionRouter({
      projectId: project.id,
      state: () => taskStateForProject(project),
      localNodeId: () => federation?.localOwner().ownerNodeId
        ?? String((runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId ?? 'local'),
      peer: (nodeId) => federation?.nodes().find((node) => node.nodeId === nodeId) ?? null,
      localCapacity: globalCodexProcessCapacity,
      dispatchRemote: async (nodeId, launch) => {
        if (!federation) {
          throw new TaskExecutionAdmissionError('assigned_node_unreachable', 503, { assignedNodeId: nodeId });
        }
        const remote = await federation.request(
          nodeId,
          `/p/${encodeURIComponent(project.id)}/api/internal/task-executions/admit`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: Buffer.from(JSON.stringify(launch)),
          },
        );
        let body: AnyRecord = {};
        try {
          body = JSON.parse(remote.body.toString('utf8') || '{}') as AnyRecord;
        } catch {
          throw new TaskExecutionAdmissionError(
            'task_execution_remote_response_invalid',
            502,
            { assignedNodeId: nodeId, remoteStatus: remote.status },
          );
        }
        if (remote.status < 200 || remote.status >= 300 || body.ok === false) {
          const remoteCode = String(body.error ?? 'task_execution_remote_admission_failed');
          const code = remoteCode === 'owner_offline' || remoteCode === 'federation_request_timeout'
            ? 'assigned_node_unreachable'
            : remoteCode;
          throw new TaskExecutionAdmissionError(code, code !== remoteCode ? 503 : remote.status || 502, {
            assignedNodeId: nodeId,
            ...(code !== remoteCode ? { remoteError: remoteCode } : {}),
            ...(body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context as AnyRecord : {}),
          });
        }
        if (!isTaskExecutionReceipt(body.receipt)) {
          throw new TaskExecutionAdmissionError(
            'task_execution_remote_response_invalid',
            502,
            { assignedNodeId: nodeId, remoteStatus: remote.status },
          );
        }
        return body.receipt;
      },
      dispatchRemoteBatch: async (nodeId, launches, context) => {
        if (!federation) {
          throw new TaskExecutionAdmissionError('assigned_node_unreachable', 503, { assignedNodeId: nodeId });
        }
        const remote = await federation.request(
          nodeId,
          `/p/${encodeURIComponent(project.id)}/api/internal/task-executions/admit-batch`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: Buffer.from(JSON.stringify({ requests: launches, pipelineRun: context.pipelineRun })),
          },
        );
        let body: AnyRecord = {};
        try {
          body = JSON.parse(remote.body.toString('utf8') || '{}') as AnyRecord;
        } catch {
          throw new TaskExecutionAdmissionError(
            'task_execution_remote_response_invalid',
            502,
            { assignedNodeId: nodeId, remoteStatus: remote.status },
          );
        }
        if (remote.status < 200 || remote.status >= 300 || body.ok === false) {
          const remoteCode = String(body.error ?? 'task_execution_remote_admission_failed');
          const code = remoteCode === 'owner_offline' || remoteCode === 'federation_request_timeout'
            ? 'assigned_node_unreachable'
            : remoteCode;
          throw new TaskExecutionAdmissionError(code, code !== remoteCode ? 503 : remote.status || 502, {
            assignedNodeId: nodeId,
            ...(code !== remoteCode ? { remoteError: remoteCode } : {}),
            ...(body.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context as AnyRecord : {}),
          });
        }
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];
        if (receipts.length !== launches.length || !receipts.every(isTaskExecutionReceipt)) {
          throw new TaskExecutionAdmissionError(
            'task_execution_remote_response_invalid',
            502,
            { assignedNodeId: nodeId, remoteStatus: remote.status },
          );
        }
        return receipts;
      },
      onCommitted: (record) => {
        controlRoomProjectionStore?.invalidate(project.id, [{ entityType: 'execution', entityId: record.metadata.executionId }]);
        if (!pausedBackgroundComponents.has('codex-process-scheduler')) {
          void scheduleGlobalCodexProcesses().catch((error: unknown) => {
            recordBackgroundFailure('codex-process-scheduler', 'schedule-after-task-execution-admission', error, {
              projectId: project.id,
              executionId: record.metadata.executionId,
            });
          });
        }
      },
      onFailure: (error, context) => {
        recordStoppedOperation({
          scope: `codex-execution-admission:${project.id}:${String(context.executionId ?? 'unknown')}`,
          component: 'task-execution-router',
          operation: String(context.operation ?? 'task-execution-admission'),
          error,
          context: { projectId: project.id, ...context },
        });
      },
    });
    taskExecutionRouters.set(project.id, router);
    return router;
  };

  const recordProjectBackgroundFailure = (project: DecisionOsProject, error: unknown, operation: string): void => {
    if (error instanceof RuntimeScopePausedError) return;
    // WHAT: Retain an expected convergence rejection as a resolved stopped operation.
    // WHY: The watcher changed no task state, so this condition must not degrade server health.
    if (isTaskStateBootstrapGate(error)) {
      recordStoppedOperation({
        scope: `project-task-write:${project.id}`,
        component: 'task-current-state',
        operation,
        error,
        context: { projectId: project.id, projectName: project.name },
      });
      return;
    }
    pauseTaskProject(project, error, operation);
  };

  const tryTaskStateForProject = (project: DecisionOsProject): ProjectTaskState | null => {
    try { return taskStateForProject(project); }
    catch (error) {
      if (!(error instanceof RuntimeScopePausedError)) pauseTaskProject(project, error, 'open-local-task-state');
      return null;
    }
  };

  const fallbackTaskProjection = (project: DecisionOsProject): AnyRecord => {
    const ledger = tasksLedgerForProject(project);
    const tasksLedgerFile = resolve(project.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, ''));
    try {
      return { ledger: JSON.parse(readFileSync(tasksLedgerFile, 'utf8')) as AnyRecord, conflicts: [], degraded: true };
    } catch {
      return { ledger: { cards: [], annotations: [], relationships: [] }, conflicts: [], degraded: true };
    }
  };

  const taskProjectionForProject = (project: DecisionOsProject): AnyRecord => tryTaskStateForProject(project)?.projection() ?? fallbackTaskProjection(project);

  const federatedTaskStoreForProject = (projectId: string, ownerNodeId: string): TaskCurrentStateStore | null => {
    if (!projectId) return null;
    if (pausedFederatedTaskProjects.has(projectId)) return null;
    const current = federatedTaskStores.get(projectId);
    if (current) return current;
    try {
      const replicaRoot = resolve(masterDecisionOsRoot, 'cache', 'federation-task-state');
      const state = createProjectTaskState({
        decisionOsRoot: replicaRoot,
        projectId,
        writerId: federation?.localOwner().ownerNodeId ?? 'local',
        tasksLedgerFile: resolve(replicaRoot, 'replica-ledgers', `${projectId}.json`),
        initialize: true,
        publish: (delta) => federationTaskStateReplicator?.publishDelta(delta),
        publishContent: () => federation?.publishContentChange(),
        onPersistenceError: (error) => {
          const incident = recordIncident({
            scope: `federated-task-state:${projectId}`,
            component: 'federation-task-state',
            operation: 'materialize-federated-task-state',
            error,
            context: { projectId, ownerNodeId },
          });
          pausedFederatedTaskProjects.set(projectId, incident);
        },
      });
      const store = state.store;
      federatedProjectTaskStates.set(projectId, state);
      federatedTaskStores.set(projectId, store);
      return store;
    } catch (error) {
      const incident = recordIncident({
        scope: `federated-task-state:${projectId}`,
        component: 'federation-task-state',
        operation: 'open-federated-task-state',
        error,
        context: { projectId, ownerNodeId },
      });
      pausedFederatedTaskProjects.set(projectId, incident);
      return null;
    }
  };
  const federatedTaskStateForProject = (projectId: string, ownerNodeId: string): ProjectTaskState | null => {
    const current = federatedProjectTaskStates.get(projectId);
    if (current) return current;
    federatedTaskStoreForProject(projectId, ownerNodeId);
    return federatedProjectTaskStates.get(projectId) ?? null;
  };
  const federatedTaskRevisionForProject = (projectId: string): ReturnType<typeof createLedgerRevisionTracker> => {
    const current = federatedTaskRevisions.get(projectId);
    if (current) return current;
    const created = createLedgerRevisionTracker();
    federatedTaskRevisions.set(projectId, created);
    return created;
  };
  const taskStoreForProject = (projectId: string, ownerNodeId = ''): TaskCurrentStateStore | null => {
    if (pausedTaskProjects.has(projectId)) return null;
    const local = projectTaskStates.get(projectId)?.store;
    if (local) return local;
    const localProject = projectCatalogStore.projects().find((project) => project.id === projectId && project.available);
    if (localProject) return tryTaskStateForProject(localProject)?.store ?? null;
    return federatedTaskStoreForProject(projectId, ownerNodeId);
  };
  const executionStateForProject = (
    projectId: string,
    ownerNodeId: string,
  ): ExecutionState | null => {
    const localProject = projectCatalogStore.projects().find((project) => project.id === projectId && project.available);
    if (localProject) return tryTaskStateForProject(localProject);
    const current = federatedExecutionStates.get(projectId);
    if (current) return current;
    const store = federatedTaskStoreForProject(projectId, ownerNodeId);
    if (!store) return null;
    const executions = createTaskExecutionRepository({
      store,
      writerId: federation?.localOwner().ownerNodeId ?? 'local',
      projectId,
      persist: async (changes, emittedAt) => {
        const result = await store.mutate({
          replicaId: federation?.localOwner().ownerNodeId ?? 'local',
          changes,
          emittedAt,
        });
        federationTaskStateReplicator?.publishDelta(result.delta);
        return result.delta;
      },
      onCommitted: ({ executionId, record }) => publishExecutionChange({
        projectId,
        nodeId: federation?.localOwner().ownerNodeId ?? 'local',
        executionId,
        record,
      }),
    });
    const state: ExecutionState = {
      executions,
      finalizeExecutionArtifacts: async (executionId, files) => {
        const objectRoot = resolve(store.root, 'objects');
        const [jsonl, stderr, telemetry, result] = await Promise.all([
          files.jsonl ? captureTaskExecutionArtifact({ objectRoot, file: files.jsonl, mediaType: 'application/x-ndjson' }) : null,
          files.stderr ? captureTaskExecutionArtifact({ objectRoot, file: files.stderr, mediaType: 'text/plain' }) : null,
          files.telemetry ? captureTaskExecutionArtifact({ objectRoot, file: files.telemetry, mediaType: 'application/x-ndjson' }) : null,
          files.result ? captureTaskExecutionArtifact({ objectRoot, file: files.result, mediaType: 'application/json' }) : null,
        ]);
        return executions.finalizeArtifacts(executionId, { jsonl, stderr, telemetry, result });
      },
    };
    federatedExecutionStates.set(projectId, state);
    return state;
  };
  const globalCodexProcessCapacity = (): number => {
    const settings = runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object' ? runtime.decisionOsSettings as AnyRecord : {};
    return normalizedConcurrentCodexProcesses(process.env.CODEX_MAX_CONCURRENT_PROCESSES ?? settings.maxConcurrentCodexProcesses ?? 1) ?? 1;
  };
  const scheduledCodexRunningProcessCount = (): number => [...projectContexts.values()]
    .reduce((count, context) => count + runningCodexProcessCount({
      codexSkillRuns: context.runtime.codexSkillRuns,
      taskExecutionProcesses: context.runtime.taskExecutionProcesses,
    }), 0);
  // WHAT: Reserve one shared capacity lane for direct children outside the persisted execution scheduler.
  // WHY: Node-message and project-sync work must count against the same process ceiling as task executions.
  const sharedCodexCapacitySlots = createCodexCapacitySlots({
    capacity: globalCodexProcessCapacity,
    externalRunningCount: scheduledCodexRunningProcessCount,
  });
  const globalCodexRunningProcessCount = (): number => scheduledCodexRunningProcessCount() + sharedCodexCapacitySlots.reservedCount();
  const globalCodexQueuePosition = (id: string): number => {
    const pending = [...projectContexts.entries()].flatMap(([root, context], rootOrder) => pendingCodexProcessEntries(root, context.runtime)
      .map((entry) => ({ ...entry, order: rootOrder * 2_000_000 + entry.order })))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.order - right.order);
    const index = pending.findIndex((entry) => entry.id === id);
    return index < 0 ? 1 : index + 1;
  };
  let globalCodexScheduleRequested = false;
  const scheduleGlobalCodexProcesses = (): Promise<AnyRecord> => {
    globalCodexScheduleRequested = true;
    const active = runtime.globalCodexSchedulePromise;
    if (active instanceof Promise) return active as Promise<AnyRecord>;
    const schedule = (async (): Promise<AnyRecord> => {
      const launched: AnyRecord[] = [];
      let capacity = globalCodexProcessCapacity();
      do {
        globalCodexScheduleRequested = false;
        await Promise.resolve();
        capacity = globalCodexProcessCapacity();
        while (globalCodexRunningProcessCount() < capacity) {
          const candidate = [...projectContexts.entries()]
            .map(([root, context]) => ({ root, context, createdAt: nextPendingCodexProcessCreatedAt(root, context.runtime) }))
            .concat([...federatedSchedulerContexts.values()].map(({ root, runtime: scopedRuntime }) => ({
              root,
              context: { runtime: scopedRuntime } as ProjectContext,
              createdAt: nextPendingCodexProcessCreatedAt(root, scopedRuntime),
            })))
            .filter((entry): entry is { root: string; context: ProjectContext; createdAt: string } => entry.context.runtime.codexRuntimePaused !== true && Boolean(entry.createdAt))
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
          if (!candidate) break;
          const result = await scheduleCodexProcesses({ decisionOsRoot: candidate.root, runtime: candidate.context.runtime, launchLimit: 1 });
          const localLaunches = Array.isArray(result.launched) ? result.launched as AnyRecord[] : [];
          launched.push(...localLaunches);
          if (localLaunches.length === 0 || result.ok === false) break;
        }
      } while (globalCodexScheduleRequested);
      return { ok: launched.every((entry) => entry.ok !== false), launched, capacity };
    })().finally(() => {
      if (runtime.globalCodexSchedulePromise === schedule) delete runtime.globalCodexSchedulePromise;
      if (globalCodexScheduleRequested && !pausedBackgroundComponents.has('codex-process-scheduler')) void scheduleGlobalCodexProcesses()
        .catch((error: unknown) => recordBackgroundFailure('codex-process-scheduler', 'reschedule-global-processes', error));
    });
    Object.defineProperty(runtime, 'globalCodexSchedulePromise', { value: schedule, writable: true, configurable: true, enumerable: false });
    return schedule;
  };
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
      const committed = await state.executeMutation(mutation, before, after);
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
    };
    let activeTaskState: ProjectTaskState | null = null;
    if (projectId) {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId);
      if (!project) throw new Error(`Canonical Codex execution runtime has no project ${projectId}.`);
      const nodeId = String((projectRuntime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId
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
    projectRuntime.onCodexRunSettled = (event: AnyRecord): Promise<void> | void => {
      const ledgerId = String(event.ledgerId ?? '');
      const cardId = String(event.cardId ?? event.outputCardId ?? '');
      const status = String(event.status ?? '');
      const directSettlementEvent = {
        reason: 'codex-thread-settled', ledgerId, status,
        runId: String(event.runId ?? ''), executionId: String(event.executionId ?? ''), cardId,
        outputCardId: String(event.outputCardId ?? event.cardId ?? ''), threadId: String(event.threadId ?? '')
      };
      if (!event.pipelineRunId && ledgerId === 'tasks' && status === 'complete') {
        const finishedAt = String(event.finishedAt ?? '');
        if (!activeTaskState) throw new Error(`task_execution_state_unavailable:${projectId}`);
        return activeTaskState.transitionCardLifecycle(cardId, 'todo', finishedAt).then((committed) => {
          if (committed.changed) controlRoomProjectionStore?.invalidate(projectId, committed.localChanges);
          publishLedger(directSettlementEvent);
        });
      }
      if (!event.pipelineRunId) {
        publishLedger(directSettlementEvent);
      }
      if (event.pipelineRunId && event.pipelineTerminal === true) {
        const pipelineStatus = String(event.pipelineStatus ?? event.status ?? 'complete');
        publishLedger({
          reason: pipelineStatus === 'complete' ? 'pipeline-completed' : pipelineStatus === 'cancelled' ? 'pipeline-cancelled' : 'pipeline-failed',
          ledgerId: String(event.ledgerId ?? ''), pipelineRunId: String(event.pipelineRunId), pipelineStatus,
          status: String(event.status ?? pipelineStatus), runId: String(event.runId ?? ''),
          executionId: String(event.executionId ?? ''),
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
  const invalidateFederatedSkillExportIndex = (): void => { federatedSkillExportIndex = null; };
  const readFederatedSkillExportIndex = (): FederatedSkillExportIndex => {
    federatedSkillExportIndex ??= createFederatedSkillExportIndex(masterRoot, localWorkspaceRoots());
    return federatedSkillExportIndex;
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
      const local = new Map(readFederatedSkillExportIndex().manifest.skills.map((skill) => [skill.name, skill.revision]));
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
  federation = createFederationNodeConnector({
    settings: runtime.decisionOsSettings,
    localProjects: projectCatalog,
    localServerUrl: () => `http://127.0.0.1:${federationServerPort}`,
    onRemoteContentChange: () => {
      for (const client of globalContentEventClients) client.write('event: ledger-content-change\ndata: {"remote":true}\n\n');
    },
    onRemoteCatalogChange: () => {
      for (const project of projectCatalog().filter((entry) => entry.available)) tryTaskStateForProject(project);
      controlRoomProjectionStore?.invalidate();
      federationTaskStateReplicator?.reconcileRelay();
      for (const projectId of new Set(federation?.remoteProjects().map((project) => project.localProjectId) ?? [])) federationTaskStateReplicator?.reconcileProject('relay', projectId);
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
      const observation = frame.payload?.observation;
      const key = `${frame.projectId}\0${executionId}\0${frame.from}`;
      const now = Date.now();
      const observedAt = observation ? Date.parse(observation.observedAt) : Number.NaN;
      const expiresAt = observation ? Date.parse(observation.expiresAt) : Number.NaN;
      if (!executionId || !frame.projectId || !frame.from) return;
      if (observation === null) federatedExecutionObservations.delete(key);
      else if (observation
        && observation.executionId === executionId
        && observation.executorNodeId === frame.from
        && (observation.phase === 'starting' || observation.phase === 'running')
        && Number.isSafeInteger(observation.revision) && observation.revision >= 1
        && Number.isFinite(observedAt) && observedAt <= now + 5_000
        && Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + 60_000
        && expiresAt > observedAt && expiresAt - observedAt <= 60_000) {
        federatedExecutionObservations.set(key, observation);
      } else {
        recordStoppedOperation({
          scope: `federation-execution-observation:${frame.projectId}:${frame.from}`,
          component: 'federation-execution-observation',
          operation: 'validate-execution-observation',
          error: new Error('invalid_federated_execution_observation'),
          context: { projectId: frame.projectId, nodeId: frame.from, executionId },
        });
      }
      controlRoomProjectionStore?.invalidate(frame.projectId);
      const record = executionStateForProject(frame.projectId, frame.from)?.executions.find(executionId) ?? null;
      for (const client of globalContentEventClients) client.write(`event: codex-execution-change\ndata: ${JSON.stringify({
        remote: true,
        projectId: frame.projectId,
        nodeId: frame.from,
        executionId,
        taskId: record?.metadata.taskId ?? '',
        phase: record?.lifecycle.phase ?? '',
        revision: record?.lifecycle.revision ?? 0,
      })}\n\n`);
    },
    onStateConnected: () => {
      federationTaskStateReplicator?.reconcileRelay();
      for (const projectId of new Set(federation?.remoteProjects().map((project) => project.localProjectId) ?? [])) federationTaskStateReplicator?.reconcileProject('relay', projectId);
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
  for (const project of projectCatalog().filter((entry) => entry.available)) tryTaskStateForProject(project);
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
      controlRoomProjectionStore?.invalidate(projectId, delta.entities);
      for (const executionId of new Set(delta.entities.filter((entity) => entity.entityType === 'execution').map((entity) => entity.entityId))) {
        const executionState = executionStateForProject(projectId, from);
        publishExecutionChange({
          projectId,
          nodeId: from,
          executionId,
          // WHAT: Publish only conflict-free execution records while retaining repository diagnostics.
          // WHY: An expected causal execution conflict must not escape federation invalidation and pause the project.
          record: executionState?.executions.all().find((record) => record.metadata.executionId === executionId) ?? null,
          remote: true,
        });
      }
      for (const client of globalContentEventClients) client.write(`event: ledger-content-change\ndata: ${JSON.stringify({ remote: true, projectId, nodeId: from })}\n\n`);
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
        readDecisionOsSettings({ action_payload: { decisionOsRoot: masterDecisionOsRoot }, runtime_state: runtime }).settings,
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
  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requestPath = requestUrl.pathname;
    if (requestPath === '/api/diagnostics/runtime/resume' && request.method === 'POST') {
      const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
      const scope = String(body.scope ?? '').trim();
      let resumed = false;
      if (scope.startsWith('project-task-state:')) {
        const projectId = scope.slice('project-task-state:'.length);
        const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
        if (project) {
          pausedTaskProjects.delete(projectId);
          projectTaskStates.delete(projectId);
          resumed = Boolean(tryTaskStateForProject(project));
          if (resumed) {
            const context = projectContexts.get(project.decisionOsRoot);
            if (context) disposeProjectContext(context);
            projectContexts.delete(project.decisionOsRoot);
            resumed = Boolean(tryProjectContext(project, 'operator-resume-task-state'));
          }
          if (resumed) federationTaskStateReplicator?.reconcileProject('relay', projectId);
        }
      } else if (scope.startsWith('federated-task-state:')) {
        const projectId = scope.slice('federated-task-state:'.length);
        pausedFederatedTaskProjects.delete(projectId);
        federatedExecutionStates.delete(projectId);
        federatedTaskStores.delete(projectId);
        resumed = Boolean(federatedTaskStoreForProject(projectId, 'operator-resume'));
        if (resumed) federationTaskStateReplicator?.reconcileProject('relay', projectId);
      } else if (scope.startsWith('background:')) {
        const component = scope.slice('background:'.length);
        pausedBackgroundComponents.delete(component);
        try {
          if (component === 'pipeline-migration') migrateProjectPipelines();
          if (component === 'pipeline-catalog') initializePipelineCatalog();
          if (component === 'federated-library-sync') await synchronizeFederatedLibraries();
          if (component === 'codex-process-scheduler') await scheduleGlobalCodexProcesses();
          if (component === 'federation-content-scheduler') await federationContentScheduler?.drain();
          if (component === 'project-sync-store' || component === 'project-sync-runtime') {
            if (!resumeProjectSyncRuntime) throw new Error('Project synchronization runtime is unavailable.');
            resumeProjectSyncRuntime();
          }
          if (component.startsWith('codex-runtime:')) {
            const projectId = component.slice('codex-runtime:'.length);
            const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
            const context = project ? projectContexts.get(project.decisionOsRoot) : null;
            if (!project || !context) throw new Error(`Codex runtime ${projectId} is unavailable.`);
            try {
              await recoverTaskExecutions(context.runtime);
              context.runtime.codexRuntimePaused = false;
              await scheduleGlobalCodexProcesses();
            } catch (error) {
              context.runtime.codexRuntimePaused = true;
              throw error;
            }
          }
          if (component.startsWith('codex-startup-')) {
            const projectId = component.slice('codex-startup-'.length);
            const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
            const context = project ? projectContexts.get(project.decisionOsRoot) : null;
            if (!project || !context) throw new Error(`Project runtime ${projectId} is unavailable.`);
            await recoverTaskExecutions(context.runtime);
          }
          resumed = true;
        } catch (error) {
          recordBackgroundFailure(component, 'operator-resume-background-component', error);
        }
      } else if (scope.startsWith('project-watcher:')) {
        const projectId = scope.slice('project-watcher:'.length);
        const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
        if (project) {
          pausedProjectWatchers.delete(projectId);
          const context = projectContexts.get(project.decisionOsRoot);
          if (context) disposeProjectContext(context);
          projectContexts.delete(project.decisionOsRoot);
          resumed = Boolean(tryProjectContext(project, 'operator-resume-project-runtime'));
        }
      } else if (scope.startsWith('project-runtime:')) {
        const projectId = scope.slice('project-runtime:'.length);
        const project = projectCatalogStore.projects().find((entry) => entry.id === projectId && entry.available);
        if (project) {
          pausedProjectRuntimes.delete(projectId);
          resumed = Boolean(tryProjectContext(project, 'operator-resume-project-runtime'));
        }
      } else if (scope === 'server-runtime') {
        globalRuntimeIncident = null;
        resumed = true;
      }
      const resolved = resumed ? incidentLedger.resolveScope(scope, String(body.resolution ?? 'Operator resumed the paused runtime scope.')) : [];
      response.statusCode = resumed ? 200 : 409;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: resumed, scope, resolvedIncidentIds: resolved.map((incident) => incident.id) }));
      return;
    }
    if ((requestPath === '/api/health' || requestPath === '/api/diagnostics/incidents') && request.method === 'GET') {
      const incidentSnapshot = incidentLedger.snapshot();
      const activeIncidents = incidentSnapshot.incidents.filter((incident) => incident.status === 'paused');
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        ok: true,
        status: activeIncidents.length > 0 ? 'degraded' : 'ready',
        observedAt: new Date().toISOString(),
        incidentLedger: incidentLedger.file,
        activeIncidentCount: activeIncidents.length,
        pausedTaskProjectIds: [...pausedTaskProjects.keys()].sort(),
        pausedFederatedTaskProjectIds: [...pausedFederatedTaskProjects.keys()].sort(),
        pausedBackgroundComponents: [...pausedBackgroundComponents].sort(),
        pausedProjectWatcherIds: [...pausedProjectWatchers].sort(),
        pausedProjectRuntimeIds: [...pausedProjectRuntimes].sort(),
        ...(requestPath === '/api/diagnostics/incidents' ? { incidents: incidentSnapshot.incidents } : {}),
      }));
      return;
    }
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
    const internalExecutionPresentation = request.method === 'GET'
      ? requestPath.match(/^\/api\/internal\/task-executions\/([^/]+)\/presentation$/)
      : null;
    if (internalExecutionPresentation) {
      response.setHeader('content-type', 'application/json');
      const requesterNodeId = String(request.headers['x-decision-os-federation-node'] ?? '').trim();
      const peer = federation.nodes().find((node) => node.nodeId === requesterNodeId && node.online);
      if (!requesterNodeId || !peer) {
        response.statusCode = 403;
        response.end(JSON.stringify({ ok: false, error: 'federation_node_authentication_failed' }));
        return;
      }
      const executionId = decodeRouteSegment(internalExecutionPresentation[1]);
      const projectId = requestUrl.searchParams.get('projectId') ?? '';
      const state = projectId ? executionStateForProject(projectId, requesterNodeId) : null;
      const execution = state?.executions.find(executionId) ?? null;
      if (!state || !execution) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }));
        return;
      }
      if (execution.lifecycle.executorNodeId !== federation.localOwner().ownerNodeId) {
        response.statusCode = 409;
        response.end(JSON.stringify({
          ok: false,
          error: 'task_execution_wrong_executor',
          executionId,
          executorNodeId: execution.lifecycle.executorNodeId,
        }));
        return;
      }
      const localProject = projects.find((project) => project.id === projectId && project.available);
      const baseRuntime = federatedSchedulerContexts.get(executionId)?.runtime
        ?? (localProject ? projectContext(localProject.decisionOsRoot, localProject.id).runtime : runtime);
      const presentationRuntime = Object.create(baseRuntime) as AnyRecord;
      // WHAT: Bind the authenticated project projection to this exact internal read.
      // WHY: A remote caller must not fall back to another project's runtime execution repository.
      Object.defineProperty(presentationRuntime, 'taskExecutionState', { value: state, configurable: true, enumerable: false });
      Object.defineProperty(presentationRuntime, 'taskExecutionNodeId', {
        value: federation.localOwner().ownerNodeId,
        configurable: true,
        enumerable: false,
      });
      const store = taskStoreForProject(projectId, requesterNodeId);
      Object.defineProperty(presentationRuntime, 'taskExecutionArtifactFile', {
        value: (hash: string) => store && /^[a-f0-9]{64}$/i.test(hash)
          ? resolve(store.root, 'objects', hash.slice(0, 2), hash)
          : '',
        configurable: true,
        enumerable: false,
      });
      const result = buildTaskExecutionPresentation({ executionId, state, runtime: presentationRuntime });
      const httpResult = taskExecutionPresentationHttpResult(executionId, result);
      response.statusCode = httpResult.statusCode;
      response.end(httpResult.body);
      return;
    }
    const internalExecutionStatus = request.method === 'GET'
      ? requestPath.match(/^\/api\/internal\/task-executions\/([^/]+)\/status$/)
      : null;
    if (internalExecutionStatus) {
      response.setHeader('content-type', 'application/json');
      const requesterNodeId = String(request.headers['x-decision-os-federation-node'] ?? '').trim();
      const peer = federation.nodes().find((node) => node.nodeId === requesterNodeId && node.online);
      if (!requesterNodeId || !peer) {
        response.statusCode = 403;
        response.end(JSON.stringify({ ok: false, error: 'federation_node_authentication_failed' }));
        return;
      }
      const executionId = decodeRouteSegment(internalExecutionStatus[1]);
      const projectId = requestUrl.searchParams.get('projectId') ?? '';
      const state = projectId ? executionStateForProject(projectId, requesterNodeId) : null;
      const execution = state?.executions.find(executionId) ?? null;
      if (!state || !execution) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }));
        return;
      }
      if (execution.lifecycle.executorNodeId !== federation.localOwner().ownerNodeId) {
        response.statusCode = 409;
        response.end(JSON.stringify({
          ok: false,
          error: 'task_execution_wrong_executor',
          executionId,
          executorNodeId: execution.lifecycle.executorNodeId,
        }));
        return;
      }
      const localProject = projects.find((project) => project.id === projectId && project.available);
      const baseRuntime = federatedSchedulerContexts.get(executionId)?.runtime
        ?? (localProject ? projectContext(localProject.decisionOsRoot, localProject.id).runtime : runtime);
      const statusRuntime = Object.create(baseRuntime) as AnyRecord;
      Object.defineProperty(statusRuntime, 'taskExecutionState', { value: state, configurable: true, enumerable: false });
      Object.defineProperty(statusRuntime, 'taskExecutionNodeId', {
        value: federation.localOwner().ownerNodeId,
        configurable: true,
        enumerable: false,
      });
      const store = taskStoreForProject(projectId, requesterNodeId);
      Object.defineProperty(statusRuntime, 'taskExecutionArtifactFile', {
        value: (hash: string) => store && /^[a-f0-9]{64}$/i.test(hash)
          ? resolve(store.root, 'objects', hash.slice(0, 2), hash)
          : '',
        configurable: true,
        enumerable: false,
      });
      const result = await readCardSkillRunController({
        action_payload: {
          runId: execution.metadata.sessionId,
          ledgerId: execution.metadata.ledgerId,
          cardId: execution.metadata.ownerCardId,
          since: requestUrl.searchParams.get('since') ?? '0',
        },
        runtime_state: statusRuntime,
      });
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    const internalCancellation = request.method === 'POST'
      ? requestPath.match(/^\/api\/internal\/task-executions\/([^/]+)\/cancel$/)
      : null;
    if (internalCancellation) {
      response.setHeader('content-type', 'application/json');
      const requesterNodeId = String(request.headers['x-decision-os-federation-node'] ?? '').trim();
      const peer = federation.nodes().find((node) => node.nodeId === requesterNodeId && node.online);
      if (!requesterNodeId || !peer) {
        response.statusCode = 403;
        response.end(JSON.stringify({ ok: false, error: 'federation_node_authentication_failed' }));
        return;
      }
      const executionId = decodeRouteSegment(internalCancellation[1]);
      let body: AnyRecord = {};
      try {
        body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ ok: false, error: 'invalid_json', executionId }));
        return;
      }
      const projectId = String(body.projectId ?? '').trim();
      const state = projectId ? executionStateForProject(projectId, requesterNodeId) : null;
      if (!state) {
        response.statusCode = 503;
        response.end(JSON.stringify({ ok: false, error: 'task_execution_state_unavailable', executionId }));
        return;
      }
      const localProject = projects.find((project) => project.id === projectId && project.available);
      const baseRuntime = federatedSchedulerContexts.get(executionId)?.runtime
        ?? (localProject ? projectContext(localProject.decisionOsRoot, localProject.id).runtime : runtime);
      const cancellationRuntime = Object.create(baseRuntime) as AnyRecord;
      Object.defineProperty(cancellationRuntime, 'taskExecutionState', {
        value: state,
        configurable: true,
        enumerable: false,
      });
      Object.defineProperty(cancellationRuntime, 'taskExecutionNodeId', {
        value: federation.localOwner().ownerNodeId,
        configurable: true,
        enumerable: false,
      });
      const result = await cancelTaskExecutionLocally({ runtime: cancellationRuntime, executionId });
      response.statusCode = result.statusCode;
      response.end(JSON.stringify(result));
      return;
    }
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
      const relayConvergence = federationTaskStateReplicator?.diagnostics().convergence.find((entry) => entry.peerId === 'relay' && entry.projectId === localProjectId);
      const taskRootReady = Boolean(projection);
      const relayRootCurrent = Boolean(
        relayConvergence?.converged
        && relayConvergence.root === taskStore?.rootHash(),
      );
      if (!relayRootCurrent) federationTaskStateReplicator?.reconcileProject('relay', localProjectId);
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
            resourceReady = !key || Boolean(content.file);
            contentStatus = { status: content.state, resource: key, error: content.error, conflict: content.conflict, candidates: content.candidates };
            if (!resourceReady) {
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
        status: !taskRootReady || !resourceReady
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
        if (!taskRootReady) federationTaskStateReplicator?.reconcileProject('relay', localProjectId);
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
        const committed = await state.executeMutation(mutation, before, after);
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
    if (!projectScope && url === '/api/federation/nodes' && request.method === 'GET') {
      const localOwner = federation.localOwner();
      const remoteProjects = federation.remoteProjects();
      const nodes = [
        {
          nodeId: localOwner.ownerNodeId,
          nodeLabel: localOwner.ownerNodeLabel,
          online: true,
          local: true,
          projects: projects.map((project) => ({ projectId: project.id, name: project.name, available: project.available })),
        },
        ...federation.nodes().map((node) => ({
          nodeId: node.nodeId,
          nodeLabel: node.nodeLabel,
          online: node.online,
          local: false,
          projects: remoteProjects
            .filter((project) => project.ownerNodeId === node.nodeId)
            .map((project) => ({ projectId: project.localProjectId, name: project.name, available: project.online })),
        })),
      ];
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, nodes }));
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
    if (url === '/api/git-review' && request.method === 'GET' && activeProject) {
      try {
        const result = readGitReview({
          workspaceRoot: dirname(activeProject.decisionOsRoot),
          repository: requestUrl.searchParams.get('repo') ?? '.',
          target: requestUrl.searchParams.get('path') ?? '.',
        });
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, ...result }));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    if (url === '/api/git-review/stage' && request.method === 'POST' && activeProject) {
      try {
        const payload = JSON.parse((await readRequestBuffer(request)).toString('utf8')) as AnyRecord;
        const result = applyGitReviewPatch({
          workspaceRoot: dirname(activeProject.decisionOsRoot),
          repository: String(payload.repository ?? '.'),
          target: String(payload.target ?? '.'),
          expectedPatchHash: String(payload.expectedPatchHash ?? ''),
          patch: String(payload.patch ?? ''),
          operation: payload.operation === 'unstage' ? 'unstage' : 'stage',
        });
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, ...result }));
      } catch (error) {
        response.statusCode = 409;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    if (!projectScope && url === '/api/control-room' && request.method === 'GET') {
      for (const project of projects) {
        // WHAT: Hydrate only available project contexts before projection reads.
        // WHY: Control Room must preserve unavailable catalog entries without touching absent paths.
        if (project.available) projectContext(project.decisionOsRoot, project.id);
      }
      const projection = controlRoomProjectionStore.get(projects.filter((project) => project.available));
      const localOwner = federation.localOwner();
      const remoteDiagnostics: AnyRecord[] = [];
      const remoteProjectIdentity = new Map(federation.remoteProjects().map((project) => [
        `${project.ownerNodeId}\0${project.localProjectId}`,
        project.originFingerprint,
      ]));
      const remoteProjections = requestUrl.searchParams.get('localOnly') === '1' ? [] : federation.remoteProjects().flatMap((project) => {
        const store = federatedTaskStoreForProject(project.localProjectId, project.ownerNodeId);
        if (!store || store.diagnostics().entityCount === 0) {
          federationTaskStateReplicator?.reconcileProject(project.ownerNodeId, project.localProjectId);
          return [];
        }
        const executionRepository = createTaskExecutionRepository({
          store,
          writerId: project.ownerNodeId,
          projectId: project.localProjectId,
        });
        const executions = executionRepository.all();
        return [{
          projection: controlRoomProjectionFromTaskLedger({
            project: { ...project, id: project.localProjectId, originFingerprint: remoteProjectIdentity.get(`${project.ownerNodeId}\0${project.localProjectId}`) ?? project.originFingerprint },
            ledger: store.projection().ledger,
            conflicts: store.projection().conflicts,
            executions,
            executionDiagnostics: executionRepository.diagnostics(),
            executionObservationFor: (executionId) => {
              const observation = federatedExecutionObservations.get(`${project.localProjectId}\0${executionId}\0${project.ownerNodeId}`) ?? null;
              if (!observation || Date.parse(observation.expiresAt) <= Date.now()) return null;
              return observation;
            },
          }),
          owner: { nodeId: project.ownerNodeId, nodeLabel: project.ownerNodeLabel, remote: true, online: project.online },
        }];
      });
      const publicProjection = withProjectSyncRuns(federatedControlRoomProjection({
        localProjection: projection,
        localOwner: { nodeId: localOwner.ownerNodeId, nodeLabel: localOwner.ownerNodeLabel, remote: false },
        remoteProjections,
        diagnostics: remoteDiagnostics,
      }), projectSyncStore.list());
      const etag = `"${String(publicProjection.fingerprint)}"`;
      if (request.headers['if-none-match'] === etag) {
        response.statusCode = 304;
        response.setHeader('etag', etag);
        response.end();
        return;
      }
      delete publicProjection.dependencies;
      delete publicProjection.projectSlices;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.setHeader('etag', etag);
      response.end(JSON.stringify(publicProjection));
      return;
    }
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
    const taskExecutionStateRead = request.method === 'GET'
      ? url.match(/^\/api\/tasks\/([^/]+)\/execution-state$/)
      : null;
    if (taskExecutionStateRead) {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      const taskId = decodeRouteSegment(taskExecutionStateRead[1]);
      const executionState = taskExecutionState(requestRuntime);
      if (!executionState) {
        response.statusCode = 503;
        response.end(JSON.stringify({ ok: false, error: 'task_execution_state_unavailable', taskId }));
        return;
      }
      // WHAT: Derive the complete lightweight hierarchy from the indexed Epoch 4 projection.
      // WHY: Opening a task must not read every JSONL artifact or depend on card session aliases.
      response.end(JSON.stringify(projectTaskExecutionState({
        taskId,
        state: executionState,
        queuePosition: (record) => unifiedCodexQueuePosition({
          decisionOsRoot: String(requestRuntime.decisionOsRoot ?? ''),
          id: record.metadata.executionId,
          createdAt: record.metadata.requestedAt,
          runtime: requestRuntime,
        }),
      })));
      return;
    }
    const taskExecutionPresentationRead = request.method === 'GET'
      ? url.match(/^\/api\/task-executions\/([^/]+)$/)
      : null;
    if (taskExecutionPresentationRead) {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      const executionId = decodeRouteSegment(taskExecutionPresentationRead[1]);
      const executionState = taskExecutionState(requestRuntime);
      const execution = executionState?.executions.find(executionId) ?? null;
      if (!executionState || !execution) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }));
        return;
      }
      const executorNodeId = execution.lifecycle.executorNodeId;
      const localExecutorNodeId = federation.localOwner().ownerNodeId;
      const terminal = ['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.lifecycle.phase);
      if (executorNodeId !== localExecutorNodeId && !terminal) {
        // WHAT: Proxy an active read to the node that owns the exact process.
        // WHY: Mutable live artifacts remain executor-local until settlement.
        const remote = await federation.request(
          executorNodeId,
          `/api/internal/task-executions/${encodeURIComponent(executionId)}/presentation?projectId=${encodeURIComponent(execution.metadata.projectId)}`,
        );
        response.statusCode = remote.status;
        response.end(remote.body);
        return;
      }
      // WHAT: Prefer the execution-scoped runtime used by federated pipeline work on this node.
      // WHY: Its live process registry can differ from the project page's ordinary request runtime.
      let presentationRuntime = federatedSchedulerContexts.get(executionId)?.runtime ?? requestRuntime;
      if (executorNodeId !== localExecutorNodeId) {
        try {
          // WHAT: Fetch only artifacts required to build the terminal presentation.
          // WHY: Telemetry and result objects add transfer cost without contributing log entries.
          const heads = [execution.artifacts.jsonl, execution.artifacts.stderr].filter((head) => head !== null);
          await Promise.all(heads.map((head) => federation.requestToFile(
            executorNodeId,
            `/api/federation/content-object?projectId=${encodeURIComponent(execution.metadata.projectId)}&hash=${encodeURIComponent(head.hash)}`,
            federationContentStore.objectFile(head.hash),
            head.hash,
          )));
          presentationRuntime = Object.create(requestRuntime) as AnyRecord;
          Object.defineProperty(presentationRuntime, 'taskExecutionArtifactFile', {
            value: (hash: string) => /^[a-f0-9]{64}$/i.test(hash) ? federationContentStore.objectFile(hash) : '',
            configurable: true,
            enumerable: false,
          });
        } catch (error) {
          const incidentId = recordStoppedOperation({
            scope: `task-execution-presentation:${executionId}`,
            component: 'task-execution-presentation',
            operation: 'fetch-terminal-artifacts',
            error,
            context: { projectId: execution.metadata.projectId, executionId, executorNodeId },
          });
          response.statusCode = 502;
          response.end(JSON.stringify({
            ok: false,
            error: 'task_execution_artifact_unavailable',
            executionId,
            incidentId,
          }));
          return;
        }
      }
      const result = buildTaskExecutionPresentation({
        executionId,
        state: executionState,
        runtime: presentationRuntime,
      });
      const httpResult = taskExecutionPresentationHttpResult(executionId, result);
      response.statusCode = httpResult.statusCode;
      response.end(httpResult.body);
      return;
    }
    const persistLedgerAndRespond = async (ledgerId: string, ledgerPath: string, ledger: AnyRecord, activeResponse: ServerResponse, activeDecisionOsRoot = decisionOsRoot): Promise<void> => {
      // WHAT: Reject any task projection that reaches the generic document writer.
      // WHY: Task state accepts declared entity commands only.
      if (ledgerId === 'tasks') throw new Error('aggregate_task_state_commit_removed');
      stripHydratedThreadNotes(ledger);
      context.watcher.ignoreNext(ledgerPath);
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
      const persistedLedger = ledger;
      context.watcher.refreshOwnership();
      controlRoomProjectionStore?.invalidate(activeProject?.id ?? '');
      if (ledgerId !== 'tasks') federation?.publishContentChange();
      activeResponse.setHeader(ledgerRevisionHeader, String(ledgerRevisions.advance(ledgerId)));
      activeResponse.end(JSON.stringify(hydrateLedgerCardContent(persistedLedger, activeDecisionOsRoot)));
    };
    const persistLedgerMutationAndRespond = async (ledgerId: string, ledgerPath: string, beforeLedger: AnyRecord, ledger: AnyRecord, mutation: LedgerMutation, activeResponse: ServerResponse): Promise<void> => {
      // WHAT: Preserve hydrated task notes until the scoped command derives entity changes.
      // WHY: Removing them here turns absent aggregate fields into thread-note tombstones.
      if (ledgerId !== 'tasks') stripHydratedThreadNotes(ledger);
      context.watcher.ignoreNext(ledgerPath);
      let taskCommit: Awaited<ReturnType<ProjectTaskState['executeMutation']>> | null = null;
      try {
        taskCommit = ledgerId === 'tasks' && localProject
          ? await taskStateForProject(localProject).executeMutation(mutation, beforeLedger, ledger)
          : null;
      } catch (error) {
        if (error instanceof Error && error.message === 'task_state_bootstrap_incomplete') {
          activeResponse.statusCode = 503;
          activeResponse.end(JSON.stringify({ ok: false, error: 'task-state-bootstrap-incomplete' }));
          return;
        }
        if (error instanceof Error && error.message.startsWith('task_lifecycle_conflict:')) {
          activeResponse.statusCode = 409;
          activeResponse.end(JSON.stringify({ ok: false, error: 'task-conflict', cardIds: error.message.slice('task_lifecycle_conflict:'.length).split(',').filter(Boolean) }));
          return;
        }
        if (error instanceof Error && error.message.startsWith('task_execution_active:')) {
          activeResponse.statusCode = 409;
          activeResponse.end(JSON.stringify({ ok: false, error: 'task_execution_active', cardId: error.message.slice('task_execution_active:'.length) }));
          return;
        }
        if (error instanceof Error && error.message === 'invalid_task_assignment') {
          activeResponse.statusCode = 400;
          activeResponse.end(JSON.stringify({ ok: false, error: 'invalid_task_assignment' }));
          return;
        }
        throw error;
      }
      const persistedLedger = taskCommit?.ledger ?? (writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)), ledger);
      context.watcher.refreshOwnership();
      if (!taskCommit) controlRoomProjectionStore?.invalidate(activeProject?.id ?? '');
      else if (taskCommit.changed) controlRoomProjectionStore?.invalidate(activeProject?.id ?? '', taskCommit.localChanges);
      if (ledgerId !== 'tasks') federation?.publishContentChange();
      const revision = ledgerRevisions.advance(ledgerId);
      const taskClock = taskCommit && localProject
        ? taskStateForProject(localProject).store.clientClock()
        : null;
      const cardId = String(mutation.cardPatch?.id ?? mutation.card?.id ?? mutation.cardId ?? mutation.masterTaskId ?? '');
      const threadId = String(mutation.note?.threadId ?? ((mutation.action === 'create-card' || mutation.action === 'create-task-intake') && cardId ? `thread-${cardId}` : ''));
      const changedCard = cardId
        ? ledgerCardProjection({ decisionOsRoot, ledgerId, ledger: persistedLedger, cardId })
        : null;
      const changedThread = threadId ? ledgerThreadProjection({ decisionOsRoot, ledgerId, ledger: ledgerId === 'tasks' ? persistedLedger : undefined, threadId }) : null;
      const annotationId = String(mutation.annotation?.id ?? mutation.region?.id ?? '');
      const relationshipId = String(mutation.relationship?.id ?? '');
      const createdCards = mutation.action === 'create-master-task'
        ? [mutation.card, ...(mutation.cards ?? [])].filter((card): card is AnyRecord => Boolean(card?.id))
        : [];
      const createdFiles = createdCards.map((card, index) => ({
        kind: index === 0 ? 'master-task' : 'subtask',
        cardId: String(card.id ?? ''),
        path: resolveCardContentFile(decisionOsRoot, (card.comment as AnyRecord | undefined)?.contentFile) ?? '',
      }));
      const body = {
        ok: true,
        ledgerId,
        revision,
        ...(taskCommit && localProject && taskClock ? {
          taskClock,
          receipt: {
            mutationId: String(mutation.mutationId ?? ''),
            clock: taskClock,
            entities: taskCommit.localChanges,
          },
        } : {}),
        changedCard,
        changedThread,
        changedAnnotation: annotationId && Array.isArray(persistedLedger.annotations) ? persistedLedger.annotations.find((entry) => String((entry as AnyRecord).id ?? '') === annotationId) ?? null : null,
        changedRelationship: relationshipId && Array.isArray(persistedLedger.relationships) ? persistedLedger.relationships.find((entry) => String((entry as AnyRecord).id ?? '') === relationshipId) ?? null : null,
        createdFiles,
        removedCardIds: mutation.action === 'delete-card' && cardId ? [cardId] : [],
        removedZoneIds: mutation.action === 'delete-zones' ? (mutation.zoneIds ?? []) : [],
        removedGroupIds: mutation.action === 'delete-zones' ? (mutation.groupIds ?? []) : [],
        removedRelationshipIds: mutation.action === 'delete-relationships' ? (mutation.relationshipIds ?? []) : [],
      };
      activeResponse.setHeader(ledgerRevisionHeader, String(revision));
      activeResponse.end(JSON.stringify(body));
    };
    const scopedLedgerRead = url.match(/^\/api\/ledgers\/([^/]+)\/(canvas|navigation|search)$/);
    const scopedCardRead = url.match(/^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)$/);
    const scopedThreadRead = url.match(/^\/api\/ledgers\/([^/]+)\/threads\/([^/]+)$/);
    if (request.method === 'GET' && (scopedLedgerRead || scopedCardRead || scopedThreadRead)) {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const ledgerId = decodeRouteSegment((scopedLedgerRead ?? scopedCardRead ?? scopedThreadRead)?.[1] ?? '');
      const taskLedger = ledgerId === 'tasks' && localProject ? taskStateForProject(localProject).projection().ledger : undefined;
      const projection = scopedLedgerRead?.[2] === 'canvas'
        ? ledgerCanvasProjection({ decisionOsRoot, ledgerId, ledger: taskLedger })
        : scopedLedgerRead?.[2] === 'navigation'
          ? ledgerNavigationProjection({ decisionOsRoot, ledgerId, ledger: taskLedger })
          : scopedLedgerRead?.[2] === 'search'
            ? ledgerSearchProjection({ decisionOsRoot, ledgerId, ledger: taskLedger, zoneId: requestUrl.searchParams.get('zoneId') ?? '', query: requestUrl.searchParams.get('q') ?? '' })
            : scopedCardRead
              ? ledgerCardProjection({ decisionOsRoot, ledgerId, ledger: taskLedger, cardId: decodeRouteSegment(scopedCardRead[2]) })
              : ledgerThreadProjection({ decisionOsRoot, ledgerId, ledger: taskLedger, threadId: decodeRouteSegment(scopedThreadRead?.[2] ?? '') });
      if (projection && localProject && ledgerId === 'tasks' && scopedCardRead) {
        const comment = projection.comment && typeof projection.comment === 'object' ? projection.comment as AnyRecord : {};
        const key = String(comment.contentFile ?? '');
        const localFile = resolveCardContentFile(decisionOsRoot, key);
        if (key && (!localFile || !existsSync(localFile))) {
          const content = await readTaskContentOnDemand({ projectId: localProject.id, store: taskStateForProject(localProject).store, key, contentStore: federationContentStore, drain: federationContentScheduler?.drain ?? null });
          projection.comment = { ...comment, what: content.body };
          projection.state = { ...(projection.state as AnyRecord ?? {}), content: { status: content.available ? 'available' : content.conflict ? 'conflict' : 'synchronizing', resource: key, conflict: content.conflict, candidates: content.candidates } };
        }
      }
      if (projection && localProject && ledgerId === 'tasks' && scopedThreadRead) {
        const threadId = decodeRouteSegment(scopedThreadRead[2]);
        const refs = taskLedger?.threadFiles && typeof taskLedger.threadFiles === 'object' ? taskLedger.threadFiles as AnyRecord : {};
        const key = String(refs[threadId] ?? '');
        const localFile = resolveThreadContentFile(decisionOsRoot, key);
        if (key && (!localFile || !existsSync(localFile))) {
          const content = await readTaskContentOnDemand({ projectId: localProject.id, store: taskStateForProject(localProject).store, key, contentStore: federationContentStore, drain: federationContentScheduler?.drain ?? null });
          projection.notes = { [threadId]: content.body ? parseThreadMarkdown(content.body) : [] };
          projection.state = { ...(projection.state as AnyRecord ?? {}), content: { status: content.available ? 'available' : content.conflict ? 'conflict' : 'synchronizing', resource: key, conflict: content.conflict, candidates: content.candidates } };
        }
      }
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.setHeader(ledgerRevisionHeader, String(ledgerRevisions.current(ledgerId)));
      if (localProject && ledgerId === 'tasks') {
        const taskClock = taskStateForProject(localProject).store.clientClock();
        response.setHeader('x-decision-os-task-clock', Buffer.from(JSON.stringify(taskClock)).toString('base64url'));
      }
      response.statusCode = projection ? 200 : 404;
      response.end(JSON.stringify(projection ?? { ok: false, error: 'Scoped ledger resource not found.' }));
      return;
    }
    if (!projectScope && url === '/api/federation/content-manifest' && request.method === 'GET') {
      const contentUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const project = projects.find((entry) => entry.id === contentUrl.searchParams.get('projectId') && entry.available);
      if (!project) {
        response.statusCode = 404;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'Local project is unavailable.' }));
        return;
      }
      const requestedKey = contentUrl.searchParams.get('key') ?? '';
      const resources = taskStateForProject(project).store.contentHeads(requestedKey).map(({ sourceReplicaId: _sourceReplicaId, ...head }) => head);
      const manifest: FederationContentManifest = { version: 1, projectId: project.id, generatedAt: new Date().toISOString(), complete: !requestedKey, resources };
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(manifest));
      return;
    }
    if (!projectScope && url === '/api/task-state/projection' && request.method === 'GET') {
      const projectId = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('projectId') ?? '';
      const project = projects.find((entry) => entry.id === projectId && entry.available);
      if (!project) {
        response.statusCode = 404;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'task_state_project_not_found' }));
        return;
      }
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, projectId, ledger: taskStateForProject(project).projection().ledger }));
      return;
    }
    if (!projectScope && url === '/api/task-state/transition-card-lifecycle' && request.method === 'POST') {
      // WHAT: Accept one CLI lifecycle transition against the current local projection.
      // WHY: The CLI must never round-trip the aggregate Tasks document.
      const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
      const project = projects.find((entry) => entry.id === String(body.projectId ?? '') && entry.available);
      const cardId = String(body.cardId ?? '');
      const lifecycleStatus = String(body.lifecycleStatus ?? '');
      if (!project || !cardId || (lifecycleStatus !== 'todo' && lifecycleStatus !== 'done')) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'A local project, card, and todo or done lifecycle are required.' }));
        return;
      }
      const state = taskStateForProject(project);
      let committed: Awaited<ReturnType<typeof state.transitionCardLifecycle>>;
      try {
        committed = await state.transitionCardLifecycle(cardId, lifecycleStatus);
      } catch (error) {
        if (error instanceof Error && error.message === 'task_state_bootstrap_incomplete') {
          response.statusCode = 503;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ ok: false, error: 'task-state-bootstrap-incomplete' }));
          return;
        }
        if (error instanceof Error && error.message === `task_card_not_found:${cardId}`) {
          response.statusCode = 404;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ ok: false, error: 'Card not found.', cardId }));
          return;
        }
        throw error;
      }
      if (committed.changed) controlRoomProjectionStore?.invalidate(project.id, committed.localChanges);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, cardId, lifecycleStatus, changedBatchCount: Number(committed.changed) }));
      return;
    }
    if (!projectScope && url === '/api/task-state/commit' && request.method === 'POST') {
      // WHAT: Fail legacy aggregate task writers explicitly.
      // WHY: A stripped projection can otherwise convert omitted sidecar notes into tombstones.
      response.statusCode = 410;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: false, error: 'aggregate_task_state_commit_removed' }));
      return;
    }
    if (!projectScope && url === '/api/federation/replication-status' && request.method === 'GET') {
      const stores = [
        ...[...projectTaskStates].map(([projectId, state]) => ({ projectId, ownerNodeId: federation?.localOwner().ownerNodeId ?? 'local', store: state.store })),
        ...[...federatedTaskStores].map(([projectId, store]) => ({ projectId, ownerNodeId: 'replicated', store })),
      ];
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        stateLane: {
          ...federationTaskStateReplicator?.diagnostics(),
          projects: stores.map(({ projectId, ownerNodeId, store }) => ({
            projectId,
            ownerNodeId,
            entityCount: store.diagnostics().entityCount,
            journalCount: store.diagnostics().journalCount,
            currentBytes: store.diagnostics().currentBytes,
            conflictCount: store.projection().conflicts.length,
            projectionVersion: store.projection().version,
          })),
        },
        contentLane: { ...federationContentStore.status(), running: federationContentScheduler?.running ?? false },
      }));
      return;
    }
    if (!projectScope && url === '/api/federation/content-object' && request.method === 'GET') {
      const contentUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const projectId = contentUrl.searchParams.get('projectId') ?? '';
      const project = projects.find((entry) => entry.id === projectId && entry.available);
      const knownRemoteProject = federation.remoteProjects().some((entry) => entry.localProjectId === projectId);
      // WHAT: Serve objects only within a locally known project namespace.
      // WHY: The hash endpoint must not become an unscoped cache reader.
      if (!project && !knownRemoteProject) {
        response.statusCode = 404;
        response.end();
        return;
      }
      const hash = contentUrl.searchParams.get('hash') ?? '';
      const localFile = project && /^[a-f0-9]{64}$/i.test(hash)
        ? resolve(taskStateForProject(project).store.root, 'objects', hash.slice(0, 2), hash)
        : '';
      const cachedFile = /^[a-f0-9]{64}$/i.test(hash) ? federationContentStore.objectFile(hash) : '';
      const referencedHead = project && /^[a-f0-9]{64}$/i.test(hash)
        ? taskStateForProject(project).store.contentHeads().find((head) => head.hash === hash)
        : undefined;
      const referencedFile = project && referencedHead
        ? await resolveVerifiedManifestResourceFile({ decisionOsRoot: project.decisionOsRoot, key: referencedHead.key, hash })
        : '';
      const file = localFile && existsSync(localFile) ? localFile : referencedFile || cachedFile;
      // WHAT: Prefer locally authoritative bytes, then an already verified replica object.
      // WHY: Migration-owned local heads reference immutable workspace files without duplicating binary payloads.
      if (!file || !existsSync(file)) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader('cache-control', 'private, max-age=31536000, immutable');
      response.setHeader('content-type', 'application/octet-stream');
      const stream = createReadStream(file);
      stream.on('error', () => { if (!response.headersSent) response.statusCode = 500; response.end(); });
      stream.pipe(response);
      return;
    }
    if (!projectScope && url === '/api/federation/skills-manifest' && request.method === 'GET') {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (requestUrl.searchParams.get('refresh') === '1') invalidateFederatedSkillExportIndex();
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(readFederatedSkillExportIndex().manifest));
      return;
    }
    if (!projectScope && url === '/api/federation/skills-snapshot' && request.method === 'GET') {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const skillName = requestUrl.searchParams.get('name')?.trim() ?? '';
      if (!skillName) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'Skill name is required.' }));
        return;
      }
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(readFederatedSkillExportIndex().snapshot(new Set([skillName]))));
      return;
    }
    if (!projectScope && url === '/api/federation/pipelines-snapshot' && request.method === 'GET') {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(exportFederatedPipelineSnapshot(localDecisionOsRoots())));
      return;
    }
    if (!projectScope && url === '/api/federation/libraries/synchronize' && request.method === 'POST') {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      try {
        pausedBackgroundComponents.delete('federated-library-sync');
        await synchronizeFederatedLibraries(true);
        const status = runtime.federatedLibrarySyncStatus as AnyRecord | undefined;
        if (status?.phase === 'synchronized') {
          response.end(JSON.stringify({ ok: true, synchronizedPeerCount: Number(status.synchronizedPeerCount ?? 0) }));
        } else {
          response.statusCode = 202;
          response.end(JSON.stringify({ ok: false, ...status }));
        }
      } catch (error) {
        response.statusCode = 502;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Federated library synchronization failed.' }));
      }
      return;
    }
    if (url === '/api/settings/codex-processes' && request.method === 'GET') {
      const settings = readDecisionOsSettings({ action_payload: { decisionOsRoot: masterDecisionOsRoot }, runtime_state: runtime }).settings as AnyRecord;
      const configured = normalizedConcurrentCodexProcesses(settings.maxConcurrentCodexProcesses) ?? 1;
      const pipelineCatalog = listCodexPipelinesController({ runtime_state: { ...runtime, decisionOsRoot: masterDecisionOsRoot, projectId: '' } });
      const pipelines = Array.isArray(pipelineCatalog.pipelines) ? pipelineCatalog.pipelines as AnyRecord[] : [];
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        ok: true,
        maxConcurrentCodexProcesses: Number.isInteger(configured) ? configured : 1,
        voicePipelineId: String(settings.voicePipelineId ?? ''),
        masterTaskCompletionPipelineId: String(settings.masterTaskCompletionPipelineId ?? ''),
        pipelines: pipelines.map((pipeline) => ({ id: String(pipeline.id ?? ''), name: String(pipeline.name ?? pipeline.id ?? '') })),
        minimum: 1,
        maximum: 32
      }));
      return;
    }
    if (url === '/api/settings/codex-processes' && request.method === 'PATCH') {
      const bodyBuffer = await readRequestBuffer(request);
      let body: AnyRecord = {};
      try {
        body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
      } catch {
        body = {};
      }
      const pipelineCatalog = listCodexPipelinesController({ runtime_state: { ...runtime, decisionOsRoot: masterDecisionOsRoot, projectId: '' } });
      const pipelines = Array.isArray(pipelineCatalog.pipelines) ? pipelineCatalog.pipelines as AnyRecord[] : [];
      const result = saveCodexProcessSettings({
        decisionOsRoot: masterDecisionOsRoot,
        runtime,
        maxConcurrentCodexProcesses: body.maxConcurrentCodexProcesses,
        voicePipelineId: body.voicePipelineId,
        masterTaskCompletionPipelineId: body.masterTaskCompletionPipelineId,
        availableVoicePipelineIds: pipelines.map((pipeline) => String(pipeline.id ?? '')).filter(Boolean),
        availableMasterTaskCompletionPipelineIds: pipelines.map((pipeline) => String(pipeline.id ?? '')).filter(Boolean)
      });
      if (result.ok === true) {
        pausedBackgroundComponents.delete('codex-process-scheduler');
        void scheduleGlobalCodexProcesses()
          .catch((error: unknown) => recordBackgroundFailure('codex-process-scheduler', 'settings-change-schedule', error));
      }
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/settings/federation' && request.method === 'GET') {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, ...federation.status() }));
      return;
    }
    if (url === '/api/settings/federation' && request.method === 'PATCH') {
      const bodyBuffer = await readRequestBuffer(request);
      let body: AnyRecord = {};
      try { body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord; } catch { body = {}; }
      const result = saveFederationSettings({ decisionOsRoot: masterDecisionOsRoot, runtime, value: body });
      if (result.ok === true) federation.reconfigure(result.settings);
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result.ok === true ? { ok: true, ...federation.status() } : result));
      return;
    }
    if (url === '/api/project-sync/repository-status' && request.method === 'GET') {
      const projectId = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('projectId') ?? '';
      const project = projects.find((entry) => entry.id === projectId && entry.available);
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      if (!project) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, error: 'Local project is unavailable.' }));
        return;
      }
      try {
        const snapshot = readRepositorySyncStatus(project.root);
        if (request.headers['x-decision-os-federation-node'] && !isNetworkGitOrigin(snapshot.originUrl)) {
          throw new Error('Federated synchronization requires a network Git origin.');
        }
        response.end(JSON.stringify({ ok: true, projectId, snapshot }));
      }
      catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Repository preflight failed.' }));
      }
      return;
    }
    if (url === '/api/project-sync/role' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      response.setHeader('content-type', 'application/json');
      activeProjectSyncController();
      try {
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        const authenticatedNodeId = String(request.headers['x-decision-os-federation-node'] ?? '');
        if (!authenticatedNodeId || authenticatedNodeId !== String(body.initiatorNodeId ?? '')) throw new Error('Federation participant authentication failed.');
        const project = projects.find((entry) => entry.id === String(body.projectId ?? '') && entry.available);
        if (!project) throw new Error('Local project is unavailable.');
        const role = String(body.role ?? '') as ProjectSyncRole;
        if (!['source-publisher', 'initiator-reconciler', 'source-finalizer'].includes(role)) throw new Error('Invalid project synchronization role.');
        const snapshot = body.snapshot as ReturnType<typeof readRepositorySyncStatus>;
        if (!snapshot || snapshot.originFingerprint !== readRepositorySyncStatus(project.root).originFingerprint) throw new Error('Project synchronization snapshot identity mismatch.');
        if (String(body.originFingerprint ?? '') !== snapshot.originFingerprint) throw new Error('Project synchronization origin lock identity mismatch.');
        projectSyncStore.acquireLock(snapshot.originFingerprint, String(body.syncId ?? ''));
        const masterTask = body.masterTask && typeof body.masterTask === 'object' ? body.masterTask as AnyRecord : {};
        const executionId = String(body.executionId ?? '');
        if (!executionId) throw new Error('Project synchronization execution identity is required.');
        const projectRuntime = projectContext(project.decisionOsRoot, project.id).runtime;
        const pipelineRun = body.pipelineRun as CodexPipelineRun;
        const installed = installFederatedPipelineRun({
          decisionOsRoot: project.decisionOsRoot,
          runtime: projectRuntime,
          run: pipelineRun,
        }).run;
        const locatedSkill = installed.steps.flatMap((step) => step.skills)
          .find((skill) => skill.executionId === executionId);
        const localNodeId = federation.localOwner().ownerNodeId;
        if (!locatedSkill?.executor
          || locatedSkill.executor.nodeId !== localNodeId
          || locatedSkill.executor.projectId !== project.id
          || locatedSkill.executor.role !== role) {
          throw new Error('Project synchronization executor plan does not target this node and project.');
        }
        const metadata = body.executionMetadata as TaskExecutionMetadata;
        if (!metadata || metadata.executionId !== executionId
          || metadata.pipelineRunId !== installed.id
          || metadata.pipelineSkillRunId !== locatedSkill.runId) {
          throw new Error('Project synchronization execution metadata does not match its pipeline plan.');
        }
        const taskProjectId = String(masterTask.projectId ?? '');
        if (!taskProjectId || metadata.projectId !== taskProjectId) {
          throw new Error('Project synchronization task project does not match its execution metadata.');
        }
        const state = executionStateForProject(taskProjectId, authenticatedNodeId);
        if (!state) throw new Error('Project synchronization task execution state is unavailable.');
        let execution = state.executions.find(executionId);
        if (!execution) {
          execution = await state.executions.admit({ metadata, executorNodeId: localNodeId });
        }
        if (execution.lifecycle.executorNodeId !== localNodeId) {
          throw new Error('Project synchronization execution belongs to another node.');
        }
        if (execution.lifecycle.phase === 'preparing') {
          await state.executions.transition(executionId, { phase: 'queued' });
        }
        if (metadata.predecessorExecutionId) {
          const predecessorDeadline = Date.now() + 15_000;
          while (state.executions.find(metadata.predecessorExecutionId)?.lifecycle.phase !== 'succeeded'
            && Date.now() < predecessorDeadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 50));
          }
          if (state.executions.find(metadata.predecessorExecutionId)?.lifecycle.phase !== 'succeeded') {
            throw new Error('Project synchronization predecessor did not converge on the selected executor.');
          }
        }
        // WHAT: Execute role-local files against the replicated state of the task project.
        // WHY: A source role can run in another project, but its execution identity still
        // belongs to the initiator's master task and must converge in that project lane.
        const executionRuntime = Object.create(projectRuntime) as AnyRecord;
        Object.defineProperty(executionRuntime, 'taskExecutionState', {
          value: state,
          configurable: true,
          enumerable: false,
        });
        federatedSchedulerContexts.set(executionId, { root: project.decisionOsRoot, runtime: executionRuntime });
        try {
          const executed = await executeFederatedPipelineSkill({
            decisionOsRoot: project.decisionOsRoot,
            runtime: executionRuntime,
            pipelineRunId: installed.id,
            executionId,
            executor: locatedSkill.executor,
            execute: async (skill) => {
              const codex = await executeProjectSyncPipelineSkill({
                projectRoot: project.root,
                runtime: executionRuntime,
                ledgerFile: resolve(project.decisionOsRoot, tasksLedgerForProject(project).ledgerFile.replace(/^\.decision-os\//, '')),
                syncId: String(body.syncId ?? ''),
                nodeId: localNodeId,
                initiatorNodeId: String(body.initiatorNodeId ?? ''),
                role,
                requiredSha: String(body.requiredSha ?? '') || undefined,
                snapshot,
                codexRunId: skill.runId,
                executionId: skill.executionId,
                manageTaskExecutionLifecycle: false,
                stdoutFile: skill.stdoutFile,
                stderrFile: skill.stderrFile,
                pipelineRunId: installed.id,
                masterTask: {
                  projectId: String(masterTask.projectId ?? ''),
                  ledgerId: String(masterTask.ledgerId ?? ''),
                  cardId: String(masterTask.cardId ?? ''),
                },
              });
              const verified = verifyProjectSyncPhase({
                projectRoot: project.root,
                role,
                requiredSha: String(body.requiredSha ?? '') || undefined,
                result: codex.result,
              });
              return { ...codex, snapshot: verified, executorNodeId: localNodeId };
            },
          });
          response.end(JSON.stringify({ ok: true, ...executed.result }));
        } finally {
          federatedSchedulerContexts.delete(executionId);
        }
      } catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project synchronization role failed.' }));
      }
      return;
    }
    if (url === '/api/project-sync/lock-release' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      response.setHeader('content-type', 'application/json');
      activeProjectSyncController();
      try {
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        if (!String(request.headers['x-decision-os-federation-node'] ?? '')) throw new Error('Federation participant authentication failed.');
        projectSyncStore.releaseLock(String(body.originFingerprint ?? ''), String(body.syncId ?? ''));
        response.end(JSON.stringify({ ok: true }));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ ok: false, error: 'Invalid project synchronization lock release.' }));
      }
      return;
    }
    if (url === '/api/project-sync' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      response.setHeader('content-type', 'application/json');
      const syncController = activeProjectSyncController();
      try {
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        const sourceId = String(body.sourceProjectId ?? '');
        const sourceNodeId = String(body.sourceNodeId ?? '');
        const localOwner = federation.localOwner();
        const allProjects = [
          ...projects.map((project) => {
            let originFingerprint = '';
            try { originFingerprint = readRepositoryOriginIdentity(project.root).originFingerprint; } catch { /* surfaced by admission below */ }
            return { ...project, ...localOwner, remote: false, localProjectId: project.id, originFingerprint };
          }),
          ...federation.remoteProjects(),
        ];
        const source = allProjects.find((entry) => String(entry.localProjectId ?? entry.id) === sourceId
          && (!sourceNodeId || String(entry.ownerNodeId) === sourceNodeId));
        if (!source) throw new Error('Unknown source project.');
        const admitted = syncController.start(source, String(body.idempotencyKey ?? request.headers['idempotency-key'] ?? sourceId));
        response.statusCode = admitted.duplicate ? 200 : 202;
        response.end(JSON.stringify({
          ok: true,
          duplicate: admitted.duplicate,
          masterCardId: admitted.run.masterCardId,
          ledgerId: admitted.run.ledgerId,
          pipelineRunId: admitted.run.pipelineRunId,
          projectId: admitted.run.taskProjectId || admitted.run.sourceProjectId,
          run: admitted.run,
        }));
      } catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project synchronization admission failed.' }));
      }
      return;
    }
    if (url === '/api/project-sync' && request.method === 'GET') {
      activeProjectSyncController();
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, runs: projectSyncStore.list() }));
      return;
    }
    if (url.startsWith('/api/project-sync/') && url.endsWith('/retry') && request.method === 'POST') {
      const syncId = decodeRouteSegment(url.slice('/api/project-sync/'.length, -'/retry'.length));
      response.setHeader('content-type', 'application/json');
      const syncController = activeProjectSyncController();
      try {
        const run = syncController.retry(syncId);
        response.statusCode = 202;
        response.end(JSON.stringify({ ok: true, run }));
      } catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project synchronization retry failed.' }));
      }
      return;
    }
    if (url.startsWith('/api/project-sync/') && url !== '/api/project-sync/role' && url !== '/api/project-sync/repository-status' && request.method === 'GET') {
      activeProjectSyncController();
      const syncId = decodeRouteSegment(url.slice('/api/project-sync/'.length));
      const run = projectSyncStore.read(syncId);
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.statusCode = run ? 200 : 404;
      response.end(JSON.stringify(run ? { ok: true, run } : { ok: false, error: 'Unknown project synchronization run.' }));
      return;
    }
    if (url === '/decision-os/directories' && request.method === 'GET') {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      try {
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
        const listing = listProjectDirectories({ masterRoot, path: requestUrl.searchParams.get('path') ?? '.' });
        response.end(JSON.stringify({ ok: true, listing }));
      } catch (error) {
        response.statusCode = 400;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Directory listing failed.' }));
      }
      return;
    }
    if (url === '/decision-os/projects' && request.method === 'GET') {
      const localOwner = federation.localOwner();
      const localProjects = projects.map((project) => {
        let originFingerprint = '';
        try { originFingerprint = readRepositoryOriginIdentity(project.root).originFingerprint; } catch { /* Non-Git projects remain visible. */ }
        return { ...project, originFingerprint };
      });
      const remoteProjects = federation.remoteProjects().map((project) => {
        const store = taskStoreForProject(project.localProjectId, project.ownerNodeId);
        const replicated = Boolean(store && store.diagnostics().entityCount > 0);
        const replica = { status: replicated ? 'replicated' : project.online ? 'synchronizing' : 'offline', updatedAt: '', message: replicated ? '' : project.online ? 'Synchronizing current task state.' : 'Owner offline.', resource: '' };
        return { ...project, available: project.online || replicated, replica };
      });
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ projects: federatedProjectCatalog({
        localProjects,
        remoteProjects,
        localNode: { nodeId: localOwner.ownerNodeId, nodeLabel: localOwner.ownerNodeLabel },
      }) }));
      return;
    }
    if (url === '/decision-os/projects-canvas' && request.method === 'GET') {
      const canvas = ensureProjectsCanvasDocument({ masterDecisionOsRoot, projects });
      const summaries = new Map(projects.map((project) => [project.id, {
        ledgerCount: project.ledgers.length,
        available: project.available,
        diagnostic: project.diagnostic,
      }]));
      const document = {
        ...canvas.document,
        cards: (canvas.document.cards as AnyRecord[]).map((card) => ({
          ...card,
          projectSummary: summaries.get(String(card.targetProjectId ?? '')) ?? null,
        })),
      };
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(document));
      return;
    }
    if (url === '/decision-os/projects-canvas' && request.method === 'PATCH') {
      const bodyBuffer = await readRequestBuffer(request);
      try {
        const mutation = JSON.parse(bodyBuffer.toString('utf8') || '{}') as LedgerMutation;
        const canvas = ensureProjectsCanvasDocument({ masterDecisionOsRoot, projects });
        if (mutation.action === 'delete-card' && mutation.cardId) {
          const card = (canvas.document.cards as AnyRecord[]).find((entry) => String(entry.id ?? '') === mutation.cardId);
          const projectId = String(card?.targetProjectId ?? '');
          if (!projectId) throw new Error('Project card is not registered.');
          projectCatalogStore.unregister(projectId);
          reconcileProjectRuntimes();
          controlRoomProjectionStore?.invalidate(projectId);
          const updated = ensureProjectsCanvasDocument({ masterDecisionOsRoot, projects: projectCatalog() });
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(updated.document));
          return;
        }
        if (mutation.action !== 'patch-geometry' && mutation.action !== 'patch-viewport') {
          throw new Error('Projects canvas accepts geometry, viewport, and unregister mutations only.');
        }
        const result = applyLedgerMutation({
          decisionOsRoot: masterDecisionOsRoot,
          ledgerPath: canvas.path,
          ledger: canvas.document,
          mutation,
        });
        if (!result.ok) throw new Error(String(result.error?.body?.error ?? 'Projects canvas mutation failed.'));
        writeFileSync(canvas.path, JSON.stringify(result.ledger, null, 2));
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(result.ledger));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Projects canvas mutation failed.' }));
      }
      return;
    }
    if (url === '/decision-os/projects' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      try {
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        const project = typeof body.directory === 'string'
          ? projectCatalogStore.create(String(body.name ?? ''), String(body.description ?? ''), body.directory)
          : typeof body.path === 'string'
            ? projectCatalogStore.register(body.path)
            : projectCatalogStore.create(String(body.name ?? ''), String(body.description ?? ''));
        federation.publishManifest();
        controlRoomProjectionStore?.invalidate();
        reconcileProjectRuntimes();
        response.statusCode = 201;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, project }));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project creation failed.' }));
      }
      return;
    }
    if (url.startsWith('/decision-os/projects/') && request.method === 'PATCH') {
      const projectId = decodeRouteSegment(url.slice('/decision-os/projects/'.length));
      const bodyBuffer = await readRequestBuffer(request);
      try {
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        const project = typeof body.relativePath === 'string'
          ? projectCatalogStore.relink(projectId, body.relativePath)
          : projectCatalogStore.update(
            projectId,
            String(body.name ?? ''),
            String(body.description ?? ''),
            String(body.color ?? ''),
          );
        reconcileProjectRuntimes();
        controlRoomProjectionStore?.invalidate(projectId);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, project }));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project update failed.' }));
      }
      return;
    }
    if (url.startsWith('/decision-os/projects/') && request.method === 'DELETE') {
      const projectId = decodeRouteSegment(url.slice('/decision-os/projects/'.length));
      try {
        const project = projectCatalogStore.unregister(projectId);
        reconcileProjectRuntimes();
        controlRoomProjectionStore?.invalidate(projectId);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, project, filesDeleted: false }));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project unregister failed.' }));
      }
      return;
    }
    if (!projectScope && isProjectSensitiveEndpoint(url) && !isGlobalProjectEndpoint(url)) {
      if (projects.length !== 1) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'Project id is required in the URL.' }));
        return;
      }
    }
    if (tryServeDecisionOsAsset({ url, decisionOsRoot, response })) return;
    if (url === '/api/server/restart' && request.method === 'POST') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, restarting: true }));
      setTimeout(() => {
        const restartServer = runtime.restartServer;
        if (typeof restartServer === 'function') restartServer();
        else process.exit(0);
      }, 25);
      return;
    }
    if (url === '/api/debug/codex-continue' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const debugPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return { parseError: true, rawLength: bodyBuffer.length };
        }
      })();
      console.log(JSON.stringify({ codexContinueDebug: true, source: 'frontend', receivedAt: new Date().toISOString(), ...debugPayload }));
      response.setHeader('content-type', 'application/json');
      response.statusCode = 204;
      response.end();
      return;
    }
    if (url === '/api/control-room-events' && request.method === 'GET') {
      response.writeHead(200, { 'cache-control': 'no-store', connection: 'keep-alive', 'content-type': 'text/event-stream' });
      response.write(': connected\n\n');
      globalContentEventClients.add(response);
      request.on('close', () => globalContentEventClients.delete(response));
      return;
    }
    if (url === '/api/ledger-content-events' && request.method === 'GET') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
      });
      response.write(': connected\n\n');
      contentEventClients.add(response);
      request.on('close', () => contentEventClients.delete(response));
      return;
    }
    if (url === '/api/voice-transcription-status' && request.method === 'GET') {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const result = readVoiceTranscriptionStatusController({
        action_payload: {
          ledgerId: requestUrl.searchParams.get('ledgerId') ?? '',
          threadId: requestUrl.searchParams.get('threadId') ?? '',
          noteId: requestUrl.searchParams.get('noteId') ?? ''
        },
        runtime_state: requestRuntime
      });
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if ((url === '/api/codex/pipelines' || url === '/api/codex/server-pipelines') && request.method === 'GET') {
      const result = listCodexPipelinesController({
        runtime_state: url === '/api/codex/server-pipelines'
          ? { ...requestRuntime, decisionOsRoot: masterDecisionOsRoot, projectId: '' }
          : requestRuntime,
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if ((url === '/api/codex/pipelines' || url === '/api/codex/server-pipelines') && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const savePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = saveCodexPipelineController({ action_payload: { ...savePayload, operation: 'create', ...(url === '/api/codex/server-pipelines' ? { scope: 'server' } : {}) }, runtime_state: requestRuntime });
      if (result.ok === true) federation.publishManifest();
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 201));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/codex/pipelines/runs' && request.method === 'POST') {
      assertCodexRuntimeAvailable(requestRuntime);
      const bodyBuffer = await readRequestBuffer(request);
      const runPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = await startCodexPipelineRunController({
        action_payload: { ...runPayload, onLedgerChange: publishLedgerContentChange },
        runtime_state: requestRuntime,
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/pipelines/runs/') && url.endsWith('/cancel') && request.method === 'POST') {
      const runId = decodeRouteSegment(url.slice('/api/codex/pipelines/runs/'.length, -'/cancel'.length));
      const bodyBuffer = await readRequestBuffer(request);
      const cancelPayload = (() => {
        try { return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord; }
        catch { return {}; }
      })();
      const result = await cancelCodexPipelineRunController({ action_payload: { runId, executionId: cancelPayload.executionId }, runtime_state: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/pipelines/runs/') && url.endsWith('/restart') && request.method === 'POST') {
      assertCodexRuntimeAvailable(requestRuntime);
      const runId = decodeRouteSegment(url.slice('/api/codex/pipelines/runs/'.length, -'/restart'.length));
      const result = await restartCodexPipelineRunController({ action_payload: { runId }, runtime_state: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/pipelines/runs/') && url.endsWith('/status') && request.method === 'GET') {
      const runId = decodeRouteSegment(url.slice('/api/codex/pipelines/runs/'.length, -'/status'.length));
      const result = readCompactPipelineRunStatusController({ runId, runtime: requestRuntime });
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/pipelines/runs/') && request.method === 'GET') {
      const runId = decodeRouteSegment(url.slice('/api/codex/pipelines/runs/'.length));
      const result = await readCodexPipelineRunController({ action_payload: { runId }, runtime_state: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/pipelines/') && request.method === 'PUT') {
      const pipelineId = decodeRouteSegment(url.slice('/api/codex/pipelines/'.length));
      const bodyBuffer = await readRequestBuffer(request);
      const savePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = saveCodexPipelineController({ action_payload: { ...savePayload, pipelineId, operation: 'update' }, runtime_state: requestRuntime });
      if (result.ok === true) federation.publishManifest();
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/server-pipelines/') && request.method === 'PUT') {
      const pipelineId = decodeRouteSegment(url.slice('/api/codex/server-pipelines/'.length));
      const bodyBuffer = await readRequestBuffer(request);
      const savePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = saveCodexPipelineController({ action_payload: { ...savePayload, pipelineId, operation: 'update', scope: 'server' }, runtime_state: requestRuntime });
      if (result.ok === true) federation.publishManifest();
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/server-skills/') && request.method === 'GET') {
      const skillName = decodeRouteSegment(url.slice('/api/codex/server-skills/'.length));
      const skillRuntime = { ...requestRuntime, decisionOsRoot: masterDecisionOsRoot, projectId: '' };
      const result = readCodexSkillLibraryController({ action_payload: { skillName }, runtime_state: skillRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/server-skills/') && request.method === 'PUT') {
      const skillName = decodeRouteSegment(url.slice('/api/codex/server-skills/'.length));
      const bodyBuffer = await readRequestBuffer(request);
      const savePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const metadataOnly = Object.keys(savePayload).length > 0
        && Object.keys(savePayload).every((key) => key === 'favorite' || key === 'tags');
      const skillRuntime = { ...requestRuntime, decisionOsRoot: masterDecisionOsRoot, projectId: '' };
      const result = metadataOnly
        ? saveCodexSkillLibraryController({ action_payload: { ...savePayload, skillName }, runtime_state: skillRuntime })
        : { ok: false, statusCode: 400, error: 'Server skill updates accept only favorite and tags.', skillName };
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skill-library/') && request.method === 'GET') {
      const skillName = decodeRouteSegment(url.slice('/api/codex/skill-library/'.length));
      const result = applyOwnedSkillDetail(readCodexSkillLibraryController({ action_payload: { skillName }, runtime_state: requestRuntime }));
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skill-library/') && request.method === 'PUT') {
      const skillName = decodeRouteSegment(url.slice('/api/codex/skill-library/'.length));
      const bodyBuffer = await readRequestBuffer(request);
      const savePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const metadataOnly = Object.keys(savePayload).length > 0
        && Object.keys(savePayload).every((key) => key === 'favorite' || key === 'tags');
      const saveRuntime = metadataOnly
        ? { ...requestRuntime, decisionOsRoot: masterDecisionOsRoot, projectId: '' }
        : requestRuntime;
      const result = applyOwnedSkillDetail(saveCodexSkillLibraryController({ action_payload: { ...savePayload, skillName }, runtime_state: saveRuntime }));
      if (result.ok === true && Object.prototype.hasOwnProperty.call(savePayload, 'markdown')) federation.publishManifest();
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if ((url === '/api/codex/skills' || url === '/api/codex/server-skills') && request.method === 'GET') {
      const skillRuntime = url === '/api/codex/server-skills'
        ? { ...requestRuntime, decisionOsRoot: masterDecisionOsRoot, projectId: '' }
        : requestRuntime;
      const catalog = readCodexSkillCatalog({ decisionOsRoot: String(skillRuntime.decisionOsRoot), runtime: skillRuntime }).skills;
      const metadata = url === '/api/codex/server-skills' ? null : ownedSkillMetadata();
      const skills = metadata ? catalog.map((skill) => applyCodexSkillMetadataOwner(skill, metadata)) : catalog;
      response.setHeader('content-type', 'application/json');
      response.statusCode = 200;
      response.end(JSON.stringify({ ok: true, skills, availableTags: codexSkillTags }));
      return;
    }
    if (url === '/api/codex/skills/process' && request.method === 'POST') {
      assertCodexRuntimeAvailable(requestRuntime);
      const bodyBuffer = await readRequestBuffer(request);
      const processPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = await startCardSkillProcessController({
        action_payload: { ...processPayload, onLedgerChange: publishLedgerContentChange },
        runtime_state: requestRuntime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/codex/threads/process' && request.method === 'POST') {
      assertCodexRuntimeAvailable(requestRuntime);
      const bodyBuffer = await readRequestBuffer(request);
      const processPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = await startThreadCodexProcessController({
        action_payload: { ...processPayload, onLedgerChange: publishLedgerContentChange },
        runtime_state: requestRuntime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/status') && request.method === 'GET') {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const runId = decodeRouteSegment(url.slice('/api/codex/skills/runs/'.length, -'/status'.length));
      const result = readCompactSkillRunStatusController({
        runId,
        ledgerId: requestUrl.searchParams.get('ledgerId') ?? '',
        cardId: requestUrl.searchParams.get('cardId') ?? '',
        runtime: requestRuntime,
      });
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skills/runs/') && request.method === 'GET') {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length));
      const traceId = requestUrl.searchParams.get('traceId') ?? '';
      if (traceId) logCodexContinueDebug('status-route-entry', {
        traceId,
        runId,
        ledgerId: requestUrl.searchParams.get('ledgerId') ?? '',
        cardId: requestUrl.searchParams.get('cardId') ?? '',
        since: requestUrl.searchParams.get('since') ?? '0'
      });
      const ledgerId = requestUrl.searchParams.get('ledgerId') ?? '';
      const cardId = requestUrl.searchParams.get('cardId') ?? '';
      const since = requestUrl.searchParams.get('since') ?? '0';
      const replicatedExecution = taskExecutionState(requestRuntime)?.executions.bySessionId(runId)
        .filter((record) => record.metadata.ledgerId === ledgerId && (
          record.metadata.sourceCardId === cardId || record.metadata.ownerCardId === cardId
        ))
        .sort((left, right) => (
          right.metadata.requestedAt.localeCompare(left.metadata.requestedAt)
          || right.metadata.executionId.localeCompare(left.metadata.executionId)
        ))[0] ?? null;
      let statusRuntime = requestRuntime;
      if (replicatedExecution && replicatedExecution.lifecycle.executorNodeId !== federation.localOwner().ownerNodeId) {
        const terminal = ['succeeded', 'failed', 'cancelled', 'interrupted'].includes(replicatedExecution.lifecycle.phase);
        if (!terminal) {
          const remote = await federation.request(
            replicatedExecution.lifecycle.executorNodeId,
            `/api/internal/task-executions/${encodeURIComponent(replicatedExecution.metadata.executionId)}/status?projectId=${encodeURIComponent(replicatedExecution.metadata.projectId)}&since=${encodeURIComponent(since)}`,
          );
          response.setHeader('content-type', 'application/json');
          response.statusCode = remote.status;
          response.end(remote.body);
          return;
        }
        const heads = [
          replicatedExecution.artifacts.jsonl,
          replicatedExecution.artifacts.stderr,
          replicatedExecution.artifacts.telemetry,
          replicatedExecution.artifacts.result,
        ].filter((head) => head !== null);
        await Promise.all(heads.map((head) => federation.requestToFile(
          replicatedExecution.lifecycle.executorNodeId,
          `/api/federation/content-object?projectId=${encodeURIComponent(replicatedExecution.metadata.projectId)}&hash=${encodeURIComponent(head.hash)}`,
          federationContentStore.objectFile(head.hash),
          head.hash,
        )));
        statusRuntime = Object.create(requestRuntime) as AnyRecord;
        Object.defineProperty(statusRuntime, 'taskExecutionArtifactFile', {
          value: (hash: string) => /^[a-f0-9]{64}$/i.test(hash) ? federationContentStore.objectFile(hash) : '',
          configurable: true,
          enumerable: false,
        });
      }
      const result = await readCardSkillRunController({
        action_payload: {
          runId,
          ledgerId,
          cardId,
          since,
          traceId
        },
        runtime_state: statusRuntime
      });
      if (traceId) logCodexContinueDebug('status-route-response', {
        traceId,
        runId,
        statusCode: Number(result.statusCode ?? (result.ok === false ? 400 : 200)),
        ok: result.ok,
        status: result.status,
        lineCount: result.lineCount,
        nextSince: result.nextSince,
        persistedEventCount: result.persistedEventCount,
        latestEventType: result.latestEvent && typeof result.latestEvent === 'object' ? String((result.latestEvent as AnyRecord).type ?? '') : '',
        latestEventLine: result.latestEvent && typeof result.latestEvent === 'object' ? String((result.latestEvent as AnyRecord).line ?? '') : '',
        error: result.error
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/continue') && request.method === 'POST') {
      assertCodexRuntimeAvailable(requestRuntime);
      const bodyBuffer = await readRequestBuffer(request);
      const continuePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length, -'/continue'.length));
      const traceId = String(continuePayload.traceId ?? '');
      logCodexContinueDebug('continue-route-entry', {
        traceId,
        runId,
        ledgerId: continuePayload.ledgerId,
        cardId: continuePayload.cardId
      });
      const result = await continueCardSkillRunController({
        action_payload: { ...continuePayload, runId, onLedgerChange: publishLedgerContentChange },
        runtime_state: requestRuntime
      });
      logCodexContinueDebug('continue-route-response', {
        traceId,
        runId,
        statusCode: Number(result.statusCode ?? (result.ok === false ? 400 : 202)),
        ok: result.ok,
        status: result.status,
        error: result.error,
        pid: result.run && typeof result.run === 'object' ? (result.run as AnyRecord).pid : undefined,
        continuedMessageCount: result.run && typeof result.run === 'object' ? (result.run as AnyRecord).continuedMessageCount : undefined
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/cancel') && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const cancelPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length, -'/cancel'.length));
      const result = await cancelCardSkillRunController({
        action_payload: { ...cancelPayload, runId },
        runtime_state: requestRuntime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skills/runs/') && request.method === 'DELETE') {
      const bodyBuffer = await readRequestBuffer(request);
      const deletePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length));
      const result = await deleteThreadCodexSessionController({
        action_payload: { ...deletePayload, runId, onLedgerChange: publishLedgerContentChange },
        runtime_state: requestRuntime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/transcribe' && request.method === 'POST') {
      const audioBuffer = await readRequestBuffer(request);
      await transcribeVoiceController({
        action_payload: {
          method: request.method,
          url,
          response,
          audioBuffer,
          mimeType: request.headers['content-type'] ?? 'audio/webm',
          threadId: request.headers['x-thread-id'] ?? ''
        },
        runtime_state: requestRuntime
      });
      return;
    }
    if (url === '/api/voice-upload' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const contentType = String(request.headers['content-type'] ?? '');
      const form = contentType.includes('multipart/form-data') ? parseMultipartFormData(bodyBuffer, contentType) : { fields: {}, files: {} };
      const audio = form.files.audio ?? Object.values(form.files)[0];
      const fields = form.fields as AnyRecord;
      const result = await startVoiceUploadOrchestrationController({
        action_payload: {
          ...fields,
          voicePipelineId: String((readDecisionOsSettings({ action_payload: { decisionOsRoot: masterDecisionOsRoot }, runtime_state: runtime }).settings as AnyRecord).voicePipelineId ?? ''),
          audioBuffer: audio?.buffer ?? bodyBuffer,
          mimeType: audio?.mimeType ?? (contentType || 'audio/webm'),
          onCardContentChange: publishCardContentChange,
          onLedgerChange: publishLedgerContentChange,
        },
        runtime_state: requestRuntime
      });
      const ledgerId = String(fields.ledgerId ?? '');
      const cardId = String(fields.cardId ?? '');
      const threadId = String(fields.threadId ?? (cardId ? `thread-${cardId}` : ''));
      if (result.ok !== false && result.uploaded && ledgerId === 'tasks' && localProject && cardId) {
        const projection = taskStateForProject(localProject).projection().ledger;
        const refs = projection.threadFiles && typeof projection.threadFiles === 'object' ? projection.threadFiles as AnyRecord : {};
        const delta = await taskStateForProject(localProject).recordContentContribution(cardId, String(refs[threadId] ?? ''));
        controlRoomProjectionStore?.invalidate(localProject.id, delta.entities);
      }
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify({ body: result }));
      return;
    }
    if (url === '/api/git-review/voice' && request.method === 'POST' && activeProject) {
      const bodyBuffer = await readRequestBuffer(request);
      const contentType = String(request.headers['content-type'] ?? '');
      const form = contentType.includes('multipart/form-data') ? parseMultipartFormData(bodyBuffer, contentType) : { fields: {}, files: {} };
      const audio = form.files.audio ?? Object.values(form.files)[0];
      const result = await transcribeGitReviewVoiceController({
        action_payload: {
          ...form.fields,
          audioBuffer: audio?.buffer ?? bodyBuffer,
          mimeType: audio?.mimeType ?? (contentType || 'audio/webm'),
        },
        runtime_state: requestRuntime,
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/thread-image-upload' && request.method === 'POST') {
      const imageBuffer = await readRequestBuffer(request);
      const mimeType = request.headers['content-type'] ?? 'image/png';
      const contentType = String(mimeType).toLowerCase().split(';')[0].trim();
      response.setHeader('content-type', 'application/json');
      if (!contentType.startsWith('image/') || imageBuffer.length === 0) {
        response.statusCode = 400;
        response.end(JSON.stringify({ ok: false, error: 'Expected a non-empty image upload.' }));
        return;
      }
      const threadId = safeAssetSegment(request.headers['x-thread-id'] ?? 'conversation-ledger');
      const ledgerId = String(request.headers['x-ledger-id'] ?? '');
      const cardId = threadId.startsWith('thread-') ? threadId.slice('thread-'.length) : '';
      const extension = imageExtensionForMimeType(mimeType);
      const directory = resolve(decisionOsRoot, 'thread-images', threadId);
      mkdirSync(directory, { recursive: true });
      const fileName = `paste-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
      const filePath = resolve(directory, fileName);
      const imageFileRef = `/.decision-os/thread-images/${threadId}/${fileName}`;
      const originalTemporary = `${filePath}.upload-${process.pid}`;
      let previewFile = '';
      let previewFileRef = '';
      try {
        writeFileSync(originalTemporary, imageBuffer);
        renameSync(originalTemporary, filePath);
        if (ledgerId === 'tasks' && localProject && cardId) {
          const previewName = `${fileName.slice(0, -extension.length)}.canvas-preview-v1.webp`;
          previewFile = resolve(directory, previewName);
          previewFileRef = `/.decision-os/thread-images/${threadId}/${previewName}`;
          const preview = await sharp(imageBuffer, { failOn: 'error' })
            .rotate()
            .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 78, alphaQuality: 90, effort: 6, smartSubsample: true })
            .toBuffer();
          const previewTemporary = `${previewFile}.upload-${process.pid}`;
          writeFileSync(previewTemporary, preview);
          renameSync(previewTemporary, previewFile);
          const delta = await taskStateForProject(localProject).recordContentContribution(cardId, [imageFileRef, previewFileRef]);
          controlRoomProjectionStore?.invalidate(localProject.id, delta.entities);
        }
      } catch (error) {
        rmSync(originalTemporary, { force: true });
        rmSync(filePath, { force: true });
        if (previewFile) rmSync(previewFile, { force: true });
        response.statusCode = 422;
        response.end(JSON.stringify({
          ok: false,
          error: 'Image upload could not be installed transactionally.',
          detail: error instanceof Error ? error.message : String(error),
        }));
        return;
      }
      response.statusCode = 201;
      response.end(JSON.stringify({
        ok: true,
        imageFileRef,
        previewFileRef,
        previewProfile: previewFileRef ? 'canvas-preview-v1' : '',
        markdown: `![Pasted image](${imageFileRef})`,
      }));
      return;
    }
    if (url === '/api/thread-file-upload' && request.method === 'POST') {
      const fileBuffer = await readRequestBuffer(request);
      const contentType = String(request.headers['content-type'] ?? 'application/octet-stream').toLowerCase().split(';')[0].trim() || 'application/octet-stream';
      const originalName = uploadOriginalFileName(request.headers['x-file-name']);
      response.setHeader('content-type', 'application/json');
      if (fileBuffer.length === 0) {
        response.statusCode = 400;
        response.end(JSON.stringify({ ok: false, error: 'Expected a non-empty file upload.' }));
        return;
      }
      const threadId = safeAssetSegment(request.headers['x-thread-id'] ?? 'conversation-ledger');
      const directory = resolve(decisionOsRoot, 'thread-files', threadId);
      mkdirSync(directory, { recursive: true });
      const fileName = `file-${Date.now()}-${Math.random().toString(16).slice(2)}-${safeAssetSegment(originalName)}`;
      const filePath = resolve(directory, fileName);
      writeFileSync(filePath, fileBuffer);
      const fileRef = `/.decision-os/thread-files/${threadId}/${fileName}`;
      response.statusCode = 201;
      response.end(JSON.stringify({
        ok: true,
        fileRef,
        originalName,
        contentType,
        markdown: markdownForThreadFile({ fileRef, originalName, contentType })
      }));
      return;
    }
    if (url === '/api/transcribe/retry' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const retryPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = await startVoiceRetryOrchestrationController({
        action_payload: {
          ...retryPayload,
          voicePipelineId: String((readDecisionOsSettings({ action_payload: { decisionOsRoot: masterDecisionOsRoot }, runtime_state: runtime }).settings as AnyRecord).voicePipelineId ?? ''),
          threadId: request.headers['x-thread-id'] ?? retryPayload.threadId ?? '',
          onCardContentChange: publishCardContentChange,
          onLedgerChange: publishLedgerContentChange
        },
        runtime_state: requestRuntime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify({ body: result }));
      return;
    }
    if (url === '/decision-os/ledgers' && request.method === 'POST') {
      response.setHeader('content-type', 'application/json');
      const bodyBuffer = await readRequestBuffer(request);
      const createPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const title = String(createPayload.title || 'New Ledger').trim() || 'New Ledger';
      const created = createLinkedLedger({ decisionOsRoot, title });
      response.statusCode = 201;
      response.end(JSON.stringify(created));
      return;
    }
    if (url.startsWith('/decision-os/')) {
      const tabId = url.split('/').filter(Boolean)[1] ?? 'state';
      const stateRead = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json'), writeBack: true } });
      const tab = tabId === 'state' ? undefined : stateRead.ledgers.find((entry) => entry.id === tabId);
      const isLedgersCanvas = tabId === 'ledgers-canvas';
      const ledgerFile = tabId === 'state'
        ? 'state.json'
        : isLedgersCanvas
          ? 'ledgers-canvas.json'
          : String(tab?.ledgerFile ?? '').replace(/^\.decision-os\//, '');
      const ledgerPath = resolve(decisionOsRoot, ledgerFile);
      response.setHeader('content-type', 'application/json');
      if (!ledgerFile) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, missing: tabId }));
        return;
      }
      if (isLedgersCanvas) ensureLedgersCanvasDocument({ decisionOsRoot });
      if (tabId !== 'state' && request.method !== 'GET' && existsSync(ledgerPath)) {
        const bodyBuffer = await readRequestBuffer(request);
        const mutation = bodyBuffer.length > 0 ? JSON.parse(bodyBuffer.toString('utf8')) as LedgerMutation : {};
        const ledger = (tabId === 'tasks' && localProject
          ? structuredClone(taskStateForProject(localProject).projection().ledger)
          : JSON.parse(readFileSync(ledgerPath, 'utf8'))) as AnyRecord & {
          cards?: Array<Record<string, unknown>>;
          annotations?: Array<Record<string, unknown>>;
          relationships?: Array<Record<string, unknown>>;
          notes?: Record<string, Array<Record<string, unknown>>>;
          deletedNoteIds?: Record<string, string[]>;
          threadFiles?: Record<string, string>;
        };
        // The hidden overview routes linked-card lifecycle before generic ledger mutations.
        if (isLedgersCanvas && mutation.action === 'create-card' && mutation.card?.id) {
          const created = createLinkedLedger({
            decisionOsRoot,
            title: String(mutation.card.title ?? 'New Ledger'),
            rect: {
              x: Number(mutation.card.x ?? 0),
              y: Number(mutation.card.y ?? 0),
              width: Number(mutation.card.w ?? mutation.card.width ?? 360),
              height: Number(mutation.card.h ?? mutation.card.height ?? 180)
            }
          });
          const overview = ensureLedgersCanvasDocument({ decisionOsRoot });
          response.setHeader(ledgerRevisionHeader, String(ledgerRevisions.advance(tabId)));
          response.end(JSON.stringify(hydrateLedgerCardContent(overview.document, decisionOsRoot)));
          return;
        }
        if (isLedgersCanvas && mutation.action === 'patch-card' && mutation.cardPatch?.id && typeof mutation.cardPatch.title === 'string') {
          const rename = renameLinkedLedger({ decisionOsRoot, cardId: mutation.cardPatch.id, title: mutation.cardPatch.title, overviewDocument: ledger });
          if (rename.ok === false) {
            response.statusCode = 404;
            response.end(JSON.stringify({ ok: false, error: rename.error }));
            return;
          }
          await persistLedgerAndRespond(tabId, ledgerPath, ledger, response, decisionOsRoot);
          return;
        }
        if (isLedgersCanvas && mutation.action === 'delete-card' && mutation.cardId) {
          const deletion = deleteLinkedLedger({ decisionOsRoot, cardId: String(mutation.cardId), overviewDocument: ledger });
          if (deletion.ok === false) {
            response.statusCode = 404;
            response.end(JSON.stringify({ ok: false, error: deletion.error }));
            return;
          }
          await persistLedgerAndRespond(tabId, ledgerPath, ledger, response, decisionOsRoot);
          return;
        }
        const beforeLedger = structuredClone(ledger);
        if (mutation.action === 'transition-card-lifecycle' && mutation.lifecycleStatus === 'backlog' && mutation.cardId) {
          const taskId = String(mutation.cardId);
          const activeExecution = taskExecutionState(requestRuntime)?.executions.byTaskId(taskId)
            .find((execution) => ['preparing', 'queued', 'starting', 'running', 'cancelling'].includes(execution.lifecycle.phase));
          if (activeExecution) {
            response.statusCode = 409;
            response.end(JSON.stringify({ ok: false, error: 'A queued or running task cannot move to backlog.', phase: activeExecution.lifecycle.phase }));
            return;
          }
        }
        if (tabId === 'tasks' && localProject) {
          // WHAT: Apply the same verified materialization gate to operator-facing task mutations.
          // WHY: Browser messages, card edits, image removal, and voice-driven updates must share one no-empty-default boundary.
          try {
            await materializeTaskMutationInputs({
              projectId: localProject.id,
              decisionOsRoot,
              ledger: beforeLedger,
              mutation,
              store: taskStateForProject(localProject).store,
              contentStore: federationContentStore,
              drain: federationContentScheduler?.drain ?? null,
            });
          } catch (error) {
            if (!(error instanceof TaskContentMaterializationError)) throw error;
            response.statusCode = error.statusCode;
            response.end(JSON.stringify({ ok: false, error: error.code, contentFile: error.key }));
            return;
          }
        }
        const mutationResult = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation });
        if (mutationResult.error) {
          response.statusCode = mutationResult.error.statusCode;
          response.end(JSON.stringify(mutationResult.error.body));
          return;
        }
        await persistLedgerMutationAndRespond(tabId, ledgerPath, beforeLedger, ledger, mutation, response);
        return;
      }
      if (existsSync(ledgerPath)) {
        const ledger = isLedgersCanvas
          ? ensureLedgersCanvasDocument({ decisionOsRoot }).document
          : tabId === 'tasks' && localProject
            ? structuredClone(taskStateForProject(localProject).projection().ledger)
            : JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord;
        // WHAT: Expose reconciliation revisions only for ledger documents.
        // WHY: The project-state response is not an active canvas ledger.
        if (tabId !== 'state') response.setHeader(ledgerRevisionHeader, String(ledgerRevisions.current(tabId)));
        response.end(JSON.stringify(tabId === 'state'
          ? { projectId: activeProject?.id ?? '', projectName: projectNameForDecisionOsRoot(decisionOsRoot), projectColor: activeProject?.color ?? '#38d9e8', ledgers: stateRead.ledgers }
          : hydrateLedgerCardContent(ledger, decisionOsRoot)));
      } else {
        response.end(JSON.stringify({ ok: false, missing: ledgerPath }));
      }
      return;
    }
    const isFrontendModuleRoute = url.startsWith('/assets/') || url.startsWith('/src/');
    // WHAT: Serve `/shared/*` imports from the source tree beside the configured frontend root.
    // WHY: Browser modules consume authoritative shared schemas whose `.js` URLs must resolve to sibling `.ts` sources.
    const isSharedModuleRoute = url.startsWith('/shared/');
    const isStaticModuleRoute = isFrontendModuleRoute || isSharedModuleRoute;
    const routeTabId = url.split('/').filter(Boolean)[0] ?? '';
    if (!projectScope && request.method === 'GET' && routeTabId && !['projects', 'projects-canvas', 'ledgers', 'pipelines', 'skills', 'settings', 'control-room', 'done'].includes(routeTabId)) {
      const matches = projects.filter((project) => project.ledgers.some((ledger) => ledger.id === routeTabId));
      if (matches.length === 1) {
        const fallbackProject = matches[0];
        const routeParts = requestPath.split('/').filter(Boolean).map(decodeRouteSegment);
        let destination = `/p/${encodeURIComponent(fallbackProject.id)}/ledgers/${encodeURIComponent(routeParts[0])}`;
        if (routeParts[1] === 'zone' && routeParts[2]) destination += `/zones/${encodeURIComponent(routeParts[2])}`;
        if (routeParts[3] === 'card' && routeParts[4]) destination += `/cards/${encodeURIComponent(routeParts[4])}`;
        response.statusCode = 302;
        response.setHeader('location', destination);
        response.end();
        return;
      }
      if (matches.length > 1) {
        response.statusCode = 409;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'Ambiguous legacy ledger URL. Use a project-scoped URL.', projectIds: matches.map((project) => project.id) }));
        return;
      }
    }
    const isGlobalAppRoute = requestPath === '/'
      || requestPath === '/projects'
      || requestPath === '/projects-canvas'
      || /^\/projects\/[^/]+$/.test(requestPath)
      || requestPath === '/ledgers'
      || requestPath === '/done'
      || requestPath === '/pipelines'
      || requestPath === '/skills'
      || requestPath === '/settings';
    const isScopedAppRoute = Boolean(projectScope && projectScope.scopedPath.startsWith('/ledgers'));
    const isAppRoute = isGlobalAppRoute || isScopedAppRoute;
    const staticModuleRoot = isSharedModuleRoute
      ? resolve(frontendRoot, '..', 'shared')
      : frontendRoot;
    const staticModuleRequest = isSharedModuleRoute
      ? url.slice('/shared/'.length)
      : url.slice(1);
    const requestedPath = isStaticModuleRoute ? resolve(staticModuleRoot, staticModuleRequest) : resolve(frontendRoot, 'index.html');
    const relativeStaticModulePath = relative(staticModuleRoot, requestedPath);
    // WHAT: Accept a static module path only when it remains below its selected source root.
    // WHY: Adding the sibling shared tree must not expose parent files through traversal segments.
    const isSafeStaticModulePath = !isStaticModuleRoute
      || Boolean(relativeStaticModulePath && !relativeStaticModulePath.startsWith('..') && !isAbsolute(relativeStaticModulePath));
    const assetPath = existsSync(requestedPath) ? requestedPath : requestedPath.replace(/\.js$/, '.ts');
    if ((isAppRoute || isStaticModuleRoute) && isSafeStaticModulePath && existsSync(assetPath)) {
      response.setHeader('content-type', contentTypeFor(assetPath));
      response.setHeader('cache-control', 'no-store');
      const source = readFileSync(assetPath, 'utf8');
      response.end(assetPath.endsWith('.ts') ? transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 } }).outputText : source);
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, method: request.method, url }));
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const paused = error instanceof RuntimeScopePausedError;
      const bootstrapIncomplete = isTaskStateBootstrapGate(error);
      const scope = `http-request:${request.method ?? 'UNKNOWN'}:${requestUrl.pathname}`;
      let incidentId = '';
      let incidentCode = 'runtime_error';
      // WHAT: Preserve the incident that already owns an explicitly paused runtime scope.
      // WHY: The response must identify the original failure instead of creating a duplicate incident.
      if (paused) {
        incidentId = error.incidentId;
        incidentCode = error.code;
      }
      // WHAT: Record the bootstrap rejection and resolve it in the same operation.
      // WHY: Relay convergence is retryable and did not corrupt state or pause a runtime component.
      else if (bootstrapIncomplete) {
        incidentId = recordStoppedOperation({
          scope,
          component: 'http-server',
          operation: 'handle-request',
          error,
          context: { method: request.method ?? '', path: requestUrl.pathname },
        });
        incidentCode = 'task_state_bootstrap_incomplete';
      }
      // WHAT: Persist unexpected request failures as active incidents.
      // WHY: Unclassified errors still require operator-visible degraded health and diagnosis.
      else {
        const incident = recordIncident({
          scope,
          component: 'http-server',
          operation: 'handle-request',
          error,
          context: { method: request.method ?? '', path: requestUrl.pathname },
        });
        incidentId = incident.id;
        incidentCode = incident.code;
      }
      telemetry('http-request-failed', {
        method: request.method ?? '',
        path: requestUrl.pathname,
        statusCode: paused || bootstrapIncomplete ? 503 : 500,
        incidentId,
        code: incidentCode,
      });
      if (response.writableEnded) return;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.statusCode = paused || bootstrapIncomplete ? 503 : 500;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        ok: false,
        error: paused ? 'runtime-scope-paused' : bootstrapIncomplete ? 'task-state-bootstrap-incomplete' : 'internal-runtime-error',
        incidentId,
        scope: paused ? error.scope : scope,
      }));
    });
  });
  const codexQueueScanTimer = setInterval(() => {
    if (!pausedBackgroundComponents.has('codex-process-scheduler')) void scheduleGlobalCodexProcesses()
      .catch((error: unknown) => recordBackgroundFailure('codex-process-scheduler', 'periodic-queue-scan', error));
  }, 1_000);
  codexQueueScanTimer.unref?.();
  server.on('close', () => {
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
  });
  server.on('listening', () => {
    const address = server.address();
    if (address && typeof address === 'object') federationServerPort = address.port;
    incidentLedger.resolveScope('server-launcher', 'The server child started and opened its HTTP listener successfully.');
    federation.start();
    void runtimeIncidentReviewScheduler.run();
  });
  server.on('error', (error: Error & { code?: string }) => {
    recordIncident({
      severity: 'fatal',
      scope: 'server-listener',
      component: 'http-server',
      operation: 'listen',
      code: error.code ?? 'server_listen_error',
      error,
      context: { host: String(payload.host ?? '127.0.0.1'), port },
    });
  });
  void Promise.allSettled(startupProjectTasks).then(() => {
    try { server.listen(port, String(payload.host ?? '127.0.0.1')); }
    catch (error) {
      recordIncident({
        severity: 'fatal',
        scope: 'server-listener',
        component: 'http-server',
        operation: 'listen',
        error,
        context: { host: String(payload.host ?? '127.0.0.1'), port },
      });
    }
  });
  runtime.server = server;
  return { ok: true, port, server };
}
