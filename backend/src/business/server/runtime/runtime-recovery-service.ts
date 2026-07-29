/**
 * WHAT: Revalidates and resumes one explicitly selected paused runtime scope.
 * WHY: Recovery mutates capability lifecycle state and must remain independent from HTTP route composition.
 */
import { recoverTaskExecutions } from '../../codex/helper/recover-task-executions.js';
import type { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createFederatedTaskRuntime } from '../../task-state/runtime/federated-task-runtime.js';
import type { createLocalTaskRuntime } from '../../task-state/runtime/local-task-runtime.js';
import type { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import type { createProjectRuntimeRegistry } from './project-runtime-registry.js';
import type { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import type { createFederatedLibraryRuntime } from '../../federation/runtime/federated-library-runtime.js';
import type { createIncidentSupervisor } from './incident-supervisor.js';
import type { createRuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import { resumeRuntimeScope } from './resume-runtime-scope.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';

type AnyRecord = Record<string, unknown>;

export function createRuntimeRecoveryService(input: {
  codexCoordinator: ReturnType<typeof createCodexProcessCoordinator>;
  contentScheduler: () => ReturnType<typeof createFederationContentScheduler> | null;
  federatedLibrary: ReturnType<typeof createFederatedLibraryRuntime>;
  federatedTaskRuntime: ReturnType<typeof createFederatedTaskRuntime>;
  incidentLedger: ReturnType<typeof createRuntimeIncidentLedger>;
  incidentSupervisor: ReturnType<typeof createIncidentSupervisor>;
  initializePipelineCatalog: () => void;
  localTaskRuntime: ReturnType<typeof createLocalTaskRuntime>;
  migrateProjectPipelines: () => void;
  projectRuntimeRegistry: ReturnType<typeof createProjectRuntimeRegistry>;
  projectById: (projectId: string) => DecisionOsProject | null;
  projectSyncRuntime: ReturnType<typeof createProjectSyncRuntime>;
  replicator: () => ReturnType<typeof createFederationTaskStateReplicator> | null;
}): (scope: string, resolution: string) => Promise<AnyRecord> {
  const {
    pausedFederatedTaskProjects,
    pausedProjectRuntimes,
    pausedProjectWatchers,
    pausedTaskProjects,
  } = input.incidentSupervisor;
  return (scope, resolution) => resumeRuntimeScope({
    incidentLedger: input.incidentLedger,
    incidentSupervisor: input.incidentSupervisor,
    resolution,
    resumeBackground: async (component) => {
      if (component === 'pipeline-migration') input.migrateProjectPipelines();
      if (component === 'pipeline-catalog') input.initializePipelineCatalog();
      if (component === 'federated-library-sync') await input.federatedLibrary.synchronize();
      if (component === 'codex-process-scheduler') await input.codexCoordinator.schedule();
      if (component === 'federation-content-scheduler') {
        await input.contentScheduler()?.drain();
      }
      if (component === 'project-sync-store' || component === 'project-sync-runtime') {
        input.projectSyncRuntime.resume();
      }
      if (component.startsWith('codex-runtime:')) {
        const projectId = component.slice('codex-runtime:'.length);
        const context = [...input.projectRuntimeRegistry.contexts.values()]
          .find((candidate) => String(candidate.runtime.projectId ?? '') === projectId);
        if (!context) throw new Error(`Codex runtime ${projectId} is unavailable.`);
        try {
          await recoverTaskExecutions(context.runtime);
          context.runtime.codexRuntimePaused = false;
          await input.codexCoordinator.schedule();
        } catch (error) {
          context.runtime.codexRuntimePaused = true;
          throw error;
        }
      }
      if (component.startsWith('codex-startup-')) {
        const projectId = component.slice('codex-startup-'.length);
        const context = [...input.projectRuntimeRegistry.contexts.values()]
          .find((candidate) => String(candidate.runtime.projectId ?? '') === projectId);
        if (!context) throw new Error(`Project runtime ${projectId} is unavailable.`);
        await recoverTaskExecutions(context.runtime);
      }
      return true;
    },
    resumeFederatedTaskProject: (projectId) => {
      pausedFederatedTaskProjects.delete(projectId);
      input.federatedTaskRuntime.executionStates.delete(projectId);
      input.federatedTaskRuntime.taskStores.delete(projectId);
      const resumed = Boolean(input.federatedTaskRuntime.storeForProject(projectId, 'operator-resume'));
      if (resumed) input.replicator()?.reconcileProject('relay', projectId);
      return resumed;
    },
    resumeProjectRuntime: (projectId) => {
      const project = input.projectById(projectId);
      if (!project?.available) return false;
      pausedProjectRuntimes.delete(projectId);
      return Boolean(input.projectRuntimeRegistry.tryContext(
        project,
        'operator-resume-project-runtime',
      ));
    },
    resumeProjectWatcher: (projectId) => {
      const project = input.projectById(projectId);
      if (!project?.available) return false;
      pausedProjectWatchers.delete(projectId);
      const active = input.projectRuntimeRegistry.contexts.get(project.decisionOsRoot);
      if (active) input.projectRuntimeRegistry.dispose(active);
      input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
      return Boolean(input.projectRuntimeRegistry.tryContext(
        project,
        'operator-resume-project-runtime',
      ));
    },
    resumeTaskProject: (projectId) => {
      const project = input.projectById(projectId);
      if (!project?.available) return false;
      pausedTaskProjects.delete(projectId);
      input.localTaskRuntime.states.delete(projectId);
      let resumed = Boolean(input.localTaskRuntime.tryStateForProject(project));
      if (resumed) {
        const active = input.projectRuntimeRegistry.contexts.get(project.decisionOsRoot);
        if (active) input.projectRuntimeRegistry.dispose(active);
        input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
        resumed = Boolean(input.projectRuntimeRegistry.tryContext(
          project,
          'operator-resume-task-state',
        ));
      }
      if (resumed) input.replicator()?.reconcileProject('relay', projectId);
      return resumed;
    },
    scope,
  });
}
