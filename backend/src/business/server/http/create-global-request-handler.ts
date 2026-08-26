/**
 * WHAT: Adapts server capabilities into the global request admission stage.
 * WHY: Global routing dependencies must remain explicit without bloating the lifecycle root.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import type { createDeliveryNodeRuntime } from '../../delivery/runtime/delivery-node-runtime.js';
import type { buildDeliveryAdmissionState } from '../../delivery/runtime/delivery-admission-state.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederationStateRuntime } from '../../federation/runtime/federation-state-runtime.js';
import type { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import type { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import { resolveCatalogProject } from '../helper/project-catalog.js';
import type { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import type { RuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import type { IncidentSupervisor } from '../runtime/incident-supervisor.js';
import type { createServerExecutionRuntime } from '../runtime/server-execution-runtime.js';
import { handleGlobalRequestStage } from './global-request-stage.js';

type AnyRecord = Record<string, unknown>;
const federationNodeMessageTimeoutMs = 30 * 60_000;

export function createGlobalRequestHandler(input: {
  baseRuntime: AnyRecord;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  controlRoom: () => ReturnType<typeof createControlRoomProjectionStore>;
  deliveryAdmissionState: () => ReturnType<typeof buildDeliveryAdmissionState>;
  deliveryRuntime: ReturnType<typeof createDeliveryNodeRuntime>;
  executionObservations: Map<string, TaskExecutionObservation>;
  executionPresentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  executionRuntime: ReturnType<typeof createServerExecutionRuntime>;
  federatedPipelinePresentations: Map<string, AnyRecord>;
  federatedSchedulerContexts: Map<string, { root: string; runtime: AnyRecord }>;
  federation: ReturnType<typeof createFederationNodeConnector>;
  federationState: ReturnType<typeof createFederationStateRuntime>;
  incidentLedger: RuntimeIncidentLedger;
  incidentSupervisor: IncidentSupervisor;
  masterDecisionOsRoot: string;
  masterRoot: string;
  projectCatalogStore: ReturnType<typeof createProjectCatalogStore>;
  projectSyncRuntime: ReturnType<typeof createProjectSyncRuntime>;
  recordBackgroundFailure: (component: string, operation: string, error: unknown, context?: AnyRecord) => unknown;
  recordStoppedOperation: (operation: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: AnyRecord;
  }) => string;
  recoverRuntimeScope: (scope: string, resolution: string) => Promise<AnyRecord>;
}) {
  const projects = () => input.projectCatalogStore.projects();
  return (request: IncomingMessage, response: ServerResponse) =>
    handleGlobalRequestStage({
      controlRoom: {
        controlRoomProjectionStore: input.controlRoom(),
        executionObservation: (projectId, executionId, ownerNodeId) => {
          const observation = input.executionObservations.get(`${projectId}\0${executionId}\0${ownerNodeId}`) ?? null;
          if (!observation || Date.parse(observation.expiresAt) <= Date.now()) return null;
          return observation;
        },
        federation: input.federation,
        hydrateProject: (project) => {
          void input.executionRuntime.localTaskRuntime.prepareStateForProject(project).then((state) => {
            // WHAT: Install a demanded project runtime only after its off-thread task preparation succeeds.
            // WHY: Control Room reads must return cached state without synchronously hydrating the project.
            if (!state) return;
            input.executionRuntime.projectRuntimeRegistry.context(project.decisionOsRoot, project.id, state);
            input.controlRoom().invalidate(project.id);
          });
        },
        listProjectSyncRuns: () => input.projectSyncRuntime.store().list(),
        taskStoreForProject: input.executionRuntime.taskStoreForProject,
      },
      delivery: {
        admissionState: input.deliveryAdmissionState,
        consumeCapability: (capability) => input.federation.consumeDeliveryCapability(capability),
        dispatchRemote: (nodeId, command, signal) =>
          input.federation.requestDelivery(nodeId, command, {
            timeoutMs: 30_000,
            signal,
          }),
        localNodeId: input.federation.localOwner().ownerNodeId,
        projectScoped: false,
        runCommand: input.deliveryRuntime.run,
        settings: input.baseRuntime.decisionOsSettings,
        targetOnline: (nodeId) => input.federation.nodes().some((node) => node.nodeId === nodeId && node.online),
      },
      diagnostics: {
        incidentLedger: input.incidentLedger,
        incidentSupervisor: input.incidentSupervisor,
        settings: input.baseRuntime.decisionOsSettings,
      },
      federationLocalNodeId: () => input.federation.localOwner().ownerNodeId,
      gitReview: {},
      internalExecution: {
        artifactFile: (projectId, requesterNodeId, hash) => {
          const store = input.executionRuntime.taskStoreForProject(projectId, requesterNodeId);
          return store && /^[a-f0-9]{64}$/i.test(hash) ? resolve(store.root, 'objects', hash.slice(0, 2), hash) : '';
        },
        authenticateNode: (nodeId) => input.federation.nodes().some((node) => node.nodeId === nodeId && node.online),
        baseRuntime: (executionId, projectId) => {
          const project = projects().find((entry) => entry.id === projectId && entry.available);
          return (
            input.federatedSchedulerContexts.get(executionId)?.runtime ??
            (project
              ? input.executionRuntime.projectRuntimeRegistry.context(project.decisionOsRoot, project.id).runtime
              : input.baseRuntime)
          );
        },
        localNodeId: input.federation.localOwner().ownerNodeId,
        stateForProject: input.executionRuntime.executionStateForProject,
      },
      markdown: {
        masterRoot: input.masterRoot,
        projects: projects(),
        taskLedger: (project) => input.executionRuntime.localTaskRuntime.stateForProject(project).projection().ledger,
      },
      masterDecisionOsRoot: input.masterDecisionOsRoot,
      nodeMessages: {
        federation: input.federation,
        messageTimeoutMs: federationNodeMessageTimeoutMs,
        projectRuntime: (project) =>
          input.executionRuntime.projectRuntimeRegistry.context(project.decisionOsRoot, project.id).runtime,
        recordFailure: input.recordStoppedOperation,
      },
      projectAdmission: {
        authenticateNode: (nodeId) => input.federation.nodes().some((node) => node.nodeId === nodeId && node.online),
        recordFailure: input.recordStoppedOperation,
        router: input.executionRuntime.routerRegistry.forProject,
        runtime: (project) =>
          input.executionRuntime.projectRuntimeRegistry.context(project.decisionOsRoot, project.id).runtime,
      },
      projects,
      recovery: { resume: input.recoverRuntimeScope },
      remoteGateway: {
        contentScheduler: input.federationState.contentScheduler,
        contentStore: input.contentStore,
        federation: input.federation,
        invalidateProject: (projectId, changes) => input.controlRoom().invalidate(projectId, [...changes]),
        localNodeId: input.federation.localOwner().ownerNodeId,
        masterDecisionOsRoot: input.masterDecisionOsRoot,
        pausedContentScheduler: () =>
          input.incidentSupervisor.pausedBackgroundComponents.has('federation-content-scheduler'),
        pipelinePresentation: (projectId, runId, nodeId) =>
          input.federatedPipelinePresentations.get(`${projectId}\0${runId}\0${nodeId}`) ?? null,
        presentationRegistry: input.executionPresentations,
        presentationRuntime: (executionId) => input.federatedSchedulerContexts.get(executionId)?.runtime ?? null,
        recordBackgroundFailure: (operation, error, context) => {
          input.recordBackgroundFailure('federation-content-scheduler', operation, error, context);
        },
        remoteProject: (ownerNodeId, projectId) =>
          input.federation
            .remoteProjects()
            .find((project) => project.ownerNodeId === ownerNodeId && project.localProjectId === projectId) ?? null,
        replicator: input.federationState.replicator,
        revision: (projectId) =>
          input.executionRuntime.federatedTaskRuntime.revisionForProject(projectId).advance('tasks'),
        stateForProject: input.executionRuntime.federatedTaskRuntime.stateForProject,
        storeForProject: input.executionRuntime.federatedTaskRuntime.storeForProject,
      },
      request,
      resolveProject: (projectId) =>
        resolveCatalogProject({
          projects: projects(),
          projectId,
          fallbackDecisionOsRoot: input.masterDecisionOsRoot,
        }),
      response,
    });
}
