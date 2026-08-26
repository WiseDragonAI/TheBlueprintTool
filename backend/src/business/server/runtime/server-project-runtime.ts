/**
 * WHAT: Creates hosted-project synchronization, recovery, projection, and incident-review lifecycles.
 * WHY: Project ownership and recovery must remain atomic and independent from HTTP listener wiring.
 */
import { resolve } from 'node:path';
import { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import { createRuntimeIncidentReviewScheduler } from '../helper/create-runtime-incident-review-scheduler.js';
import { runtimeIncidentReviewProjectId } from '../helper/synchronize-runtime-incident-review-task.js';
import { createRuntimeRecoveryService } from './runtime-recovery-service.js';
import type { createServerFederationRuntime } from './server-federation-runtime.js';
import type { createServerFoundationRuntime } from './server-foundation-runtime.js';

type AnyRecord = Record<string, unknown>;

export function createServerProjectRuntime(input: {
  foundation: ReturnType<typeof createServerFoundationRuntime>;
  federationRuntime: ReturnType<typeof createServerFederationRuntime>;
  masterDecisionOsRoot: string;
  masterRoot: string;
  migrationAdmissionFile: string;
  runtime: AnyRecord;
  runtimeIncidentReviewIntervalMs: number;
}) {
  const {
    connections,
    executionRuntime,
    globalClients,
    incidentLedger,
    incidentSupervisor,
    pendingAutomaticRecoveries,
    projectCatalogStore,
  } = input.foundation;
  const {
    federation,
    federatedLibrary,
    migrateProjectPipelines,
    projectCatalog,
    state: federationState,
  } = input.federationRuntime;
  const { pausedBackgroundComponents, recordBackgroundFailure, recordStoppedOperation } = incidentSupervisor;
  const localTaskRuntime = executionRuntime.localTaskRuntime;
  const projectRuntimeRegistry = executionRuntime.projectRuntimeRegistry;
  const projectSyncRuntime = createProjectSyncRuntime({
    catalog: projectCatalogStore,
    decisionOsRoot: input.masterDecisionOsRoot,
    federation,
    incidentLedger,
    masterRoot: input.masterRoot,
    onBackgroundFailure: recordBackgroundFailure,
    onRunChange: (run) => {
      connections.controlRoom?.invalidate();
      for (const client of globalClients) {
        client.write(
          `event: project-sync-change\\ndata: ${JSON.stringify({
            syncId: run.syncId,
            phase: run.phase,
            preparationPhase: run.preparationPhase,
          })}\\n\\n`,
        );
      }
    },
    paused: (component) => pausedBackgroundComponents.has(component),
    projectRuntime: (project) => projectRuntimeRegistry.context(project.decisionOsRoot, project.id).runtime,
    projects: projectCatalog,
  });
  input.federationRuntime.setProjectSyncResume(projectSyncRuntime.resume);
  const recovery = createRuntimeRecoveryService({
    codexCoordinator: executionRuntime.processCoordinator,
    contentObjectRoots: [resolve(input.masterDecisionOsRoot, 'cache', 'federation-content-current', 'objects')],
    contentScheduler: () => federationState.contentScheduler,
    federation,
    federatedLibrary,
    federatedTaskRuntime: executionRuntime.federatedTaskRuntime,
    incidentLedger,
    incidentSupervisor,
    initializePipelineCatalog: federatedLibrary.initialize,
    invalidateProject: (projectId) => connections.controlRoom?.invalidate(projectId),
    localNodeId: () => federation.localOwner().ownerNodeId,
    localTaskRuntime,
    migrationAdmissionFile: input.migrationAdmissionFile,
    migrateProjectPipelines,
    projectById: (projectId) =>
      projectCatalog().find((project) => project.id === projectId && project.available) ?? null,
    projectRuntimeRegistry,
    projectSyncRuntime,
    replicator: () => federationState.replicator,
  });
  connections.scheduleAutomaticRecovery = recovery.scheduleAutomaticTaskStateRecovery;
  for (const project of pendingAutomaticRecoveries.values()) {
    connections.scheduleAutomaticRecovery(project);
  }
  pendingAutomaticRecoveries.clear();
  Object.defineProperty(input.runtime, 'federationNodeConnector', {
    value: federation,
    configurable: true,
    enumerable: false,
  });
  const controlRoom = createControlRoomProjectionStore({
    cacheFile: resolve(input.masterDecisionOsRoot, 'cache', 'control-room-v3.json'),
    taskProjectionForProject: localTaskRuntime.projectionForProject,
    runtimeForProject: (project) => projectRuntimeRegistry.contexts.get(project.decisionOsRoot)?.runtime,
    taskEntityForProject: (project, entityType, entityId) =>
      localTaskRuntime.tryStateForProject(project)?.store.projectedEntity(entityType, entityId) ?? null,
    taskExecutionsForProject: (project) => localTaskRuntime.tryStateForProject(project)?.executions.all() ?? [],
    taskExecutionDiagnosticsForProject: (project) =>
      localTaskRuntime.tryStateForProject(project)?.executions.diagnostics() ?? [],
    taskExecutionForProject: (project, executionId) => {
      try {
        return localTaskRuntime.tryStateForProject(project)?.executions.find(executionId) ?? null;
      } catch {
        return null;
      }
    },
    taskRootForProject: (project) =>
      localTaskRuntime.tryStateForProject(project)?.store.rootHash() ?? `paused:${project.id}`,
  });
  connections.controlRoom = controlRoom;
  const bootstrapProjects = async (): Promise<void> => {
    // WHAT: Prepare task authority for every registered local project, including a retained incomplete catalog entry.
    // WHY: Runtime readiness must settle legacy and recoverable project state before its first request instead of deferring that work to HTTP.
    const projects = projectCatalog();
    await Promise.all(
      projects.map(async (project) => {
        const state = await localTaskRuntime.prepareStateForProject(project);
        // WHAT: Keep one failed or paused project outside runtime and watcher installation.
        // WHY: Independent project bootstrap must leave healthy projects and global routes available.
        if (!state) return;
        // WHAT: Keep unavailable catalog entries out of watcher and relay runtime publication after their task authority is admitted.
        // WHY: An incomplete project remains usable by compatibility routes but is not a healthy hosted project.
        if (!project.available) return;
        const context = projectRuntimeRegistry.tryContext(project, 'start-project-runtime', state);
        // WHAT: Publish project readiness only after task authority and its watcher are installed.
        // WHY: Control Room refresh and relay repair must not expose a half-constructed local runtime.
        if (!context) return;
        controlRoom.invalidate(project.id);
      }),
    );
    await Promise.all(projectRuntimeRegistry.startupTasks);
    // WHAT: Let watcher and recovered-execution invalidations publish before initial runtime readiness settles.
    // WHY: The first two Control Room reads after runtime readiness must observe the same admitted snapshot.
    await new Promise<void>((resolveSettled) => setImmediate(resolveSettled));
  };
  const reconcileProjectRuntimes = (): void => {
    const registered = projectCatalog();
    const activeRoots = new Set(
      registered.filter((project) => project.available).map((project) => project.decisionOsRoot),
    );
    for (const project of registered) {
      if (project.available) {
        projectRuntimeRegistry.tryContext(project, 'reconcile-project-runtime');
      }
    }
    for (const [root, context] of projectRuntimeRegistry.contexts) {
      if (activeRoots.has(root)) continue;
      projectRuntimeRegistry.dispose(context);
      projectRuntimeRegistry.contexts.delete(root);
    }
    controlRoom.reconcile(registered);
  };
  const incidentReviewScheduler = createRuntimeIncidentReviewScheduler({
    incidentLedger,
    intervalMs: input.runtimeIncidentReviewIntervalMs,
    targetProject: () =>
      projectCatalog().find((project) => project.available && project.id === runtimeIncidentReviewProjectId) ?? null,
    taskState: localTaskRuntime.stateForProject,
    assignedNodeId: () => federation.localOwner().ownerNodeId,
    paused: () => pausedBackgroundComponents.has('runtime-incident-review'),
    onChanged: (projectId) => controlRoom.invalidate(projectId),
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
  return {
    bootstrapProjects,
    controlRoom,
    incidentReviewScheduler,
    projectSyncRuntime,
    reconcileProjectRuntimes,
    recoverRuntimeScope: recovery.resume,
  };
}
