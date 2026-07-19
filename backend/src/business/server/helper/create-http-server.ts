/**
 * WHAT: Creates the Decision OS HTTP server, workspace routes, and scoped content event stream.
 * WHY: Ledger IO, SSE publication, and Codex process callbacks share one server lifecycle for the active workspace.
 */
import { createServer, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { telemetry } from '@backend/telemetry/harness.js';
import { transcribeVoiceController } from '@backend/business/transcription/controller/transcribe-voice-controller.js';
import { continueQueuedVoiceCodexAfterRun, readVoiceTranscriptionStatusController, startVoiceRetryOrchestrationController, startVoiceUploadOrchestrationController } from '@backend/business/transcription/controller/start-voice-upload-orchestration-controller.js';
import { resolveDecisionOsRoot } from './resolve-decision-os-root.js';
import { readDecisionOsSettings } from './read-decision-os-settings.js';
import { normalizedConcurrentCodexProcesses, saveCodexProcessSettings } from './save-codex-process-settings.js';
import { saveFederationSettings } from './save-federation-settings.js';
import { readRequestBuffer } from './read-request-buffer.js';
import { parseMultipartFormData } from './parse-multipart-form-data.js';
import { contentTypeFor } from './content-type-for.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';
import { hydrateLedgerCardContent } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, stripHydratedThreadNotes, writeThreadNotesFile } from '../../ledger/helper/thread-content-file.js';
import { migrateBacklogStatus } from '../../ledger/helper/migrate-backlog-status.js';
import { resolveCardContentChange, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';
import { watchProjectFiles } from '../../refresh/helper/watch-project-files.js';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { commitMasterTaskCompletion } from '../../ledger/helper/commit-master-task-completion.js';
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
import { resumeCodexPipelineRuns } from '../../codex/helper/resume-codex-pipeline-runs.js';
import { recoverCodexProcessQueue } from '../../codex/helper/codex-process-queue.js';
import { nextPendingCodexProcessCreatedAt, pendingCodexProcessEntries, runningCodexProcessCount, scheduleCodexProcesses } from '../../codex/helper/codex-process-scheduler.js';
import { resolveCatalogProject, tasksLedgerForProject, type DecisionOsProject } from './project-catalog.js';
import { createProjectCatalogStore } from './project-catalog-store.js';
import { listProjectDirectories } from './project-directory-browser.js';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint, parseProjectUrlScope } from './project-url-scope.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { controlRoomProjectionFromTaskLedger, createControlRoomProjectionStore } from './control-room-projection-store.js';
import { ledgerCanvasProjection, ledgerCardProjection, ledgerNavigationProjection, ledgerSearchProjection, ledgerThreadProjection } from './ledger-read-models.js';
import { ensureProjectsCanvasDocument } from './ensure-projects-canvas-document.js';
import { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import { buildFederationContentManifest, readManifestResource, type FederationContentManifest } from '../../federation/helper/federation-content-manifest.js';
import { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import { createProjectTaskState, type ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { createTaskEventStore, type TaskEventStore } from '../../task-state/helper/task-event-store.js';
import {
  exportFederatedPipelineSnapshot,
  exportFederatedSkillManifest,
  exportFederatedSkillSnapshot,
  importFederatedPipelineSnapshot,
  importFederatedSkillSnapshot,
  type FederatedPipelineSnapshot,
  type FederatedSkillManifest,
  type FederatedSkillSnapshot,
} from '../../federation/helper/federated-library-cache.js';
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

type AnyRecord = Record<string, unknown>;
type MutationError = { statusCode: number; body: AnyRecord };

const decisionOsAssetPrefix = '/.decision-os/';
const ledgerRevisionHeader = 'x-decision-os-ledger-revision';
const completionCommitHeader = 'x-decision-os-completion-commit';
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
  const projectCatalogStore = createProjectCatalogStore({ masterRoot, masterDecisionOsRoot });
  let controlRoomProjectionStore: ReturnType<typeof createControlRoomProjectionStore> | null = null;
  let federation: ReturnType<typeof createFederationNodeConnector> | null = null;
  let federationTaskStateReplicator: ReturnType<typeof createFederationTaskStateReplicator> | null = null;
  const federationContentStore = createFederationContentReplicaStore({ decisionOsRoot: masterDecisionOsRoot });
  let federationContentScheduler: ReturnType<typeof createFederationContentScheduler> | null = null;
  const projectTaskStates = new Map<string, ProjectTaskState>();
  const federatedTaskStores = new Map<string, TaskEventStore>();
  let projectSyncController: ReturnType<typeof createProjectSyncController> | null = null;

  const taskStateForProject = (project: DecisionOsProject): ProjectTaskState => {
    const current = projectTaskStates.get(project.id);
    if (current) return current;
    const ledger = tasksLedgerForProject(project);
    const value = createProjectTaskState({
      projectId: project.id,
      writerId: federation?.localOwner().ownerNodeId ?? String((runtime.decisionOsSettings as AnyRecord | undefined)?.federationNodeId ?? 'local'),
      decisionOsRoot: project.decisionOsRoot,
      tasksLedgerFile: resolve(project.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, '')),
      repositoryRoot: masterRoot,
      archiveRemote: 'origin',
      publish: (event) => federationTaskStateReplicator?.publishEvent(event),
    });
    projectTaskStates.set(project.id, value);
    return value;
  };

  const synchronizeFederationContent = async (nodeId = ''): Promise<void> => {
    if (!federation || !federationContentScheduler) return;
    for (const project of federation.remoteProjects().filter((entry) => entry.online && (!nodeId || entry.ownerNodeId === nodeId))) {
      const result = await federation.request(project.ownerNodeId, `/api/federation/content-manifest?projectId=${encodeURIComponent(project.localProjectId)}`);
      if (result.status !== 200) continue;
      try { federationContentStore.applyManifest(project.ownerNodeId, JSON.parse(result.body.toString('utf8')) as FederationContentManifest); }
      catch { /* Anti-entropy will retry an invalid or interrupted manifest. */ }
    }
    await federationContentScheduler.drain();
  };
  const taskStoreForProject = (projectId: string, ownerNodeId = ''): TaskEventStore | null => {
    const local = projectTaskStates.get(projectId)?.store;
    if (local) return local;
    const key = `${ownerNodeId}\u0000${projectId}`;
    const current = federatedTaskStores.get(key);
    if (current) return current;
    if (!projectId || !ownerNodeId) return null;
    const store = createTaskEventStore({ decisionOsRoot: resolve(masterDecisionOsRoot, 'cache', 'federation-task-state', ownerNodeId), projectId });
    federatedTaskStores.set(key, store);
    return store;
  };
  let projectSyncCodexRunningProcessCount = 0;
  let projectSyncSlotTail = Promise.resolve();
  const globalCodexProcessCapacity = (): number => {
    const settings = runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object' ? runtime.decisionOsSettings as AnyRecord : {};
    return normalizedConcurrentCodexProcesses(process.env.CODEX_MAX_CONCURRENT_PROCESSES ?? settings.maxConcurrentCodexProcesses ?? 1) ?? 1;
  };
  const globalCodexRunningProcessCount = (): number => [...projectContexts.values()]
    .reduce((count, context) => count + runningCodexProcessCount({ codexSkillRuns: context.runtime.codexSkillRuns }), projectSyncCodexRunningProcessCount);
  const globalCodexQueuePosition = (id: string): number => {
    const pending = [...projectContexts.keys()].flatMap((root, rootOrder) => pendingCodexProcessEntries(root)
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
            .map(([root, context]) => ({ root, context, createdAt: nextPendingCodexProcessCreatedAt(root) }))
            .filter((entry): entry is { root: string; context: ProjectContext; createdAt: string } => Boolean(entry.createdAt))
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
      if (globalCodexScheduleRequested) void scheduleGlobalCodexProcesses().catch(() => undefined);
    });
    Object.defineProperty(runtime, 'globalCodexSchedulePromise', { value: schedule, writable: true, configurable: true, enumerable: false });
    return schedule;
  };
  const projectContext = (activeDecisionOsRoot: string, projectId: string): ProjectContext => {
    const existing = projectContexts.get(activeDecisionOsRoot);
    if (existing) return existing;
    migrateBacklogStatus(activeDecisionOsRoot);
    const clients = new Set<ServerResponse>();
    const revisions = createLedgerRevisionTracker();
    const projectRuntime = activeDecisionOsRoot === masterDecisionOsRoot
      ? Object.assign(runtime, { decisionOsRoot: activeDecisionOsRoot, projectId })
      : Object.assign({}, runtime, { decisionOsRoot: activeDecisionOsRoot, projectId });
    if (activeDecisionOsRoot !== masterDecisionOsRoot) {
      readDecisionOsSettings({ action_payload: { decisionOsRoot: activeDecisionOsRoot }, runtime_state: projectRuntime });
    }
    projectRuntime.globalCodexProcessCapacity = globalCodexProcessCapacity;
    projectRuntime.globalCodexRunningProcessCount = globalCodexRunningProcessCount;
    projectRuntime.globalCodexQueuePosition = globalCodexQueuePosition;
    projectRuntime.persistTaskLedgerProjection = (ledger: AnyRecord): { ledger: AnyRecord } => {
      const project = projectCatalogStore.projects().find((entry) => entry.id === projectId);
      if (!project) throw new Error(`Task-state authority has no project ${projectId}.`);
      return taskStateForProject(project).commitNow(ledger);
    };
    projectRuntime.acquireProjectSyncCodexSlot = async (): Promise<() => void> => {
      let unlockQueue: () => void = () => undefined;
      const previous = projectSyncSlotTail;
      projectSyncSlotTail = new Promise<void>((resolveSlot) => { unlockQueue = resolveSlot; });
      await previous;
      while (globalCodexRunningProcessCount() >= globalCodexProcessCapacity()) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      }
      projectSyncCodexRunningProcessCount += 1;
      unlockQueue();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        projectSyncCodexRunningProcessCount = Math.max(0, projectSyncCodexRunningProcessCount - 1);
        void scheduleGlobalCodexProcesses().catch(() => undefined);
      };
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
        change: {
          contentFile: String(event.contentFile ?? ''),
          file: String(event.file ?? resolve(activeDecisionOsRoot, String(event.contentFile ?? '').replace(/^\/?\.decision-os\//, ''))),
          kind: event.kind === 'thread-content' ? 'thread-content' : 'card-content'
        }
      });
      const scopedEvent = hasCompleteScope ? event : resolvedEvent ? { ...event, ...resolvedEvent } : null;
      if (!scopedEvent) return;
      controlRoomProjectionStore?.invalidate(projectId);
      revisions.advance(String(scopedEvent.ledgerId));
      broadcast(`event: card-content-change\ndata: ${JSON.stringify({ ...scopedEvent, projectId })}\n\n`);
      federation?.publishContentChange();
    };
    const publishLedger = (event: AnyRecord): void => {
      if (event.kind === 'state') projectCatalogStore.refresh(projectId);
      controlRoomProjectionStore?.invalidate(projectId);
      watcher?.refreshOwnership();
      const ledgerId = String(event.ledgerId ?? '');
      if (ledgerId) revisions.advance(ledgerId);
      broadcast(`event: ledger-content-change\ndata: ${JSON.stringify({ ...event, projectId })}\n\n`);
      federation?.publishContentChange();
    };
    projectRuntime.onPipelineLedgerChange = publishLedger;
    projectRuntime.scheduleCodexProcesses = scheduleGlobalCodexProcesses;
    projectRuntime.onCodexTurnStarted = (event: AnyRecord): void => {
      publishLedger({
        reason: 'codex-turn-started', ledgerId: String(event.ledgerId ?? ''), runId: String(event.runId ?? ''),
        cardId: String(event.cardId ?? ''), threadId: String(event.threadId ?? ''), startedAt: String(event.startedAt ?? '')
      });
    };
    projectRuntime.onCodexRunSettled = (event: AnyRecord): void => {
      if (!event.pipelineRunId) {
        publishLedger({
          reason: 'codex-thread-settled', ledgerId: String(event.ledgerId ?? ''), status: String(event.status ?? ''),
          runId: String(event.runId ?? ''), cardId: String(event.cardId ?? event.outputCardId ?? ''),
          outputCardId: String(event.outputCardId ?? event.cardId ?? ''), threadId: String(event.threadId ?? '')
        });
      }
      if (event.pipelineRunId && event.pipelineTerminal === true) {
        const pipelineStatus = String(event.pipelineStatus ?? event.status ?? 'complete');
        publishLedger({
          reason: pipelineStatus === 'complete' ? 'pipeline-completed' : pipelineStatus === 'cancelled' ? 'pipeline-cancelled' : 'pipeline-failed',
          ledgerId: String(event.ledgerId ?? ''), pipelineRunId: String(event.pipelineRunId), pipelineStatus,
          status: String(event.status ?? pipelineStatus), runId: String(event.runId ?? ''),
          cardId: String(event.cardId ?? event.outputCardId ?? ''), outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
          threadId: String(event.threadId ?? '')
        });
      }
      if (event.pipelineRunId) void resumeCodexPipelineRuns({ decisionOsRoot: activeDecisionOsRoot, runtime: projectRuntime }).catch(() => undefined);
      if (!event.pipelineRunId || event.pipelineTerminal === true) void continueQueuedVoiceCodexAfterRun({
        runtime: projectRuntime, ledgerId: String(event.ledgerId ?? ''), cardId: String(event.cardId ?? event.outputCardId ?? ''),
        threadId: String(event.threadId ?? ''), runId: String(event.runId ?? ''), onCardContentChange: publishCard, onLedgerChange: publishLedger
      });
    };
    watcher = watchProjectFiles({
      decisionOsRoot: activeDecisionOsRoot,
      onContentChange: publishCard,
      onProjectChange: publishLedger,
    });
    const context: ProjectContext = { clients, revisions, runtime: projectRuntime, publishCard, publishLedger, watcher };
    projectContexts.set(activeDecisionOsRoot, context);
    recoverCodexProcessQueue(activeDecisionOsRoot, projectRuntime);
    void resumeCodexPipelineRuns({ decisionOsRoot: activeDecisionOsRoot, runtime: projectRuntime }).catch(() => undefined);
    return context;
  };
  migrateLegacyProjectPipelines({
    serverDecisionOsRoot: masterDecisionOsRoot,
    projectDecisionOsRoots: projectCatalogStore.projects()
      .filter((project) => project.available)
      .map((project) => project.decisionOsRoot),
  });
  const projectCatalog = () => projectCatalogStore.projects();
  let federationServerPort = port;
  let federationSyncRequested = false;
  let federationSyncPromise: Promise<void> | null = null;
  const localWorkspaceRoots = (): string[] => [
    masterRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.root),
  ];
  const localDecisionOsRoots = (): string[] => [
    masterDecisionOsRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.decisionOsRoot),
  ];
  const availableServerSkillNames = readCodexSkillCatalog({ decisionOsRoot: masterDecisionOsRoot, runtime }).skills.map((skill) => skill.name);
  ensureServerPipelines({ serverDecisionOsRoot: masterDecisionOsRoot, availableSkillNames: availableServerSkillNames });
  migrateCodexSkillMetadataOwner({
    ownerDecisionOsRoot: masterDecisionOsRoot,
    sourceDecisionOsRoots: localDecisionOsRoots(),
    availableSkillNames: availableServerSkillNames,
  });
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
  const parseFederationResponse = <T>(result: { status: number; body: Buffer }, label: string): T => {
    if (result.status !== 200) throw new Error(`${label} returned HTTP ${result.status}.`);
    try { return JSON.parse(result.body.toString('utf8')) as T; }
    catch { throw new Error(`${label} returned invalid JSON.`); }
  };
  const synchronizeFederatedLibraries = (): Promise<void> => {
    federationSyncRequested = true;
    if (federationSyncPromise) return federationSyncPromise;
    const run = (async () => {
      do {
        federationSyncRequested = false;
        const peers = federation?.nodes().filter((node) => node.online) ?? [];
        // WHAT: Complete skill materialization is the first synchronization phase.
        // WHY: Pipeline validation and every Process Card consumer require local skill packages.
        for (const peer of peers) {
          const manifest = parseFederationResponse<FederatedSkillManifest>(
            await federation!.request(peer.nodeId, '/api/federation/skills-manifest'),
            `${peer.nodeLabel} skill manifest`,
          );
          const local = new Map(exportFederatedSkillManifest(masterRoot, localWorkspaceRoots()).skills.map((skill) => [skill.name, skill.revision]));
          for (const skill of manifest.skills) {
            if (local.get(skill.name) === skill.revision) continue;
            const snapshot = parseFederationResponse<FederatedSkillSnapshot>(
              await federation!.request(peer.nodeId, `/api/federation/skills-snapshot?name=${encodeURIComponent(skill.name)}`),
              `${peer.nodeLabel} skill ${skill.name}`,
            );
            importFederatedSkillSnapshot({ serverRoot: masterRoot, snapshot });
          }
        }
        // WHAT: Pipeline definitions synchronize only after every available skill package is local.
        // WHY: The persisted pipeline catalog must normalize against the complete local skill set.
        for (const peer of peers) {
          const snapshot = parseFederationResponse<FederatedPipelineSnapshot>(
            await federation!.request(peer.nodeId, '/api/federation/pipelines-snapshot'),
            `${peer.nodeLabel} pipeline snapshot`,
          );
          importFederatedPipelineSnapshot({ decisionOsRoot: masterDecisionOsRoot, snapshot });
        }
      } while (federationSyncRequested);
    })().finally(() => {
      if (federationSyncPromise === run) federationSyncPromise = null;
      if (federationSyncRequested) void synchronizeFederatedLibraries().catch(() => undefined);
    });
    federationSyncPromise = run;
    Object.defineProperty(runtime, 'federatedLibrarySyncPromise', { value: run, writable: true, configurable: true, enumerable: false });
    return run;
  };
  federation = createFederationNodeConnector({
    settings: runtime.decisionOsSettings,
    localProjects: projectCatalog,
    localServerUrl: () => `http://127.0.0.1:${federationServerPort}`,
    onRemoteContentChange: (nodeId) => {
      void synchronizeFederationContent(nodeId);
      for (const client of globalContentEventClients) client.write('event: ledger-content-change\ndata: {"remote":true}\n\n');
    },
    onRemoteCatalogChange: () => {
      for (const project of projectCatalog().filter((entry) => entry.available)) taskStateForProject(project);
      for (const peer of federation?.nodes().filter((entry) => entry.online) ?? []) federationTaskStateReplicator?.reconcilePeer(peer.nodeId);
      void synchronizeFederationContent();
      void synchronizeFederatedLibraries().catch(() => undefined);
      projectSyncController?.resume();
    },
    onStateFrame: async (frame) => {
      await federationTaskStateReplicator?.handleFrame(frame);
      void federationContentScheduler?.drain();
    },
  });
  for (const project of projectCatalog().filter((entry) => entry.available)) taskStateForProject(project);
  federationTaskStateReplicator = createFederationTaskStateReplicator({
    nodeId: federation.localOwner().ownerNodeId,
    stores: () => new Map([...projectTaskStates].map(([projectId, state]) => [projectId, state.store])),
    storeFor: taskStoreForProject,
    peers: () => federation!.nodes(),
    publish: (nodeId, frame) => federation!.publishStateFrame(nodeId, frame),
    onProjectionChange: ({ projectId, from }) => {
      controlRoomProjectionStore?.invalidate(projectId);
      for (const client of globalContentEventClients) client.write(`event: ledger-content-change\ndata: ${JSON.stringify({ remote: true, projectId, nodeId: from })}\n\n`);
    },
  });
  federationContentScheduler = createFederationContentScheduler({
    store: federationContentStore,
    hasPriorityStateWork: () => {
      const diagnostics = federationTaskStateReplicator?.diagnostics();
      const onlinePeers = new Set(federation?.nodes().filter((node) => node.online).map((node) => node.nodeId) ?? []);
      return Boolean(diagnostics && (
        diagnostics.activeSnapshotTransfers > 0
        || diagnostics.awaitingSnapshots > 0
        || diagnostics.pendingAcknowledgements.some((entry) => entry.count > 0 && onlinePeers.has(entry.peerId))
      ));
    },
    fetchContent: async ({ ownerNodeId, projectId, hash }) => {
      const result = await federation!.request(ownerNodeId, `/api/federation/content-object?projectId=${encodeURIComponent(projectId)}&hash=${encodeURIComponent(hash)}`);
      if (result.status !== 200) throw new Error(`content_object_http_${result.status}`);
      return result.body;
    },
  });
  const projectSyncStore = createProjectSyncStore({ decisionOsRoot: masterDecisionOsRoot });
  projectSyncController = createProjectSyncController({
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
    onRunChange: () => undefined,
  });
  projectSyncController.resume();
  Object.defineProperty(runtime, 'federationNodeConnector', { value: federation, configurable: true, enumerable: false });
  controlRoomProjectionStore = createControlRoomProjectionStore({
    cacheFile: resolve(masterDecisionOsRoot, 'cache', 'control-room-v3.json'),
    runtimeForRoot: (root) => projectContexts.get(root)?.runtime ?? {},
    taskProjectionForProject: (project) => taskStateForProject(project).projection().ledger,
  });
  // WHAT: Build the first projection during startup, then let project watchers maintain it.
  // WHY: Control Room requests must read a ready snapshot instead of traversing every registered project.
  controlRoomProjectionStore.get(projectCatalog().filter((project) => project.available));
  for (const project of projectCatalog()) {
    // WHAT: Start runtimes only for paths that passed registry validation.
    // WHY: An unavailable registration must remain visible without recreating directories through watcher setup.
    if (project.available) projectContext(project.decisionOsRoot, project.id);
  }
  const reconcileProjectRuntimes = (): void => {
    const registered = projectCatalog();
    const activeRoots = new Set(registered.filter((project) => project.available).map((project) => project.decisionOsRoot));
    for (const project of registered) {
      // WHAT: Reconcile only validated project roots.
      // WHY: Missing registrations remain catalog diagnostics rather than implicit directory creation requests.
      if (project.available) projectContext(project.decisionOsRoot, project.id);
    }
    for (const [root, context] of projectContexts) {
      if (activeRoots.has(root)) continue;
      context.watcher.close();
      context.clients.clear();
      projectContexts.delete(root);
    }
    controlRoomProjectionStore?.reconcile(registered);
  };
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requestPath = requestUrl.pathname;
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
    if (projectScope && requestedReplicaNodeId && requestedReplicaNodeId !== localNodeId) {
      const ownerNodeId = requestedReplicaNodeId;
      const localProjectId = projectScope.projectId;
      const remoteProject = federation.remoteProjects().find((project) => project.ownerNodeId === ownerNodeId && project.localProjectId === localProjectId);
      if (!remoteProject) {
        response.statusCode = 404;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'replica_unknown', projectId: localProjectId, nodeId: ownerNodeId }));
        return;
      }
      const taskStore = taskStoreForProject(localProjectId, ownerNodeId);
      const projection = taskStore && (taskStore.events().length > 0 || taskStore.snapshots().length > 0) ? taskStore.projection() : null;
      const stateStatus = projection
        ? { status: remoteProject.online ? 'synchronized' : 'offline', updatedAt: '', message: '', resource: '' }
        : { status: 'synchronizing', updatedAt: '', message: 'Synchronizing task events.', resource: projectScope.scopedPath };
      const ledgerRead = projectScope.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/navigation$/);
      const cardRead = projectScope.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)$/);
      const threadRead = projectScope.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/threads\/([^/]+)$/);
      let replicaBody: unknown = null;
      if (request.method === 'GET' && projection) {
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
            const content = federationContentStore.resource(ownerNodeId, localProjectId, key);
            replicaBody = { ...card, comment: { ...comment, ...(content.bytes ? { what: content.bytes.toString('utf8') } : {}) }, content: { state: content.state, error: content.error } };
          }
        }
        if (threadRead) {
          const threadId = decodeRouteSegment(threadRead[2]);
          const refs = ledger.threadFiles && typeof ledger.threadFiles === 'object' ? ledger.threadFiles as AnyRecord : {};
          const key = String(refs[threadId] ?? '');
          const content = federationContentStore.resource(ownerNodeId, localProjectId, key);
          replicaBody = { ledgerId: decodeRouteSegment(threadRead[1]), threadId, threadFiles: key ? { [threadId]: key } : {}, notes: { [threadId]: content.bytes ? parseThreadMarkdown(content.bytes.toString('utf8')) : [] }, content: { state: content.state, error: content.error } };
        }
      }
      const replicaRead = request.method === 'GET' && (projectScope.scopedPath === '/decision-os/state' || ledgerRead || cardRead || threadRead);
      if (replicaRead && replicaBody) {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.setHeader('x-decision-os-state-status', stateStatus.status);
        response.end(JSON.stringify({ ...(replicaBody as AnyRecord), state: stateStatus }));
        return;
      }
      if (replicaRead) {
        federationTaskStateReplicator?.reconcilePeer(ownerNodeId);
        response.statusCode = 202;
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'state_synchronizing', state: stateStatus }));
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
    const projects = projectCatalog();
    const activeProject = projectScope
      ? resolveCatalogProject({ projects, projectId: projectScope.projectId, fallbackDecisionOsRoot: masterDecisionOsRoot })
      : projects.length === 1 && isProjectSensitiveEndpoint(url) && !isGlobalProjectEndpoint(url)
        ? projects[0]
        : null;
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
        const store = taskStoreForProject(project.localProjectId, project.ownerNodeId);
        if (!store || (store.events().length === 0 && store.snapshots().length === 0)) return [];
        return [{
          projection: controlRoomProjectionFromTaskLedger({
            project: { ...project, id: project.localProjectId, originFingerprint: remoteProjectIdentity.get(`${project.ownerNodeId}\0${project.localProjectId}`) ?? project.originFingerprint },
            ledger: store.projection().ledger,
          }),
          owner: { nodeId: project.ownerNodeId, nodeLabel: project.ownerNodeLabel, remote: true, online: project.online },
        }];
      });
      const publicProjection = federatedControlRoomProjection({
        localProjection: projection,
        localOwner: { nodeId: localOwner.ownerNodeId, nodeLabel: localOwner.ownerNodeLabel, remote: false },
        remoteProjections,
        diagnostics: remoteDiagnostics,
      });
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
    const persistLedgerAndRespond = async (ledgerId: string, ledgerPath: string, ledger: AnyRecord, activeResponse: ServerResponse, activeDecisionOsRoot = decisionOsRoot): Promise<void> => {
      controlRoomProjectionStore?.invalidate(activeProject?.id ?? '');
      stripHydratedThreadNotes(ledger);
      context.watcher.ignoreNext(ledgerPath);
      const persistedLedger = ledgerId === 'tasks' && localProject
        ? (await taskStateForProject(localProject).commit(ledger)).ledger
        : (writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)), ledger);
      context.watcher.refreshOwnership();
      if (ledgerId !== 'tasks') federation?.publishContentChange();
      activeResponse.setHeader(ledgerRevisionHeader, String(ledgerRevisions.advance(ledgerId)));
      activeResponse.end(JSON.stringify(hydrateLedgerCardContent(persistedLedger, activeDecisionOsRoot)));
    };
    const persistLedgerMutationAndRespond = async (ledgerId: string, ledgerPath: string, ledger: AnyRecord, mutation: LedgerMutation, activeResponse: ServerResponse): Promise<void> => {
      controlRoomProjectionStore?.invalidate(activeProject?.id ?? '');
      stripHydratedThreadNotes(ledger);
      context.watcher.ignoreNext(ledgerPath);
      const persistedLedger = ledgerId === 'tasks' && localProject
        ? (await taskStateForProject(localProject).commit(ledger)).ledger
        : (writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)), ledger);
      context.watcher.refreshOwnership();
      if (ledgerId !== 'tasks') federation?.publishContentChange();
      const revision = ledgerRevisions.advance(ledgerId);
      const cardId = String(mutation.cardPatch?.id ?? mutation.card?.id ?? mutation.cardId ?? mutation.masterTaskId ?? '');
      const threadId = String(mutation.note?.threadId ?? (mutation.action === 'create-card' && cardId ? `thread-${cardId}` : ''));
      const changedCard = cardId
        ? ledgerCardProjection({ decisionOsRoot, ledgerId, ledger: persistedLedger, cardId })
        : null;
      const changedThread = threadId ? ledgerThreadProjection({ decisionOsRoot, ledgerId, ledger: ledgerId === 'tasks' ? persistedLedger : undefined, threadId }) : null;
      const annotationId = String(mutation.annotation?.id ?? mutation.region?.id ?? '');
      const relationshipId = String(mutation.relationship?.id ?? '');
      const body = {
        ok: true,
        ledgerId,
        revision,
        changedCard,
        changedThread,
        changedAnnotation: annotationId && Array.isArray(persistedLedger.annotations) ? persistedLedger.annotations.find((entry) => String((entry as AnyRecord).id ?? '') === annotationId) ?? null : null,
        changedRelationship: relationshipId && Array.isArray(persistedLedger.relationships) ? persistedLedger.relationships.find((entry) => String((entry as AnyRecord).id ?? '') === relationshipId) ?? null : null,
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
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.setHeader(ledgerRevisionHeader, String(ledgerRevisions.current(ledgerId)));
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
      const manifest = buildFederationContentManifest({ projectId: project.id, decisionOsRoot: project.decisionOsRoot, ledger: taskStateForProject(project).projection().ledger });
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(manifest));
      return;
    }
    if (!projectScope && url === '/api/task-state/commit' && request.method === 'POST') {
      const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
      const project = projects.find((entry) => entry.id === String(body.projectId ?? '') && entry.available);
      if (!project || !body.ledger || typeof body.ledger !== 'object' || Array.isArray(body.ledger)) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'A local project and task projection are required.' }));
        return;
      }
      const committed = await taskStateForProject(project).commit(body.ledger as AnyRecord);
      controlRoomProjectionStore?.invalidate(project.id);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, eventCount: committed.events.length }));
      return;
    }
    if (!projectScope && url === '/api/federation/replication-status' && request.method === 'GET') {
      const stores = [
        ...[...projectTaskStates].map(([projectId, state]) => ({ projectId, ownerNodeId: federation?.localOwner().ownerNodeId ?? 'local', store: state.store })),
        ...[...federatedTaskStores].map(([key, store]) => {
          const [ownerNodeId, projectId] = key.split('\u0000');
          return { projectId, ownerNodeId, store };
        }),
      ];
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        stateLane: {
          ...federationTaskStateReplicator?.diagnostics(),
          projects: stores.map(({ projectId, ownerNodeId, store }) => ({
            projectId,
            ownerNodeId,
            eventCount: store.events().length,
            snapshotCount: store.snapshots().length,
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
      const project = projects.find((entry) => entry.id === contentUrl.searchParams.get('projectId') && entry.available);
      if (!project) {
        response.statusCode = 404;
        response.end();
        return;
      }
      const manifest = buildFederationContentManifest({ projectId: project.id, decisionOsRoot: project.decisionOsRoot, ledger: taskStateForProject(project).projection().ledger });
      const bytes = readManifestResource({ decisionOsRoot: project.decisionOsRoot, manifest, hash: contentUrl.searchParams.get('hash') ?? '' });
      if (!bytes) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader('cache-control', 'private, max-age=31536000, immutable');
      response.setHeader('content-type', 'application/octet-stream');
      response.end(bytes);
      return;
    }
    if (!projectScope && url === '/api/federation/skills-manifest' && request.method === 'GET') {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(exportFederatedSkillManifest(masterRoot, localWorkspaceRoots())));
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
      response.end(JSON.stringify(exportFederatedSkillSnapshot(masterRoot, new Set([skillName]), localWorkspaceRoots())));
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
        await synchronizeFederatedLibraries();
        response.end(JSON.stringify({ ok: true, synchronizedPeerCount: federation.nodes().filter((node) => node.online).length }));
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
      if (result.ok === true) void scheduleGlobalCodexProcesses();
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
        const codex = await executeProjectSyncPipelineSkill({
          projectRoot: project.root,
          runtime: projectContext(project.decisionOsRoot, project.id).runtime,
          ledgerFile: resolve(project.decisionOsRoot, tasksLedgerForProject(project).ledgerFile.replace(/^\.decision-os\//, '')),
          syncId: String(body.syncId ?? ''),
          nodeId: federation.localOwner().ownerNodeId,
          initiatorNodeId: String(body.initiatorNodeId ?? ''),
          role,
          requiredSha: String(body.requiredSha ?? '') || undefined,
          snapshot,
          codexRunId: String(body.pipelineSkillRunId ?? ''),
          pipelineRunId: String(body.pipelineRunId ?? ''),
          masterTask: {
            projectId: String(masterTask.projectId ?? ''),
            ledgerId: String(masterTask.ledgerId ?? ''),
            cardId: String(masterTask.cardId ?? ''),
          },
        });
        const verified = verifyProjectSyncPhase({ projectRoot: project.root, role, requiredSha: String(body.requiredSha ?? '') || undefined, result: codex.result });
        response.end(JSON.stringify({ ok: true, ...codex, snapshot: verified }));
      } catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project synchronization role failed.' }));
      }
      return;
    }
    if (url === '/api/project-sync/lock-release' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      response.setHeader('content-type', 'application/json');
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
        const admitted = await projectSyncController.start(source, String(body.idempotencyKey ?? request.headers['idempotency-key'] ?? sourceId));
        response.statusCode = admitted.duplicate ? 200 : 202;
        response.end(JSON.stringify({
          ok: true,
          duplicate: admitted.duplicate,
          masterCardId: admitted.run.masterCardId,
          ledgerId: admitted.run.ledgerId,
          pipelineRunId: admitted.run.pipelineRunId,
          projectId: admitted.run.taskProjectId,
          run: admitted.run,
        }));
      } catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project synchronization admission failed.' }));
      }
      return;
    }
    if (url === '/api/project-sync' && request.method === 'GET') {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, runs: projectSyncStore.list() }));
      return;
    }
    if (url.startsWith('/api/project-sync/') && url.endsWith('/retry') && request.method === 'POST') {
      const syncId = decodeRouteSegment(url.slice('/api/project-sync/'.length, -'/retry'.length));
      response.setHeader('content-type', 'application/json');
      try {
        const run = projectSyncController.retry(syncId);
        response.statusCode = 202;
        response.end(JSON.stringify({ ok: true, run }));
      } catch (error) {
        response.statusCode = 409;
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project synchronization retry failed.' }));
      }
      return;
    }
    if (url.startsWith('/api/project-sync/') && url !== '/api/project-sync/role' && url !== '/api/project-sync/repository-status' && request.method === 'GET') {
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
        const replicated = Boolean(store && (store.events().length > 0 || store.snapshots().length > 0));
        const replica = { status: replicated ? 'replicated' : project.online ? 'synchronizing' : 'offline', updatedAt: '', message: replicated ? '' : project.online ? 'Synchronizing task events.' : 'Owner offline.', resource: '' };
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
      const result = await cancelCodexPipelineRunController({ action_payload: { runId }, runtime_state: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/pipelines/runs/') && url.endsWith('/restart') && request.method === 'POST') {
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
      const result = await readCardSkillRunController({
        action_payload: {
          runId,
          ledgerId: requestUrl.searchParams.get('ledgerId') ?? '',
          cardId: requestUrl.searchParams.get('cardId') ?? '',
          since: requestUrl.searchParams.get('since') ?? '0',
          traceId
        },
        runtime_state: requestRuntime
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
          onLedgerChange: publishLedgerContentChange
        },
        runtime_state: requestRuntime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
      response.end(JSON.stringify({ body: result }));
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
      const extension = imageExtensionForMimeType(mimeType);
      const directory = resolve(decisionOsRoot, 'thread-images', threadId);
      mkdirSync(directory, { recursive: true });
      const fileName = `paste-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
      const filePath = resolve(directory, fileName);
      writeFileSync(filePath, imageBuffer);
      const imageFileRef = `/.decision-os/thread-images/${threadId}/${fileName}`;
      response.statusCode = 201;
      response.end(JSON.stringify({ ok: true, imageFileRef, markdown: `![Pasted image](${imageFileRef})` }));
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
        if (mutation.action === 'complete-master-task') {
          const completion = commitMasterTaskCompletion({
            decisionOsRoot,
            ledgerPath,
            ledger,
            mutation,
            persistProjection: tabId === 'tasks' && localProject
              ? (projection) => { taskStateForProject(localProject).commitNow(projection); }
              : undefined,
          });
          if (completion.ok === false) {
            response.statusCode = completion.error.statusCode;
            response.end(JSON.stringify(completion.error.body));
            return;
          }
          response.setHeader(completionCommitHeader, completion.commitSha);
          await persistLedgerMutationAndRespond(tabId, ledgerPath, ledger, mutation, response);
          return;
        }
        if (mutation.action === 'patch-card' && mutation.cardPatch?.status === 'backlog' && mutation.cardPatch.id) {
          const card = Array.isArray(ledger.cards) ? ledger.cards.find((entry) => String(entry.id ?? '') === String(mutation.cardPatch?.id)) : null;
          const pipelineRunId = String(card?.codexQueuedPipelineRunId ?? '');
          const skillRunId = String(card?.codexActiveRunId ?? card?.codexThreadRunId ?? card?.codexRunId ?? '');
          const lifecycle = pipelineRunId
            ? readCompactPipelineRunStatusController({ runId: pipelineRunId, runtime: requestRuntime })
            : skillRunId
              ? readCompactSkillRunStatusController({ runId: skillRunId, ledgerId: tabId, cardId: String(mutation.cardPatch.id), runtime: requestRuntime })
              : null;
          if (lifecycle && (lifecycle.status === 'pending' || lifecycle.status === 'processing' || lifecycle.status === 'running' || lifecycle.status === 'in_progress')) {
            response.statusCode = 409;
            response.end(JSON.stringify({ ok: false, error: 'A queued or running task cannot move to backlog.', status: lifecycle.status }));
            return;
          }
        }
        const mutationResult = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation });
        if (mutationResult.error) {
          response.statusCode = mutationResult.error.statusCode;
          response.end(JSON.stringify(mutationResult.error.body));
          return;
        }
        await persistLedgerMutationAndRespond(tabId, ledgerPath, ledger, mutation, response);
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
    if (!projectScope && request.method === 'GET' && routeTabId && !['projects', 'projects-canvas', 'ledgers', 'pipelines', 'skills', 'settings', 'control-room'].includes(routeTabId)) {
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
  });
  const codexQueueScanTimer = setInterval(() => {
    void scheduleGlobalCodexProcesses().catch(() => undefined);
  }, 1_000);
  codexQueueScanTimer.unref?.();
  const federationAntiEntropyTimer = setInterval(() => {
    for (const peer of federation.nodes().filter((entry) => entry.online)) federationTaskStateReplicator?.reconcilePeer(peer.nodeId);
    void synchronizeFederationContent();
  }, 30_000);
  federationAntiEntropyTimer.unref?.();
  server.on('close', () => {
    clearInterval(codexQueueScanTimer);
    clearInterval(federationAntiEntropyTimer);
    for (const context of projectContexts.values()) {
      context.watcher.close();
      context.clients.clear();
    }
    globalContentEventClients.clear();
    federation.stop();
  });
  server.on('listening', () => {
    const address = server.address();
    if (address && typeof address === 'object') federationServerPort = address.port;
    federation.start();
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}
