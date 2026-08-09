/**
 * WHAT: Creates the library, task-state, content, and transport federation runtimes.
 * WHY: Federation owns its synchronization graph and late connector binding as one capability.
 */
import { resolve } from 'node:path';
import { readCodexPipelineRunController } from '../../codex/controller/read-codex-pipeline-run-controller.js';
import { ensureMandatoryPipelinePrompts } from '../../codex/helper/mandatory-pipeline-prompts.js';
import { migrateLegacyProjectPipelines } from '../../codex/helper/server-pipeline-catalog.js';
import { createFederatedLibraryRuntime } from '../../federation/runtime/federated-library-runtime.js';
import { createFederationConnectionRuntime } from '../../federation/runtime/federation-connection-runtime.js';
import { createFederationStateRuntime } from '../../federation/runtime/federation-state-runtime.js';
import type { createServerFoundationRuntime } from './server-foundation-runtime.js';

type AnyRecord = Record<string, unknown>;

export function createServerFederationRuntime(input: {
  foundation: ReturnType<typeof createServerFoundationRuntime>;
  masterDecisionOsRoot: string;
  masterRoot: string;
  port: number;
  runtime: AnyRecord;
}) {
  const {
    connections,
    contentStore,
    executionObservations,
    executionPresentations,
    executionRuntime,
    federatedSchedulerContexts,
    globalClients,
    incidentLedger,
    incidentSupervisor,
    pipelinePresentations,
    projectCatalogStore,
  } = input.foundation;
  const {
    pausedBackgroundComponents,
    pausedTaskProjects,
    recordBackgroundFailure,
    recordIncident,
    recordStoppedOperation,
  } = incidentSupervisor;
  const projectCatalog = () => projectCatalogStore.projects();
  const localWorkspaceRoots = (): string[] => [
    input.masterRoot,
    ...projectCatalog().filter((project) => project.available).map((project) => project.root),
  ];
  const localDecisionOsRoots = (): string[] => [
    input.masterDecisionOsRoot,
    ...projectCatalog().filter((project) => project.available)
      .map((project) => project.decisionOsRoot),
  ];
  const migrateProjectPipelines = (): void => {
    migrateLegacyProjectPipelines({
      serverDecisionOsRoot: input.masterDecisionOsRoot,
      projectDecisionOsRoots: projectCatalog().filter((project) => project.available)
        .map((project) => project.decisionOsRoot),
    });
  };
  // WHAT: install and validate mandatory server prompts before legacy migration can dirty the shared registration store.
  // WHY: prompt bootstrap requires a clean registration boundary so its focused Git commit cannot absorb migration writes.
  if (!pausedBackgroundComponents.has('pipeline-catalog')) {
    try {
      ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: input.masterDecisionOsRoot });
    } catch (error) {
      recordBackgroundFailure('pipeline-catalog', 'initialize-mandatory-pipeline-prompts', error);
    }
  }
  // WHAT: run legacy pipeline migration only while its owning background component is available.
  // WHY: a retained migration incident must continue to contain mutations to that scope.
  if (!pausedBackgroundComponents.has('pipeline-migration')) {
    try {
      migrateProjectPipelines();
    } catch (error) {
      recordBackgroundFailure('pipeline-migration', 'migrate-legacy-project-pipelines', error);
    }
  }
  const federatedLibrary = createFederatedLibraryRuntime({
    clearPaused: (component) => pausedBackgroundComponents.delete(component),
    federation: () => connections.federation,
    incidentLedger,
    localDecisionOsRoots,
    localWorkspaceRoots,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    masterRoot: input.masterRoot,
    paused: (component) => pausedBackgroundComponents.has(component),
    recordBackgroundFailure,
    recordIncident,
    runtime: input.runtime,
  });
  if (!pausedBackgroundComponents.has('pipeline-catalog')) {
    try {
      federatedLibrary.initialize();
    } catch (error) {
      recordBackgroundFailure('pipeline-catalog', 'initialize-pipeline-catalog', error);
    }
  }
  const state = createFederationStateRuntime({
    contentStore,
    executionStateForProject: executionRuntime.executionStateForProject,
    federatedProjectStates: executionRuntime.federatedTaskRuntime.projectStates,
    federation: () => connections.federation,
    globalClients,
    invalidateProject: (projectId, entities) => connections.controlRoom?.invalidate(
      projectId,
      entities ? [...entities] : undefined,
    ),
    localTaskRuntime: executionRuntime.localTaskRuntime,
    pausedFederationRepairs: incidentSupervisor.pausedFederationRepairs,
    pausedTaskProjects,
    presentations: executionPresentations,
    projectCatalogStore,
    projectContexts: executionRuntime.projectRuntimeRegistry.contexts,
    projectStates: executionRuntime.localTaskRuntime.states,
    publishExecutionChange: executionRuntime.publishExecutionChange,
    recordBackgroundFailure,
    recordIncident,
    recordStoppedOperation,
    scheduleCodex: executionRuntime.processCoordinator.schedule,
    taskStoreForProject: executionRuntime.taskStoreForProject,
  });
  connections.replicator = state.replicator;
  connections.contentScheduler = state.contentScheduler;
  let serverPort = input.port;
  let resumeProjectSync: (() => void) | null = null;
  connections.publishPipelineSnapshot = (projectId, pipelineRunId, executionId): void => {
    const project = projectCatalog().find((entry) => entry.id === projectId && entry.available);
    const runtime = project
      ? executionRuntime.projectRuntimeRegistry.contexts.get(project.decisionOsRoot)?.runtime
      : null;
    if (!project || !runtime || !connections.federation || !pipelineRunId) return;
    void readCodexPipelineRunController({
      action_payload: { runId: pipelineRunId },
      runtime_state: runtime,
    }).then((result) => {
      if (result.ok !== true) return;
      connections.federation?.publishExecutionObservation(projectId, {
        executionId,
        pipeline: { runId: pipelineRunId, result },
      });
    }).catch((error: unknown) => {
      recordStoppedOperation({
        scope: `pipeline-presentation-publish:${projectId}:${pipelineRunId}`,
        component: 'codex-pipeline-presentation',
        operation: 'publish-pipeline-presentation-snapshot',
        error,
        context: { projectId, pipelineRunId, executionId },
      });
    });
  };
  const federation = createFederationConnectionRuntime({
    catalogFile: resolve(input.masterDecisionOsRoot, 'cache', 'federation-project-catalog.json'),
    executionObservations,
    executionPresentations,
    executionStateForProject: executionRuntime.executionStateForProject,
    federatedExecutionStates: executionRuntime.federatedTaskRuntime.executionStates,
    federatedLibrary,
    globalClients,
    invalidateProject: (projectId) => connections.controlRoom?.invalidate(projectId),
    localProjects: projectCatalog,
    localServerUrl: () => `http://127.0.0.1:${serverPort}`,
    pausedBackgroundComponents,
    pipelinePresentations,
    projectStates: executionRuntime.localTaskRuntime.states,
    publishPipelineSnapshot: (...args) => connections.publishPipelineSnapshot(...args),
    recordBackgroundFailure,
    recordStoppedOperation,
    resumeProjectSync: () => resumeProjectSync?.(),
    scheduleCodex: executionRuntime.processCoordinator.schedule,
    settings: input.runtime.decisionOsSettings,
    stateRuntime: state,
    tryTaskStateForProject: executionRuntime.localTaskRuntime.tryStateForProject,
  });
  connections.federation = federation;
  for (const project of projectCatalog().filter((entry) => entry.available)) {
    executionRuntime.localTaskRuntime.tryStateForProject(project);
  }
  return {
    federation,
    federatedLibrary,
    localDecisionOsRoots,
    migrateProjectPipelines,
    projectCatalog,
    setListeningPort: (port: number) => {
      serverPort = port;
    },
    setProjectSyncResume: (resume: () => void) => {
      resumeProjectSync = resume;
    },
    state,
  };
}
