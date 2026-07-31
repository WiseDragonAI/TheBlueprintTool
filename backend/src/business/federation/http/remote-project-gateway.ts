/**
 * WHAT: Routes a selected remote-only project through local replicas before relay proxy fallback.
 * WHY: Remote project admission and replica precedence form one federation gateway boundary.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { unifiedCodexQueuePosition } from '../../codex/helper/codex-process-scheduler.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { createFederationNodeConnector } from '../helper/federation-node-connector.js';
import type { createFederationTaskStateReplicator } from '../helper/federation-task-state-replicator.js';
import type { createFederationContentReplicaStore } from '../helper/federation-content-replica-store.js';
import type { createFederationContentScheduler } from '../helper/federation-content-scheduler.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import { handleRemoteExecutionRoutes } from './remote-execution-routes.js';
import {
  handleRemoteReplicaReadRoutes,
  remoteReplicaStateStatus,
} from './remote-replica-read-routes.js';
import { handleRemoteTaskMutationRoute } from './remote-task-mutation-route.js';

type AnyRecord = Record<string, unknown>;
type Execution = NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;
type RemoteProject = {
  ownerNodeId: string;
  localProjectId: string;
  name: string;
  color: string;
  ledgers: unknown;
  online: boolean;
};

export async function handleRemoteProjectGateway(input: {
  contentScheduler: ReturnType<typeof createFederationContentScheduler> | null;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  federation: ReturnType<typeof createFederationNodeConnector>;
  invalidateProject: (projectId: string, changes: readonly { entityType: string; entityId: string }[]) => void;
  localNodeId: string;
  masterDecisionOsRoot: string;
  ownerNodeId: string;
  pipelinePresentation: (projectId: string, runId: string, ownerNodeId: string) => AnyRecord | null;
  presentationRegistry: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  presentationRuntime: (executionId: string) => AnyRecord | null;
  projectId: string;
  remoteProject: RemoteProject | null;
  replicator: ReturnType<typeof createFederationTaskStateReplicator> | null;
  request: IncomingMessage;
  response: ServerResponse;
  revision: (projectId: string) => number;
  scopedPath: string;
  stateForProject: (projectId: string, ownerNodeId: string) => ProjectTaskState | null;
  storeForProject: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  url: URL;
  pausedContentScheduler: () => boolean;
  recordBackgroundFailure: (operation: string, error: unknown, context: AnyRecord) => void;
}): Promise<{ handled: boolean }> {
  if (!input.remoteProject) {
    input.response.statusCode = 404;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: false,
      error: 'replica_unknown',
      projectId: input.projectId,
      nodeId: input.ownerNodeId,
    }));
    return { handled: true };
  }
  const taskStore = input.storeForProject(input.projectId, input.ownerNodeId);
  const projection = taskStore && taskStore.diagnostics().entityCount > 0
    ? taskStore.projection()
    : null;
  const state = input.stateForProject(input.projectId, input.ownerNodeId);
  const executionRoute = await handleRemoteExecutionRoutes({
    localNodeId: input.localNodeId,
    ownerNodeId: input.ownerNodeId,
    pipelinePresentation: (runId) => input.pipelinePresentation(
      input.projectId,
      runId,
      input.ownerNodeId,
    ),
    presentationRegistry: input.presentationRegistry,
    presentationRuntime: input.presentationRuntime,
    recordBackgroundFailure: input.recordBackgroundFailure,
    projectId: input.projectId,
    projection,
    queuePosition: (record: Execution) => {
      if (record.lifecycle.executorNodeId !== input.localNodeId) return null;
      const runtime = input.presentationRuntime(record.metadata.executionId);
      return runtime
        ? unifiedCodexQueuePosition({
          decisionOsRoot: String(runtime.decisionOsRoot ?? ''),
          id: record.metadata.executionId,
          createdAt: record.metadata.requestedAt,
          runtime,
        })
        : null;
    },
    request: input.request,
    response: input.response,
    scopedPath: input.scopedPath,
    state,
    url: input.url,
  });
  if (executionRoute.handled) return executionRoute;
  const relayConvergence = input.replicator?.diagnostics().convergence.find((entry) => (
    entry.peerId === 'relay' && entry.projectId === input.projectId
  ));
  const replicaReadRoute = await handleRemoteReplicaReadRoutes({
    contentStore: input.contentStore,
    drainContent: input.contentScheduler?.drain ?? null,
    ownerNodeId: input.ownerNodeId,
    paused: input.pausedContentScheduler,
    projectId: input.projectId,
    projection,
    recordBackgroundFailure: input.recordBackgroundFailure,
    relayConvergence,
    remoteProject: input.remoteProject,
    request: input.request,
    response: input.response,
    scopedPath: input.scopedPath,
    taskStore,
  });
  if (replicaReadRoute.handled) return replicaReadRoute;
  const stateStatus = remoteReplicaStateStatus({
    online: input.remoteProject.online,
    relayConvergence,
    scopedPath: input.scopedPath,
    taskRoot: taskStore?.rootHash() ?? '',
    taskRootReady: Boolean(projection),
  });
  const mutationRoute = await handleRemoteTaskMutationRoute({
    contentStore: input.contentStore,
    drainContent: input.contentScheduler?.drain ?? null,
    invalidateProject: (changes) => input.invalidateProject(input.projectId, changes),
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    pendingPublication: () => (
      (input.replicator?.diagnostics().pendingDeliveryIds.length ?? 0) > 0
    ),
    projectId: input.projectId,
    request: input.request,
    response: input.response,
    revision: () => input.revision(input.projectId),
    scopedPath: input.scopedPath,
    state,
    stateStatus,
  });
  if (mutationRoute.handled) return mutationRoute;
  await input.federation.proxy(
    input.request,
    input.response,
    input.ownerNodeId,
    input.projectId,
    input.scopedPath,
  );
  return { handled: true };
}
