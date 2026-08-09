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
import type { RuntimeIncident } from '../../server/helper/runtime-incident-ledger.js';

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
  pausedFederationRepairs: Map<string, RuntimeIncident>;
  pausedTaskProjects: { has(projectId: string): boolean; set(projectId: string, incident: unknown): unknown };
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
  recordIncident: (incident: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    code?: string;
    context?: Record<string, unknown>;
  }) => unknown;
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
  const prioritizeAvailableContent = (): void => {
    const onlineByProject = new Map<string, string[]>();
    for (const project of input.federation()?.remoteProjects().filter((candidate) => candidate.online) ?? []) {
      const holders = onlineByProject.get(project.localProjectId) ?? [];
      holders.push(project.ownerNodeId);
      onlineByProject.set(project.localProjectId, [...new Set(holders)].sort());
    }
    for (const [projectId, holders] of onlineByProject) {
      const store = input.taskStoreForProject(projectId, holders[0]);
      // WHAT: Leave a catalog project without installed task state outside content scheduling.
      // WHY: Content demand must be derived from durable resource heads, not catalog presence alone.
      if (!store) continue;
      const heads = store.contentHeads().filter((head) => head.type === 'card-markdown' || head.type === 'thread-markdown');
      for (const holder of holders) {
        input.contentStore.applyManifest(holder, {
          version: 1,
          projectId,
          generatedAt: new Date().toISOString(),
          complete: false,
          resources: heads.map(({ sourceReplicaId: _sourceReplicaId, ...head }) => head),
        });
      }
      for (const head of heads) {
        const selected = holders.includes(head.sourceReplicaId) ? head.sourceReplicaId : holders[0];
        input.contentStore.prioritize(selected, projectId, head.key);
      }
    }
  };

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
      const requiredHeads = heads.filter((head) => (
        head.type === 'card-markdown' || head.type === 'thread-markdown'
      ));
      const onlineProjectHolders = [...new Set(input.federation()?.remoteProjects()
        .filter((project) => project.online && project.localProjectId === projectId)
        .map((project) => project.ownerNodeId) ?? [])].sort();
      const contentSources = new Set([
        ...requiredHeads.map((head) => head.sourceReplicaId),
        ...onlineProjectHolders,
      ]);
      for (const sourceNodeId of contentSources) {
        input.contentStore.applyManifest(sourceNodeId, {
          version: 1,
          projectId,
          generatedAt: new Date().toISOString(),
          complete: false,
          resources: requiredHeads
            .map(({ sourceReplicaId: _sourceReplicaId, ...head }) => head),
        });
      }
      for (const head of requiredHeads) {
        // WHAT: Keep retained content provenance deferred while no serving project holder is online.
        // WHY: An offline replica identity is not executable fetch authority and must not create retrying demand.
        if (onlineProjectHolders.length === 0) continue;
        const selectedSource = onlineProjectHolders.includes(head.sourceReplicaId)
          ? head.sourceReplicaId
          : onlineProjectHolders[0];
        input.contentStore.prioritize(selectedSource, projectId, head.key);
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
    onRepairTimeout: ({ projectId, from, attemptId }) => {
      const incident = input.recordIncident({
        scope: `project-task-state:${projectId}`,
        component: 'federation-task-state-replicator',
        operation: 'synchronize-federated-state',
        code: 'federation_state_no_progress',
        error: new Error(`Federated state made no durable progress for ${projectId}.`),
        context: { projectId, from, attemptId },
      });
      input.pausedTaskProjects.set(projectId, incident);
    },
    onRepairCollision: ({ projectId, from, attemptId, deliveryId, relayRoot, rejected, evidence }) => {
      const incident = input.recordIncident({
        scope: `federation-repair:${projectId}`,
        component: 'federation-task-state-replicator',
        operation: 'terminal-state-collision',
        code: 'task_current_dot_collision',
        error: new Error(`task_current_dot_collision:${projectId}`),
        context: {
          projectId,
          from,
          attemptId,
          deliveryId,
          relayRoot,
          rejected,
          evidenceKeys: evidence.map((entry) => `${entry.deliveryId}\u0000${entry.key}`).sort(),
        },
      }) as RuntimeIncident;
      input.pausedFederationRepairs.set(projectId, incident);
    },
  });

  for (const [projectId, incident] of input.pausedFederationRepairs) {
    const attemptId = String(incident.context.attemptId ?? '');
    const from = String(incident.context.from ?? 'relay');
    const rejected = Array.isArray(incident.context.rejected) ? incident.context.rejected : [];
    const state = input.projectStates.get(projectId) ?? input.federatedProjectStates.get(projectId);
    const retained = state?.store.repairCollisionEvidence(attemptId) ?? [];
    // WHAT: Restore automatic-repair suppression only from matching durable store evidence.
    // WHY: A malformed incident must remain visibly paused without granting transient recovery authority.
    if (attemptId && retained.length > 0) replicator.restoreTerminalRepair(projectId, from, attemptId, rejected, String(incident.context.relayRoot ?? ''));
  }

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

  return { contentScheduler, prioritizeAvailableContent, reconcileMergeableTaskConflicts, replicator };
}
