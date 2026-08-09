/**
 * WHAT: Owns federation connector construction and remote observation callbacks.
 * WHY: Peer lifecycle, presentation publication, and replication triggers form one transport boundary.
 */
import type { ServerResponse } from 'node:http';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { createFederationNodeConnector, type RemoteDecisionOsProject } from '../helper/federation-node-connector.js';
import type { createFederatedLibraryRuntime } from './federated-library-runtime.js';
import type { createFederationStateRuntime } from './federation-state-runtime.js';
import { createFederatedExecutionObservationHandler } from './federated-execution-observation-handler.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;
type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;

export function relayRepairProjectIds(projects: Array<Pick<RemoteDecisionOsProject, 'localProjectId'>>): string[] {
  return [...new Set(projects.map((project) => project.localProjectId).filter(Boolean))].sort();
}

export function createFederationConnectionRuntime(input: {
  catalogFile: string;
  executionObservations: Map<string, TaskExecutionObservation>;
  executionPresentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  executionStateForProject: (projectId: string, ownerNodeId: string) => ExecutionState | null;
  federatedExecutionStates: Map<string, ExecutionState>;
  federatedLibrary: ReturnType<typeof createFederatedLibraryRuntime>;
  globalClients: Set<ServerResponse>;
  invalidateProject: (projectId?: string) => void;
  localProjects: () => DecisionOsProject[];
  localServerUrl: () => string;
  pausedBackgroundComponents: Set<string>;
  pipelinePresentations: Map<string, AnyRecord>;
  projectStates: Map<string, ProjectTaskState>;
  publishPipelineSnapshot: (
    projectId: string,
    pipelineRunId: string,
    executionId: string,
  ) => void;
  recordBackgroundFailure: (
    component: string,
    operation: string,
    error: unknown,
    context?: AnyRecord,
  ) => void;
  recordStoppedOperation: (operation: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: AnyRecord;
  }) => unknown;
  resumeProjectSync: () => void;
  scheduleCodex: () => Promise<unknown>;
  settings: unknown;
  stateRuntime: ReturnType<typeof createFederationStateRuntime>;
  tryTaskStateForProject: (project: DecisionOsProject) => ProjectTaskState | null;
}) {
  let connector: ReturnType<typeof createFederationNodeConnector> | null = null;
  const publishLocalExecutionPresentationSnapshots = (): void => {
    const pipelineRuns = new Map<string, { projectId: string; executionId: string }>();
    for (const [projectId, state] of [
      ...input.projectStates,
      ...input.federatedExecutionStates,
    ]) {
      for (const record of state.executions.all()) {
        if (record.metadata.pipelineRunId) {
          pipelineRuns.set(record.metadata.pipelineRunId, {
            projectId,
            executionId: record.metadata.executionId,
          });
        }
      }
    }
    for (const [pipelineRunId, identity] of pipelineRuns) {
      input.publishPipelineSnapshot(identity.projectId, pipelineRunId, identity.executionId);
    }
  };
  const handleExecutionObservation = createFederatedExecutionObservationHandler({
    clients: input.globalClients,
    executionObservations: input.executionObservations,
    executionState: input.executionStateForProject,
    invalidateProject: input.invalidateProject,
    pipelinePresentations: input.pipelinePresentations,
    presentationRegistry: input.executionPresentations,
    recordStoppedOperation: input.recordStoppedOperation,
    sourceOwnsProject: (projectId, nodeId) => connector?.remoteProjects().some((project) => (
      project.ownerNodeId === nodeId && project.localProjectId === projectId
    )) === true,
  });
  connector = createFederationNodeConnector({
    settings: input.settings,
    localProjects: input.localProjects,
    localServerUrl: input.localServerUrl,
    catalogFile: input.catalogFile,
    onRemoteContentChange: () => {
      for (const client of input.globalClients) {
        client.write('event: ledger-content-change\ndata: {"remote":true}\n\n');
      }
    },
    onRemoteCatalogChange: () => {
      for (const project of input.localProjects().filter((entry) => entry.available)) {
        input.tryTaskStateForProject(project);
      }
      input.invalidateProject();
      input.stateRuntime.replicator.reconcileRelay();
      const projectIds = relayRepairProjectIds(connector?.remoteProjects() ?? []);
      for (const projectId of projectIds) {
        input.stateRuntime.replicator.reconcileProject('relay', projectId);
      }
      input.stateRuntime.prioritizeAvailableContent();
      publishLocalExecutionPresentationSnapshots();
      if (!input.pausedBackgroundComponents.has('federated-library-sync')) {
        void input.federatedLibrary.synchronize().catch(() => undefined);
      }
      input.resumeProjectSync();
    },
    onStateFrame: async (frame) => {
      try {
        const operation = input.stateRuntime.replicator.handleFrame(frame);
        // WHAT: Let correlated relay repair frames fill their existing bounded transport window.
        // WHY: Awaiting the first frame here would prevent the receiver from sharing one WAL fsync across the group.
        if (frame.type === 'state-entity-batch' && frame.from === 'relay'
          && typeof (frame.payload as Record<string, unknown> | undefined)?.attemptId === 'string') {
          void operation.catch((error: unknown) => input.recordStoppedOperation({
            scope: `federation-state-frame:${frame.projectId}:${frame.from}`,
            component: 'federation-task-state-replicator',
            operation: 'handle-enhanced-state-frame',
            error,
            context: { projectId: frame.projectId, frameType: frame.type, from: frame.from },
          }));
          return;
        }
        await operation;
        if (!input.pausedBackgroundComponents.has('codex-process-scheduler')) {
          void input.scheduleCodex().catch((error: unknown) => {
            input.recordBackgroundFailure(
              'codex-process-scheduler',
              'schedule-after-federated-state-frame',
              error,
              { projectId: frame.projectId, frameType: frame.type },
            );
          });
        }
        if (!input.pausedBackgroundComponents.has('federation-content-scheduler')) {
          void input.stateRuntime.contentScheduler.drain().catch((error: unknown) => (
            input.recordBackgroundFailure(
              'federation-content-scheduler',
              'drain-after-state-frame',
              error,
              { projectId: frame.projectId, frameType: frame.type },
            )
          ));
        }
      } catch (error) {
        input.recordStoppedOperation({
          scope: `federation-state-frame:${frame.projectId}:${frame.from}`,
          component: 'federation-task-state-replicator',
          operation: 'handle-state-frame',
          error,
          context: { projectId: frame.projectId, frameType: frame.type, from: frame.from },
        });
      }
    },
    onExecutionObservation: handleExecutionObservation,
    onStateConnected: () => {
      input.stateRuntime.replicator.reconcileRelay();
      const projectIds = relayRepairProjectIds(connector?.remoteProjects() ?? []);
      for (const projectId of projectIds) {
        input.stateRuntime.replicator.reconcileProject('relay', projectId);
      }
      publishLocalExecutionPresentationSnapshots();
      if (!input.pausedBackgroundComponents.has('federated-library-sync')) {
        void input.federatedLibrary.synchronize().catch(() => undefined);
      }
    },
    onStateDisconnected: () => {
      input.stateRuntime.replicator.disconnectPeer('relay');
    },
    onError: (error, context) => {
      // WHAT: Keep retained-catalog read and persistence failures active until explicit validated recovery.
      // WHY: These failures disable the durable remote catalog after the reporting callback has returned.
      if (context.operation === 'read-retained-project-catalog'
        || context.operation === 'persist-project-catalog') {
        input.recordBackgroundFailure(
          'federation-project-catalog',
          context.operation,
          error,
          { catalogFile: input.catalogFile },
        );
        return;
      }
      input.recordStoppedOperation({
        scope: `federation-operation:${context.operation}`,
        component: 'federation-node-connector',
        operation: context.operation,
        error,
        context: { frameType: context.frameType ?? '' },
      });
    },
  });
  return connector;
}
