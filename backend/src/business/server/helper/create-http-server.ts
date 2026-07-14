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
import { readRequestBuffer } from './read-request-buffer.js';
import { parseMultipartFormData } from './parse-multipart-form-data.js';
import { contentTypeFor } from './content-type-for.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';
import { hydrateLedgerCardContent } from '../../ledger/helper/card-content-file.js';
import { hydrateLedgerThreadNotes, stripHydratedThreadNotes, writeThreadNotesFile } from '../../ledger/helper/thread-content-file.js';
import { resolveCardContentChange, watchCardContentFiles, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';
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
import { scheduleCodexProcesses } from '../../codex/helper/codex-process-scheduler.js';
import { createDecisionOsProject, discoverDecisionOsProjects, resolveCatalogProject, saveProjectMetadata } from './project-catalog.js';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint, parseProjectUrlScope } from './project-url-scope.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { ensureDecisionOsMemoryStore } from './ensure-decision-os-memory-store.js';

type AnyRecord = Record<string, unknown>;
type MutationError = { statusCode: number; body: AnyRecord };

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
  runtime.memoryDatabasePath = ensureDecisionOsMemoryStore(masterDecisionOsRoot);
  const globalContentEventClients = new Set<ServerResponse>();
  type ProjectContext = {
    clients: Set<ServerResponse>;
    revisions: ReturnType<typeof createLedgerRevisionTracker>;
    runtime: AnyRecord;
    publishCard: (event: CardContentChange | AnyRecord) => void;
    publishLedger: (event: AnyRecord) => void;
    watcher: ReturnType<typeof watchCardContentFiles>;
  };
  const projectContexts = new Map<string, ProjectContext>();
  const projectContext = (activeDecisionOsRoot: string, projectId: string): ProjectContext => {
    const existing = projectContexts.get(activeDecisionOsRoot);
    if (existing) return existing;
    const clients = new Set<ServerResponse>();
    const revisions = createLedgerRevisionTracker();
    const projectRuntime = activeDecisionOsRoot === masterDecisionOsRoot
      ? Object.assign(runtime, { decisionOsRoot: activeDecisionOsRoot, projectId })
      : Object.assign({}, runtime, { decisionOsRoot: activeDecisionOsRoot, projectId });
    if (activeDecisionOsRoot !== masterDecisionOsRoot) {
      readDecisionOsSettings({ action_payload: { decisionOsRoot: activeDecisionOsRoot }, runtime_state: projectRuntime });
    }
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
      revisions.advance(String(scopedEvent.ledgerId));
      broadcast(`event: card-content-change\ndata: ${JSON.stringify({ ...scopedEvent, projectId })}\n\n`);
    };
    const publishLedger = (event: AnyRecord): void => {
      const ledgerId = String(event.ledgerId ?? '');
      if (ledgerId) revisions.advance(ledgerId);
      broadcast(`event: ledger-content-change\ndata: ${JSON.stringify({ ...event, projectId })}\n\n`);
    };
    projectRuntime.onPipelineLedgerChange = publishLedger;
    projectRuntime.scheduleCodexProcesses = (): Promise<AnyRecord> => scheduleCodexProcesses({ decisionOsRoot: activeDecisionOsRoot, runtime: projectRuntime });
    projectRuntime.onCodexRunSettled = (event: AnyRecord): void => {
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
    const context: ProjectContext = {
      clients, revisions, runtime: projectRuntime, publishCard, publishLedger,
      watcher: watchCardContentFiles({ decisionOsRoot: activeDecisionOsRoot, onChange: publishCard })
    };
    projectContexts.set(activeDecisionOsRoot, context);
    recoverCodexProcessQueue(activeDecisionOsRoot);
    void resumeCodexPipelineRuns({ decisionOsRoot: activeDecisionOsRoot, runtime: projectRuntime }).catch(() => undefined);
    return context;
  };
  const loadLedgerContentFiles = (ledger: AnyRecord, activeDecisionOsRoot = decisionOsRoot): AnyRecord => hydrateLedgerCardContent(hydrateLedgerThreadNotes(ledger, activeDecisionOsRoot), activeDecisionOsRoot);
  let projectCatalogCache = { expiresAt: 0, projects: [] as ReturnType<typeof discoverDecisionOsProjects> };
  const projectCatalog = (): ReturnType<typeof discoverDecisionOsProjects> => {
    const now = Date.now();
    if (projectCatalogCache.expiresAt > now) return projectCatalogCache.projects;
    const projects = discoverDecisionOsProjects({ masterRoot, masterDecisionOsRoot });
    projectCatalogCache = { expiresAt: now + 5000, projects };
    return projects;
  };
  for (const project of projectCatalog()) projectContext(project.decisionOsRoot, project.id);
  const server = createServer(async (request, response) => {
    const requestPath = (request.url ?? '/').split('?')[0];
    const projectScope = parseProjectUrlScope(requestPath);
    if (requestPath.startsWith('/p/') && !projectScope) {
      response.statusCode = 400;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: false, error: 'Malformed project URL.' }));
      return;
    }
    const url = projectScope && isProjectSensitiveEndpoint(projectScope.scopedPath) ? projectScope.scopedPath : requestPath;
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
    const persistLedgerAndRespond = (ledgerId: string, ledgerPath: string, ledger: AnyRecord, activeResponse: ServerResponse, activeDecisionOsRoot = decisionOsRoot): void => {
      stripHydratedThreadNotes(ledger);
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
      activeResponse.setHeader(ledgerRevisionHeader, String(ledgerRevisions.advance(ledgerId)));
      activeResponse.end(JSON.stringify(loadLedgerContentFiles(ledger, activeDecisionOsRoot)));
    };
    if (url === '/api/settings/codex-processes' && request.method === 'GET') {
      if (!projectScope && projects.length !== 1) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'Project id is required in the URL.' }));
        return;
      }
      const settings = readDecisionOsSettings({ action_payload: { decisionOsRoot }, runtime_state: requestRuntime }).settings as AnyRecord;
      const configured = normalizedConcurrentCodexProcesses(settings.maxConcurrentCodexProcesses) ?? 1;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, maxConcurrentCodexProcesses: Number.isInteger(configured) ? configured : 1, minimum: 1, maximum: 32 }));
      return;
    }
    if (url === '/api/settings/codex-processes' && request.method === 'PATCH') {
      if (!projectScope && projects.length !== 1) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'Project id is required in the URL.' }));
        return;
      }
      const bodyBuffer = await readRequestBuffer(request);
      let body: AnyRecord = {};
      try {
        body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
      } catch {
        body = {};
      }
      const result = saveCodexProcessSettings({ decisionOsRoot, runtime: requestRuntime, maxConcurrentCodexProcesses: body.maxConcurrentCodexProcesses });
      if (result.ok === true) void scheduleCodexProcesses({ decisionOsRoot, runtime: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/decision-os/projects' && request.method === 'GET') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ projects }));
      return;
    }
    if (url === '/decision-os/projects' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      try {
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        const project = createDecisionOsProject({
          masterRoot,
          masterDecisionOsRoot,
          name: String(body.name ?? ''),
          description: String(body.description ?? ''),
        });
        projectCatalogCache = { expiresAt: 0, projects: [] };
        projectContext(project.decisionOsRoot, project.id);
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
        const project = saveProjectMetadata({
          masterDecisionOsRoot,
          projects,
          projectId,
          name: String(body.name ?? ''),
          description: String(body.description ?? ''),
          color: String(body.color ?? ''),
        });
        projectCatalogCache = { expiresAt: 0, projects: [] };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, project }));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Project update failed.' }));
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
    if (url === '/api/codex/pipelines' && request.method === 'GET') {
      const result = listCodexPipelinesController({ runtime_state: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/codex/pipelines' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const savePayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      const result = saveCodexPipelineController({ action_payload: { ...savePayload, operation: 'create' }, runtime_state: requestRuntime });
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
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url.startsWith('/api/codex/skill-library/') && request.method === 'GET') {
      const skillName = decodeRouteSegment(url.slice('/api/codex/skill-library/'.length));
      const result = readCodexSkillLibraryController({ action_payload: { skillName }, runtime_state: requestRuntime });
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
      const result = saveCodexSkillLibraryController({ action_payload: { ...savePayload, skillName }, runtime_state: requestRuntime });
      response.setHeader('content-type', 'application/json');
      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
      response.end(JSON.stringify(result));
      return;
    }
    if (url === '/api/codex/skills' && request.method === 'GET') {
      const skills = readCodexSkillCatalog({ decisionOsRoot, runtime: requestRuntime }).skills;
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
      const imageFileRef = `.decision-os/thread-images/${threadId}/${fileName}`;
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
        const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & {
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
          response.end(JSON.stringify(loadLedgerContentFiles(overview.document, decisionOsRoot)));
          return;
        }
        if (isLedgersCanvas && mutation.action === 'patch-card' && mutation.cardPatch?.id && typeof mutation.cardPatch.title === 'string') {
          const rename = renameLinkedLedger({ decisionOsRoot, cardId: mutation.cardPatch.id, title: mutation.cardPatch.title, overviewDocument: ledger });
          if (rename.ok === false) {
            response.statusCode = 404;
            response.end(JSON.stringify({ ok: false, error: rename.error }));
            return;
          }
          persistLedgerAndRespond(tabId, ledgerPath, ledger, response, decisionOsRoot);
          return;
        }
        if (isLedgersCanvas && mutation.action === 'delete-card' && mutation.cardId) {
          const deletion = deleteLinkedLedger({ decisionOsRoot, cardId: String(mutation.cardId), overviewDocument: ledger });
          if (deletion.ok === false) {
            response.statusCode = 404;
            response.end(JSON.stringify({ ok: false, error: deletion.error }));
            return;
          }
          persistLedgerAndRespond(tabId, ledgerPath, ledger, response, decisionOsRoot);
          return;
        }
        if (mutation.action === 'complete-master-task') {
          const completion = commitMasterTaskCompletion({ decisionOsRoot, ledgerPath, ledger, mutation });
          if (completion.ok === false) {
            response.statusCode = completion.error.statusCode;
            response.end(JSON.stringify(completion.error.body));
            return;
          }
          response.setHeader(ledgerRevisionHeader, String(ledgerRevisions.advance(tabId)));
          response.end(JSON.stringify(loadLedgerContentFiles(ledger, decisionOsRoot)));
          return;
        }
        const mutationResult = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation });
        if (mutationResult.error) {
          response.statusCode = mutationResult.error.statusCode;
          response.end(JSON.stringify(mutationResult.error.body));
          return;
        }
        persistLedgerAndRespond(tabId, ledgerPath, ledger, response, decisionOsRoot);
        return;
      }
      if (existsSync(ledgerPath)) {
        const ledger = isLedgersCanvas ? ensureLedgersCanvasDocument({ decisionOsRoot }).document : JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord;
        // WHAT: Expose reconciliation revisions only for ledger documents.
        // WHY: The project-state response is not an active canvas ledger.
        if (tabId !== 'state') response.setHeader(ledgerRevisionHeader, String(ledgerRevisions.current(tabId)));
        response.end(JSON.stringify(tabId === 'state' ? { projectId: activeProject?.id ?? '', projectName: projectNameForDecisionOsRoot(decisionOsRoot), projectColor: activeProject?.color ?? '#38d9e8', ledgers: stateRead.ledgers } : loadLedgerContentFiles(ledger, decisionOsRoot)));
      } else {
        response.end(JSON.stringify({ ok: false, missing: ledgerPath }));
      }
      return;
    }
    const isCanvasSourceRoute = url.startsWith('/canvas-src/');
    const isCanvasAssetRoute = url.startsWith('/canvas-assets/');
    const isFrontendModuleRoute = url.startsWith('/assets/') || url.startsWith('/src/');
    // WHAT: Serve `/shared/*` imports from the source tree beside the configured frontend root.
    // WHY: Browser modules consume authoritative shared schemas whose `.js` URLs must resolve to sibling `.ts` sources.
    const isSharedModuleRoute = url.startsWith('/shared/');
    const isStaticModuleRoute = isFrontendModuleRoute || isSharedModuleRoute || isCanvasSourceRoute || isCanvasAssetRoute;
    const routeTabId = url.split('/').filter(Boolean)[0] ?? '';
    if (!projectScope && request.method === 'GET' && routeTabId && !['projects', 'ledgers', 'pipelines', 'skills', 'control-room'].includes(routeTabId)) {
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
      || /^\/projects\/[^/]+$/.test(requestPath)
      || requestPath === '/ledgers'
      || requestPath === '/pipelines'
      || requestPath === '/skills';
    const isScopedAppRoute = Boolean(projectScope && projectScope.scopedPath.startsWith('/ledgers'));
    const isAppRoute = isGlobalAppRoute || isScopedAppRoute;
    const staticModuleRoot = isSharedModuleRoute
      ? resolve(frontendRoot, '..', 'shared')
      : isCanvasSourceRoute
        ? resolve(frontendRoot, '..', 'frontend', 'src')
        : isCanvasAssetRoute
          ? resolve(frontendRoot, '..', 'frontend', 'assets')
          : frontendRoot;
    const staticModuleRequest = isSharedModuleRoute
      ? url.slice('/shared/'.length)
      : isCanvasSourceRoute
        ? url.slice('/canvas-src/'.length)
        : isCanvasAssetRoute
          ? url.slice('/canvas-assets/'.length)
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
  server.on('close', () => {
    for (const context of projectContexts.values()) {
      context.watcher.close();
      context.clients.clear();
    }
    globalContentEventClients.clear();
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}
