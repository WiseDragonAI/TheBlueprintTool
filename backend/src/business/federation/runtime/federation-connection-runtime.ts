/**
 * WHAT: Owns federation connector construction and remote observation callbacks.
 * WHY: Peer lifecycle, presentation publication, and replication triggers form one transport boundary.
 */
import type { ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
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
type PipelinePresentationExecutionState = {
  executions: {
    all: () => Array<{
      metadata: {
        executionId: string;
        pipelineRunId?: string | null;
        requestedAt: string;
      };
    }>;
  };
};
type PipelinePresentationSnapshotIdentity = {
  projectId: string;
  pipelineRunId: string;
  executionId: string;
};

export function pipelinePresentationSnapshotIdentities(
  states: Iterable<readonly [string, PipelinePresentationExecutionState]>,
): PipelinePresentationSnapshotIdentity[] {
  const pipelineRuns = new Map<string, PipelinePresentationSnapshotIdentity & { requestedAt: string }>();
  for (const [projectId, state] of states) {
    for (const record of state.executions.all()) {
      const pipelineRunId = record.metadata.pipelineRunId;
      // WHAT: Exclude direct skill executions from the historical pipeline presentation queue.
      // WHY: Only executions owned by a durable pipeline run can reconstruct a pipeline presentation.
      if (!pipelineRunId) continue;
      const key = `${projectId}\0${pipelineRunId}`;
      const prior = pipelineRuns.get(key);
      // WHAT: Retain the newest durable execution identity for each project-scoped pipeline run.
      // WHY: Repository order is not part of this selector's contract and project-local run IDs may collide.
      if (!prior
        || record.metadata.requestedAt > prior.requestedAt
        || (record.metadata.requestedAt === prior.requestedAt
          && record.metadata.executionId > prior.executionId)) {
        pipelineRuns.set(key, {
          projectId,
          pipelineRunId,
          executionId: record.metadata.executionId,
          requestedAt: record.metadata.requestedAt,
        });
      }
    }
  }
  return [...pipelineRuns.values()].map(({ requestedAt: _requestedAt, ...identity }) => identity);
}

export function createPipelinePresentationAudienceReplay(input: {
  cancel: () => void;
  publish: () => void;
}) {
  let onlineOwners = new Set<string>();
  return {
    onCatalog: (projects: readonly Pick<RemoteDecisionOsProject, 'online' | 'ownerNodeId'>[]): void => {
      // WHAT: Build the current audience from online owners only.
      // WHY: Retained offline catalog entries cannot receive a presentation replay.
      const currentOwners = new Set(projects.flatMap((project) => (
        project.online ? [project.ownerNodeId] : []
      )));
      // WHAT: Detect admission by comparing the current online set with the immediately preceding set.
      // WHY: Removals and duplicate catalogs require no replay, while re-admission after empty must replay.
      const hasNewAdmission = [...currentOwners].some((ownerNodeId) => !onlineOwners.has(ownerNodeId));
      onlineOwners = currentOwners;
      // WHAT: Cancel unfinished replay work when no remote consumer remains online.
      // WHY: Historical presentation reads have no recipient after the audience becomes empty.
      if (onlineOwners.size === 0) {
        input.cancel();
        return;
      }
      // WHAT: Replay once when at least one online owner has just been admitted.
      // WHY: Existing owners already received the retained presentation set represented by their prior catalog.
      if (hasNewAdmission) input.publish();
    },
    onDisconnected: (): void => {
      onlineOwners = new Set<string>();
      input.cancel();
    },
  };
}

export function createPipelinePresentationDispatchQueue(input: {
  publish: (identity: PipelinePresentationSnapshotIdentity) => void;
  recordFailure: (error: unknown, identity: PipelinePresentationSnapshotIdentity) => void;
}) {
  let pending: NodeJS.Immediate | null = null;
  let generation = 0;
  const cancel = (): void => {
    generation += 1;
    // WHAT: Remove the one pending event-loop turn owned by the superseded replay.
    // WHY: Disconnect and audience replacement must not continue reading historical pipeline state.
    if (pending) clearImmediate(pending);
    pending = null;
  };
  const dispatch = (identities: readonly PipelinePresentationSnapshotIdentity[]): void => {
    cancel();
    const activeGeneration = generation;
    const startedAt = performance.now();
    let index = 0;
    console.log(JSON.stringify({
      server: 'backend-federation',
      phase: 'historical-pipeline-presentations-queued',
      pipelineRunCount: identities.length,
    }));
    const runNext = (): void => {
      pending = null;
      // WHAT: Stop a replay superseded by disconnect or a newly admitted audience.
      // WHY: Only the latest audience generation may spend work on historical presentations.
      if (activeGeneration !== generation) return;
      const identity = identities[index];
      // WHAT: Record completion only after every selected pipeline received its own event-loop turn.
      // WHY: The receipt distinguishes bounded dispatch from the earlier synchronous startup loop.
      if (!identity) {
        console.log(JSON.stringify({
          server: 'backend-federation',
          phase: 'historical-pipeline-presentations-dispatched',
          pipelineRunCount: identities.length,
          elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
        }));
        return;
      }
      try {
        input.publish(identity);
      } catch (error) {
        // WHAT: Contain one synchronous presentation dispatch failure to its pipeline identity.
        // WHY: A corrupt historical run must not stop later presentations or the federation connection.
        input.recordFailure(error, identity);
      }
      index += 1;
      pending = setImmediate(runNext);
    };
    pending = setImmediate(runNext);
  };
  return { cancel, dispatch };
}

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
    const pipelineRuns = pipelinePresentationSnapshotIdentities([
      ...input.projectStates,
      ...input.federatedExecutionStates,
    ]);
    presentationDispatch.dispatch(pipelineRuns);
  };
  const presentationDispatch = createPipelinePresentationDispatchQueue({
    publish: (identity) => input.publishPipelineSnapshot(
      identity.projectId,
      identity.pipelineRunId,
      identity.executionId,
    ),
    recordFailure: (error, identity) => {
      input.recordStoppedOperation({
        scope: `pipeline-presentation-dispatch:${identity.projectId}:${identity.pipelineRunId}`,
        component: 'codex-pipeline-presentation',
        operation: 'dispatch-historical-pipeline-presentation',
        error,
        context: identity,
      });
    },
  });
  const presentationAudience = createPipelinePresentationAudienceReplay({
    cancel: presentationDispatch.cancel,
    publish: publishLocalExecutionPresentationSnapshots,
  });
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
      presentationAudience.onCatalog(connector?.remoteProjects() ?? []);
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
      // WHAT: Wait for the remote catalog before scheduling historical pipeline presentations.
      // WHY: A connected relay alone identifies no admitted consumer and its catalog callback owns one replay.
      if (!input.pausedBackgroundComponents.has('federated-library-sync')) {
        void input.federatedLibrary.synchronize().catch(() => undefined);
      }
    },
    onStateDisconnected: () => {
      presentationAudience.onDisconnected();
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
