/**
 * WHAT: Owns task-state replication, conflict reconciliation, and content scheduling.
 * WHY: Federation state installation must remain independent from connector lifecycle and HTTP composition.
 */
import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';
import { resolveCardContentChange } from '../../refresh/helper/watch-card-content-files.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { TaskEntityChange } from '../../task-state/helper/task-current-state-types.js';
import type { createLocalTaskRuntime } from '../../task-state/runtime/local-task-runtime.js';
import type { createProjectCatalogStore } from '../../server/helper/project-catalog-store.js';
import type { createProjectRuntimeRegistry } from '../../server/runtime/project-runtime-registry.js';
import { createFederationContentScheduler } from '../helper/federation-content-scheduler.js';
import type { createFederationContentReplicaStore } from '../helper/federation-content-replica-store.js';
import type { createFederationNodeConnector } from '../helper/federation-node-connector.js';
import { createFederationTaskStateReplicator } from '../helper/federation-task-state-replicator.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';

type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;

export function createFederationStateRuntime(input: {
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  executionStateForProject: (projectId: string, ownerNodeId: string) => ExecutionState | null;
  federatedProjectStates: Map<string, ProjectTaskState>;
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
  globalClients: Set<ServerResponse>;
  invalidateProject: (
    projectId: string,
    entities?: readonly { entityType: string; entityId: string }[],
  ) => void;
  localTaskRuntime: ReturnType<typeof createLocalTaskRuntime>;
  pausedTaskProjects: { has(projectId: string): boolean };
  presentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  projectCatalogStore: ReturnType<typeof createProjectCatalogStore>;
  projectContexts: ReturnType<typeof createProjectRuntimeRegistry>['contexts'];
  projectStates: Map<string, ProjectTaskState>;
  publishExecutionChange: (change: {
    projectId: string;
    nodeId: string;
    executionId: string;
    record: ReturnType<ProjectTaskState['executions']['find']>;
    remote?: boolean;
  }) => void;
  recordBackgroundFailure: (
    component: string,
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ) => void;
  recordStoppedOperation: (operation: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: Record<string, unknown>;
  }) => unknown;
  scheduleCodex: () => Promise<unknown>;
  taskStoreForProject: (
    projectId: string,
    ownerNodeId?: string,
  ) => TaskCurrentStateStore | null;
}) {
  const reconcileMergeableTaskConflicts = (
    projectId: string,
    targets?: Array<{ entityType: TaskEntityChange['entityType']; entityId: string }>,
  ): void => {
    const state = input.projectStates.get(projectId) ?? input.federatedProjectStates.get(projectId);
    if (!state) return;
    void state.reconcileMergeableConflicts(targets).then((result) => {
      if (!result.changed) return;
      input.invalidateProject(projectId, result.localChanges);
      for (const executionId of new Set(result.localChanges
        .filter((change) => change.entityType === 'execution')
        .map((change) => change.entityId))) {
        input.publishExecutionChange({
          projectId,
          nodeId: input.federation()?.localOwner().ownerNodeId ?? 'local',
          executionId,
          record: state.executions.all()
            .find((candidate) => candidate.metadata.executionId === executionId) ?? null,
        });
      }
      for (const client of input.globalClients) {
        try {
          client.write(`event: ledger-content-change\ndata: ${JSON.stringify({
            remote: false,
            projectId,
            nodeId: input.federation()?.localOwner().ownerNodeId ?? 'local',
          })}\n\n`);
        } catch {
          // A disconnected client cannot fail durable conflict resolution.
        }
      }
    }).catch((error: unknown) => {
      input.recordStoppedOperation({
        scope: `task-conflict-reconciliation:${projectId}`,
        component: 'task-current-state',
        operation: 'reconcile-mergeable-conflicts',
        error,
        context: { projectId },
      });
    });
  };

  const replicator = createFederationTaskStateReplicator({
    stores: () => new Map([...input.projectStates]
      .filter(([projectId]) => !input.pausedTaskProjects.has(projectId))
      .map(([projectId, state]) => [projectId, state.store])),
    storeFor: input.taskStoreForProject,
    publish: (nodeId, frame) => input.federation()!.publishStateFrame(nodeId, frame),
    onProjectionChange: ({ projectId, from, delta }) => {
      const store = input.taskStoreForProject(projectId, from);
      const keys = delta.entities
        .filter((entity) => entity.entityType === 'resource')
        .map((entity) => entity.entityId);
      const heads = keys.flatMap((key) => store?.contentHeads(key) ?? []);
      for (const sourceReplicaId of new Set(heads.map((head) => head.sourceReplicaId))) {
        input.contentStore.applyManifest(sourceReplicaId, {
          version: 1,
          projectId,
          generatedAt: new Date().toISOString(),
          complete: false,
          resources: heads
            .filter((head) => head.sourceReplicaId === sourceReplicaId)
            .map(({ sourceReplicaId: _sourceReplicaId, ...head }) => head),
        });
      }
      const localProject = input.projectCatalogStore.projects()
        .find((project) => project.id === projectId && project.available);
      const context = localProject
        ? input.projectContexts.get(localProject.decisionOsRoot)
        : null;
      if (localProject && context) {
        for (const key of keys) {
          const scoped = resolveCardContentChange({
            decisionOsRoot: localProject.decisionOsRoot,
            taskProjection: () => input.projectStates.get(projectId)?.projection().ledger ?? null,
            change: {
              contentFile: key,
              file: resolve(
                localProject.decisionOsRoot,
                key.replace(/^\/?\.decision-os\//, ''),
              ),
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
          for (const client of context.clients) {
            try {
              client.write(message);
            } catch {
              // A disconnected client cannot fail replicated state installation.
            }
          }
        }
      }
      input.invalidateProject(projectId, delta.entities);
      for (const executionId of new Set(delta.entities
        .filter((entity) => entity.entityType === 'execution')
        .map((entity) => entity.entityId))) {
        const state = input.executionStateForProject(projectId, from);
        const record = state?.executions.all()
          .find((candidate) => candidate.metadata.executionId === executionId) ?? null;
        input.publishExecutionChange({
          projectId,
          nodeId: from,
          executionId,
          record,
          remote: true,
        });
        input.presentations.hydrateTerminalArtifacts(
          projectId,
          record?.lifecycle.executorNodeId ?? from,
          record,
          input.recordStoppedOperation,
        );
      }
      for (const client of input.globalClients) {
        client.write(`event: ledger-content-change\ndata: ${JSON.stringify({
          remote: true,
          projectId,
          nodeId: from,
        })}\n\n`);
      }
      reconcileMergeableTaskConflicts(projectId, delta.entities);
    },
    onProjectionError: ({ projectId, from, error }) => {
      input.recordStoppedOperation({
        scope: `federation-projection:${projectId}:${from}`,
        component: 'federation-task-state-replicator',
        operation: 'publish-projection-change',
        error,
        context: { projectId, from },
      });
    },
  });

  for (const [projectId, state] of input.projectStates) {
    input.localTaskRuntime.scheduleContentHeadRepair(projectId, state);
  }
  for (const projectId of new Set([
    ...input.projectStates.keys(),
    ...input.federatedProjectStates.keys(),
  ])) {
    reconcileMergeableTaskConflicts(projectId);
  }
  const contentScheduler = createFederationContentScheduler({
    store: input.contentStore,
    hasPriorityStateWork: () => {
      const diagnostics = replicator.diagnostics();
      return diagnostics.runtimeDirty.length > 0 || diagnostics.pendingDeliveryIds.length > 0;
    },
    fetchContent: async ({ ownerNodeId, projectId, key, hash }) => {
      const federation = input.federation();
      if (!federation) throw new Error('federation_connector_unavailable');
      const online = new Set(federation.remoteProjects()
        .filter((project) => project.online && project.localProjectId === projectId)
        .map((project) => project.ownerNodeId));
      const sources = [...new Set([
        ownerNodeId,
        ...input.contentStore.sources(projectId, key, hash),
      ])].filter((source) => online.has(source));
      const failures: string[] = [];
      for (const source of sources) {
        const result = await federation.requestToFile(
          source,
          `/api/federation/content-object?projectId=${encodeURIComponent(projectId)}&hash=${encodeURIComponent(hash)}`,
          input.contentStore.objectFile(hash),
          hash,
        );
        if (result.status === 200) return;
        failures.push(`${source}:${result.status}`);
      }
      throw new Error(`content_object_sources_failed:${failures.join(',') || 'none-online'}`);
    },
  });

  return { contentScheduler, reconcileMergeableTaskConflicts, replicator };
}
