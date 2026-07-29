/**
 * WHAT: Owns hosted project runtime creation, startup recovery, lookup, and disposal.
 * WHY: Project lifecycle must be managed as a registry instead of lexical state in the HTTP composition root.
 */
import type { ServerResponse } from 'node:http';
import { stopAdoptedTaskExecutionMonitors } from '../../codex/helper/monitor-adopted-task-execution.js';
import { recoverTaskExecutions } from '../../codex/helper/recover-task-executions.js';
import { scheduleCodexRuntimeTimer, stopCodexRuntimeTimers } from '../../codex/helper/codex-runtime-run-store.js';
import { stopTaskExecutionCancellationDeadlines } from '../../codex/helper/task-execution-runtime.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import type { createTaskExecutionRouterRegistry } from '../../codex/runtime/task-execution-router-registry.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import { configureProjectCodexEvents } from '../../codex/runtime/configure-project-codex-events.js';
import type { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import { RuntimeScopePausedError } from '../helper/runtime-incident-ledger.js';
import { createProjectControllerRuntime } from './create-project-controller-runtime.js';
import { createProjectContentRuntime, type ProjectContentRuntime } from './project-content-runtime.js';

type AnyRecord = Record<string, unknown>;
export type ProjectRuntimeContext = ProjectContentRuntime & { runtime: AnyRecord };

export function createProjectRuntimeRegistry(input: {
  baseRuntime: AnyRecord;
  contentScheduler: () => ReturnType<typeof createFederationContentScheduler> | null;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
  globalClients: Set<ServerResponse>;
  incidentLedger: {
    active: () => AnyRecord[];
    resolveScope: (scope: string, resolution: string) => unknown;
  };
  invalidateProject: (projectId: string, changes?: readonly { entityType: string; entityId: string }[]) => void;
  isExecutionScopedFailure: (operation: string) => boolean;
  masterDecisionOsRoot: string;
  pausedBackgroundComponents: Set<string>;
  pausedProjectRuntimes: Set<string>;
  pausedProjectWatchers: Set<string>;
  pausedTaskProjects: { has: (projectId: string) => boolean };
  presentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  processCoordinator: ReturnType<typeof createCodexProcessCoordinator>;
  projectCatalogStore: ReturnType<typeof createProjectCatalogStore>;
  publishPipelineSnapshot: (projectId: string, pipelineRunId: string, executionId: string) => void;
  recordBackgroundFailure: (component: string, operation: string, error: unknown, context?: AnyRecord) => void;
  recordContentFailure: (project: DecisionOsProject, error: unknown, operation: string) => void;
  recordIncident: (input: AnyRecord) => { id: string; scope: string };
  recordStoppedOperation: (input: AnyRecord) => void;
  routerRegistry: ReturnType<typeof createTaskExecutionRouterRegistry>;
  scheduleCodex: () => Promise<unknown>;
  serverCloseSignal: AbortSignal;
  serverClosing: () => boolean;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  tryStateForProject: (project: DecisionOsProject) => ProjectTaskState | null;
}): {
  contexts: Map<string, ProjectRuntimeContext>;
  context: (
    decisionOsRoot: string,
    projectId: string,
    taskStateOverride?: ProjectTaskState | null,
  ) => ProjectRuntimeContext;
  dispose: (context: ProjectRuntimeContext) => void;
  startupTasks: Promise<void>[];
  tryContext: (
    project: DecisionOsProject,
    operation: string,
    taskStateOverride?: ProjectTaskState | null,
    recoveryScope?: 'project-watcher' | 'project-runtime' | '',
  ) => ProjectRuntimeContext | null;
} {
  const contexts = new Map<string, ProjectRuntimeContext>();
  const startupTasks: Promise<void>[] = [];
  const dispose = (context: ProjectRuntimeContext): void => {
    stopCodexRuntimeTimers(context.runtime);
    stopAdoptedTaskExecutionMonitors(context.runtime);
    stopTaskExecutionCancellationDeadlines(context.runtime);
    void context.watcher.close().catch((error: unknown) => {
      input.recordIncident({
        scope: `project-watcher:${String(context.runtime.projectId ?? 'unknown')}`,
        component: 'project-watcher',
        operation: 'dispose-project-context-watcher',
        error,
        context: {
          projectId: String(context.runtime.projectId ?? ''),
          decisionOsRoot: String(context.runtime.decisionOsRoot ?? ''),
        },
      });
    });
    for (const client of context.clients) {
      try {
        if (!client.writableEnded) client.end();
      } catch {
        client.destroy();
      }
    }
    context.clients.clear();
  };
  const context = (
    activeDecisionOsRoot: string,
    projectId: string,
    taskStateOverride: ProjectTaskState | null = null,
  ): ProjectRuntimeContext => {
    const existing = contexts.get(activeDecisionOsRoot);
    if (existing) return existing;
    const component = `codex-runtime:${projectId}`;
    const configured = createProjectControllerRuntime({
      activeDecisionOsRoot,
      baseRuntime: input.baseRuntime,
      contentScheduler: input.contentScheduler,
      contentStore: input.contentStore,
      federation: input.federation,
      invalidateProject: input.invalidateProject,
      masterDecisionOsRoot: input.masterDecisionOsRoot,
      pausedBackgroundComponents: input.pausedBackgroundComponents,
      pausedTaskProjects: input.pausedTaskProjects,
      processCoordinator: input.processCoordinator,
      project: () => input.projectCatalogStore.projects().find((entry) => entry.id === projectId) ?? null,
      projectId,
      recordBackgroundFailure: input.recordBackgroundFailure,
      recordStoppedOperation: input.recordStoppedOperation,
      routerRegistry: input.routerRegistry,
      serverCloseSignal: input.serverCloseSignal,
      stateForProject: input.stateForProject,
      taskStateOverride,
      tryStateForProject: input.tryStateForProject,
    });
    const content = createProjectContentRuntime({
      activeDecisionOsRoot,
      activeTaskState: configured.activeTaskState,
      globalClients: input.globalClients,
      invalidateProject: input.invalidateProject,
      pauseWatcher: (activeProjectId) => input.pausedProjectWatchers.add(activeProjectId),
      project: () => input.projectCatalogStore.projects()
        .find((entry) => entry.id === projectId && entry.available) ?? null,
      projectId,
      publishFederationChange: () => input.federation()?.publishContentChange(),
      publishPipelineSnapshot: input.publishPipelineSnapshot,
      recordContentFailure: (project, error) => input.recordContentFailure(
        project,
        error,
        'capture-watched-task-content',
      ),
      recordWatcherIncident: input.recordIncident,
      refreshProject: (activeProjectId) => input.projectCatalogStore.refresh(activeProjectId),
      serverClosing: input.serverClosing,
      stateForProject: input.stateForProject,
    });
    configureProjectCodexEvents({
      activeTaskState: configured.activeTaskState,
      invalidateProject: (changes) => input.invalidateProject(projectId, changes),
      presentations: input.presentations,
      projectId,
      publishLedger: content.publishLedger,
      runtime: configured.runtime,
      schedule: input.scheduleCodex,
    });
    const created = { ...content, runtime: configured.runtime };
    contexts.set(activeDecisionOsRoot, created);
    const startupComponent = `codex-startup-${projectId}`;
    const recover = async (recordBootstrapGate = true): Promise<void> => {
      try {
        await recoverTaskExecutions(configured.runtime);
        const scope = `background:${component}`;
        const retained = input.incidentLedger.active().filter((incident) => incident.scope === scope);
        if (retained.length > 0 && retained.every((incident) => (
          isTaskStateBootstrapGate(incident.code)
          || input.isExecutionScopedFailure(String(incident.operation ?? ''))
        ))) {
          input.incidentLedger.resolveScope(
            scope,
            'Replicated execution recovery completed; execution-scoped failures no longer pause the project runtime.',
          );
          input.pausedBackgroundComponents.delete(component);
          configured.runtime.codexRuntimePaused = false;
        }
        delete configured.runtime.taskStatePersistenceError;
      } catch (error) {
        configured.runtime.taskStatePersistenceError = error instanceof Error ? error.message : String(error);
        if (isTaskStateBootstrapGate(error)) {
          if (recordBootstrapGate) input.recordStoppedOperation({
            scope: `project-task-write:${projectId}`,
            component: startupComponent,
            operation: 'reconcile-codex-startup-state',
            error,
            context: { projectId, decisionOsRoot: activeDecisionOsRoot },
          });
          scheduleCodexRuntimeTimer(
            configured.runtime,
            'task-state-bootstrap-recovery',
            1_000,
            'retry-codex-startup-state',
            () => recover(false),
            { projectId, decisionOsRoot: activeDecisionOsRoot },
          );
          return;
        }
        input.recordBackgroundFailure(startupComponent, 'reconcile-codex-startup-state', error, {
          projectId,
          decisionOsRoot: activeDecisionOsRoot,
        });
      }
    };
    startupTasks.push(
      input.pausedTaskProjects.has(projectId)
        || input.pausedBackgroundComponents.has(startupComponent)
        || configured.runtime.codexRuntimePaused === true
        ? Promise.resolve()
        : recover(),
    );
    return created;
  };
  const tryContext = (
    project: DecisionOsProject,
    operation: string,
    taskStateOverride: ProjectTaskState | null = null,
    recoveryScope: 'project-watcher' | 'project-runtime' | '' = '',
  ): ProjectRuntimeContext | null => {
    if ((input.pausedProjectWatchers.has(project.id) && recoveryScope !== 'project-watcher')
      || (input.pausedProjectRuntimes.has(project.id) && recoveryScope !== 'project-runtime')) {
      return null;
    }
    try {
      return context(project.decisionOsRoot, project.id, taskStateOverride);
    } catch (error) {
      if (error instanceof RuntimeScopePausedError) return null;
      input.recordIncident({
        scope: `project-runtime:${project.id}`,
        component: 'project-runtime',
        operation,
        error,
        context: {
          projectId: project.id,
          projectName: project.name,
          decisionOsRoot: project.decisionOsRoot,
        },
      });
      input.pausedProjectRuntimes.add(project.id);
      return null;
    }
  };
  return { context, contexts, dispose, startupTasks, tryContext };
}
