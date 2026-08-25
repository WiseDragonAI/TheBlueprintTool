/**
 * WHAT: Creates the Decision OS HTTP server, workspace routes, and scoped content event stream.
 * WHY: Ledger IO, SSE publication, and Codex process callbacks share one server lifecycle for the active workspace.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from '../helper/resolve-decision-os-root.js';
import { readDecisionOsSettings } from '../helper/read-decision-os-settings.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { NodeReleaseError } from '../../delivery/helper/node-release-store.js';
import { RuntimeScopePausedError } from '../helper/runtime-incident-ledger.js';
import { createRuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import { createNodeHttpListener } from '../http/create-node-http-listener.js';
import { createStartupRequestHandler } from '../http/create-startup-request-handler.js';
import { installFrontendTelemetryWebSocket } from '../http/frontend-telemetry-websocket.js';
import {
  buildDeliveryAdmissionState,
  buildDeliveryStatusEvidence,
} from '../../delivery/runtime/delivery-admission-state.js';
import { createDeliveryNodeRuntime } from '../../delivery/runtime/delivery-node-runtime.js';
import { createServerFederationRuntime } from '../runtime/server-federation-runtime.js';
import { createServerFoundationRuntime } from '../runtime/server-foundation-runtime.js';
import { createServerProjectRuntime } from '../runtime/server-project-runtime.js';
import { createGlobalRequestHandler } from '../http/create-global-request-handler.js';
import { createProjectRequestHandler } from '../http/create-project-request-handler.js';
import { createIncidentSupervisor } from '../runtime/incident-supervisor.js';

type AnyRecord = Record<string, unknown>;

export function createDecisionOsServer(
  input:
    | {
        action_payload?: AnyRecord;
        runtime_state?: AnyRecord;
        data_model?: AnyRecord;
      }
    | AnyRecord = {},
): Record<string, unknown> {
  telemetry('create-http-server', {
    role: 'helper',
    action: 'create-http-server',
  });
  const envelope = input as {
    action_payload?: AnyRecord;
    runtime_state?: AnyRecord;
    data_model?: AnyRecord;
  };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const port = Number(payload.port ?? runtime.port ?? 0);
  const configuredFrontendRoot =
    payload.decisionOsFrontendRoot ??
    payload.frontendRoot ??
    process.env.DECISION_OS_FRONTEND_ROOT ??
    runtime.decisionOsFrontendRoot;
  const frontendRoot = configuredFrontendRoot
    ? resolve(String(configuredFrontendRoot))
    : existsSync(resolve(process.cwd(), 'frontend'))
      ? resolve(process.cwd(), 'frontend')
      : resolve(process.cwd(), '..', 'frontend');
  const masterDecisionOsRoot = resolveDecisionOsRoot({
    action_payload: payload,
    runtime_state: runtime,
  });
  const masterRoot = dirname(masterDecisionOsRoot);
  const decisionOsRoot = masterDecisionOsRoot;
  const migrationAdmissionFile = resolve(masterDecisionOsRoot, 'runtime', 'epoch-4-migration-admission.json');
  const migrationAdmissionForProject = (projectId: string): AnyRecord | null => {
    if (!existsSync(migrationAdmissionFile)) return null;
    let migrationAdmission: AnyRecord;
    try {
      migrationAdmission = JSON.parse(readFileSync(migrationAdmissionFile, 'utf8')) as AnyRecord;
    } catch (error) {
      migrationAdmission = {
        phase: 'invalid',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (['verified', 'rolled-back'].includes(String(migrationAdmission.phase ?? ''))) return null;
    const projectIds = Array.isArray(migrationAdmission.projectIds)
      ? migrationAdmission.projectIds.map(String).filter(Boolean)
      : [];
    return projectIds.length === 0 || projectIds.includes(projectId) ? migrationAdmission : null;
  };
  runtime.decisionOsRoot = masterDecisionOsRoot;
  runtime.serverRoot = masterRoot;
  runtime.port = port;
  runtime.ledgerCliShimDirectory = ensureLedgerCliShim({
    masterDecisionOsRoot,
    launcher: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../bin/ledger-cli.mjs'),
    webpageLauncher: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../bin/download-webpage.mjs'),
  });
  if (payload.mode === 'dry-run') {
    return { ok: true, port, server: { listening: false, port } };
  }
  if (!runtime.decisionOsSettings || typeof runtime.decisionOsSettings !== 'object') {
    readDecisionOsSettings({
      action_payload: { ...payload, decisionOsRoot: masterDecisionOsRoot },
      runtime_state: runtime,
    });
  }
  let protectedScopes = (): Iterable<string> => [];
  const incidentLedger = createRuntimeIncidentLedger({
    decisionOsRoot: masterDecisionOsRoot,
    protectedScopes: () => protectedScopes(),
  });
  const incidentSupervisor = createIncidentSupervisor({ incidentLedger });
  protectedScopes = incidentSupervisor.protectedScopes;
  const { recordBackgroundFailure, recordIncident, recordStoppedOperation, scheduleFatalExit } = incidentSupervisor;
  const onUncaughtException = (error: Error): void => scheduleFatalExit(error, 'uncaught-exception');
  const onUnhandledRejection = (reason: unknown): void => scheduleFatalExit(reason, 'unhandled-rejection');
  process.on('uncaughtException', onUncaughtException);
  process.on('unhandledRejection', onUnhandledRejection);
  const startupHandleRequest = createStartupRequestHandler({
    controlRoomCacheFile: resolve(masterDecisionOsRoot, 'cache', 'control-room-v3.json'),
    frontendRoot,
    incidentLedger,
    incidentSupervisor,
    settings: runtime.decisionOsSettings,
  });
  let activeHandleRequest = startupHandleRequest;
  let projectBootstrapSettled = false;
  let serverClosed = false;
  let resolveRuntimeReady!: () => void;
  let rejectRuntimeReady!: (error: unknown) => void;
  const serverRuntimeReady = new Promise<void>((resolveReady, rejectReady) => {
    resolveRuntimeReady = resolveReady;
    rejectRuntimeReady = rejectReady;
  });
  void serverRuntimeReady.catch(() => undefined);
  Object.defineProperty(runtime, 'serverRuntimeReady', {
    value: serverRuntimeReady,
    configurable: true,
    enumerable: false,
  });
  let closeInitializedRuntime = (): void => undefined;
  let server: ReturnType<typeof createNodeHttpListener>;
  const initializeRuntime = async (): Promise<void> => {
    const foundation = createServerFoundationRuntime({
      incidentLedger,
      incidentSupervisor,
      masterDecisionOsRoot,
      masterRoot,
      migrationAdmissionForProject,
      runtime,
    });
    const {
      connections,
      contentStore: federationContentStore,
      executionObservations: federatedExecutionObservations,
      executionPresentations,
      executionRuntime,
      federatedSchedulerContexts,
      globalClients: globalContentEventClients,
      pipelinePresentations: federatedPipelinePresentations,
      projectCatalogStore,
      serverCloseAbort,
    } = foundation;
    const { pausedBackgroundComponents } = incidentSupervisor;

    const localTaskRuntime = executionRuntime.localTaskRuntime;
    const projectTaskStates = localTaskRuntime.states;
    const federatedTaskRuntime = executionRuntime.federatedTaskRuntime;
    const taskStoreForProject = executionRuntime.taskStoreForProject;
    const executionStateForProject = executionRuntime.executionStateForProject;
    const publishExecutionChange = executionRuntime.publishExecutionChange;
    const codexProcessCoordinator = executionRuntime.processCoordinator;
    const scheduleGlobalCodexProcesses = codexProcessCoordinator.schedule;
    const projectRuntimeRegistry = executionRuntime.projectRuntimeRegistry;
    const projectContexts = projectRuntimeRegistry.contexts;
    const disposeProjectContext = projectRuntimeRegistry.dispose;
    const federationRuntime = createServerFederationRuntime({
      foundation,
      masterDecisionOsRoot,
      masterRoot,
      port,
      runtime,
    });
    const {
      federation,
      federatedLibrary: federatedLibraryRuntime,
      localDecisionOsRoots,
      migrateProjectPipelines,
      projectCatalog,
      state: federationStateRuntime,
    } = federationRuntime;
    const federationTaskStateReplicator = federationStateRuntime.replicator;
    const federationContentScheduler = federationStateRuntime.contentScheduler;
    const projectRuntime = createServerProjectRuntime({
      foundation,
      federationRuntime,
      masterDecisionOsRoot,
      masterRoot,
      migrationAdmissionFile,
      runtime,
      runtimeIncidentReviewIntervalMs: Number(payload.runtimeIncidentReviewIntervalMs ?? 5_000),
    });
    const {
      bootstrapProjects,
      controlRoom: controlRoomProjectionStore,
      incidentReviewScheduler: runtimeIncidentReviewScheduler,
      projectSyncRuntime,
      reconcileProjectRuntimes,
      recoverRuntimeScope,
    } = projectRuntime;
    const activeProjectSyncController = projectSyncRuntime.controller;
    const deliveryAdmissionInput = () => ({
      contentStatus: () => federationContentStore.status(),
      executionStates: projectTaskStates.values(),
      federationPhase: federation.status().phase,
      incidentLedger,
      localNodeId: federation.localOwner().ownerNodeId,
      projectIds: projectCatalog()
        .filter((project) => project.available)
        .map((project) => project.id)
        .sort(),
      replicationStatus: () =>
        federationTaskStateReplicator?.diagnostics() ?? {
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
    const handleGlobalRequest = createGlobalRequestHandler({
      baseRuntime: runtime,
      contentStore: federationContentStore,
      controlRoom: () => controlRoomProjectionStore!,
      deliveryAdmissionState: () => buildDeliveryAdmissionState(deliveryAdmissionInput()),
      deliveryRuntime: deliveryNodeRuntime,
      executionObservations: federatedExecutionObservations,
      executionPresentations,
      executionRuntime,
      federatedPipelinePresentations,
      federatedSchedulerContexts,
      federation,
      federationState: federationStateRuntime,
      incidentLedger,
      incidentSupervisor,
      masterDecisionOsRoot,
      masterRoot,
      projectCatalogStore,
      projectSyncRuntime,
      recordBackgroundFailure,
      recordStoppedOperation,
      recoverRuntimeScope,
    });
    const handleProjectRequest = createProjectRequestHandler({
      baseRuntime: runtime,
      contentStore: federationContentStore,
      controlRoom: () => controlRoomProjectionStore!,
      executionPresentations,
      executionRuntime,
      federatedLibrary: federatedLibraryRuntime,
      federatedSchedulerContexts,
      federation,
      federationState: federationStateRuntime,
      frontendRoot,
      globalClients: globalContentEventClients,
      incidentSupervisor,
      localDecisionOsRoots,
      masterDecisionOsRoot,
      masterRoot,
      projectCatalogStore,
      projectSyncRuntime,
      reconcileProjectRuntimes,
      recordBackgroundFailure,
      recordIncident,
      restartServer: runtime.restartServer,
      serverCloseSignal: serverCloseAbort.signal,
    });
    const initializedHandleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      const requestPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      // WHAT: Serve only the admitted stale Control Room cache until initial project bootstrap settles.
      // WHY: The normal projection route may not reconstruct missing project state on the listener thread.
      if (!projectBootstrapSettled && request.method === 'GET' && requestPath === '/api/control-room') {
        await startupHandleRequest(request, response);
        return;
      }
      const globalRequest = await handleGlobalRequest(request, response);
      if (!('request' in globalRequest)) return;
      const activeProject = globalRequest.request.activeProject;
      // WHAT: Return loading for a project whose local task authority is not installed yet.
      // WHY: One slow project must not trigger synchronous hydration or prevent another ready project from serving.
      if (
        activeProject &&
        !localTaskRuntime.states.has(activeProject.id) &&
        !incidentSupervisor.pausedTaskProjects.has(activeProject.id)
      ) {
        void localTaskRuntime.prepareStateForProject(activeProject);
        response.statusCode = 503;
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            ok: false,
            error: 'project-runtime-loading',
            projectId: activeProject.id,
          }),
        );
        return;
      }
      // WHAT: Retain startup-safe static fallback until the initial project bootstrap group settles.
      // WHY: Global application delivery must not construct the master project runtime as an accidental fallback.
      if (!activeProject && !projectBootstrapSettled && request.method === 'GET') {
        await startupHandleRequest(request, response);
        return;
      }
      await handleProjectRequest(globalRequest.request, request, response);
    };
    const codexQueueScanTimer = setInterval(() => {
      if (!pausedBackgroundComponents.has('codex-process-scheduler'))
        void scheduleGlobalCodexProcesses().catch((error: unknown) =>
          recordBackgroundFailure('codex-process-scheduler', 'periodic-queue-scan', error),
        );
    }, 1_000);
    codexQueueScanTimer.unref?.();
    closeInitializedRuntime = (): void => {
      connections.serverClosing = true;
      serverCloseAbort.abort(new Error('server_closed'));
      clearInterval(codexQueueScanTimer);
      federatedLibraryRuntime.stop();
      runtimeIncidentReviewScheduler.stop();
      for (const context of projectContexts.values()) disposeProjectContext(context);
      globalContentEventClients.clear();
      federation.stop();
    };
    const telemetrySocket = installFrontendTelemetryWebSocket({
      decisionOsRoot: masterDecisionOsRoot,
      enabled: (runtime.decisionOsSettings as AnyRecord | undefined)?.frontendTelemetryWebSocketEnabled === true,
      server,
      recordFailure: (operation, error) => recordBackgroundFailure('frontend-telemetry', operation, error),
    });
    server.on('close', telemetrySocket.close);
    const address = server.address();
    federationRuntime.setListeningPort(address && typeof address === 'object' ? address.port : port);
    void runtimeIncidentReviewScheduler.run();
    activeHandleRequest = initializedHandleRequest;
    await bootstrapProjects();
    projectBootstrapSettled = true;
    federation.start();
  };
  server = createNodeHttpListener({
    handleRequest: (request, response) => activeHandleRequest(request, response),
    host: String(payload.host ?? '127.0.0.1'),
    onClose: () => {
      serverClosed = true;
      closeInitializedRuntime();
      process.off('uncaughtException', onUncaughtException);
      process.off('unhandledRejection', onUnhandledRejection);
    },
    onListening: () => {
      incidentLedger.resolveScope(
        'server-launcher',
        'The server child started and opened its HTTP listener successfully.',
      );
      // WHAT: Yield one event-loop turn before beginning server and project runtime construction.
      // WHY: Health, diagnostics, static routes, and the stale Control Room cache must be observable before bootstrap work starts.
      setImmediate(() => {
        // WHAT: Settle deferred initialization without constructing runtime resources after listener shutdown.
        // WHY: A server closed during the admission turn no longer owns project bootstrap work.
        if (serverClosed) {
          resolveRuntimeReady();
          return;
        }
        void initializeRuntime()
          .then(() => {
            incidentLedger.resolveScope(
              'server-runtime',
              'The complete server runtime initialized behind the active HTTP listener.',
            );
            resolveRuntimeReady();
          })
          .catch((error: unknown) => {
            recordIncident({
              severity: 'error',
              scope: 'server-runtime',
              component: 'server-runtime-bootstrap',
              operation: 'initialize-server-runtime',
              error,
              context: { masterDecisionOsRoot, masterRoot },
            });
            rejectRuntimeReady(error);
          });
      });
    },
    port,
    recordIncident,
    recordStoppedOperation,
  });
  Object.defineProperty(server, 'runtimeReady', {
    value: serverRuntimeReady,
    configurable: true,
    enumerable: false,
  });
  runtime.server = server;
  return { ok: true, port, server };
}

export const createHttpServer = createDecisionOsServer;
