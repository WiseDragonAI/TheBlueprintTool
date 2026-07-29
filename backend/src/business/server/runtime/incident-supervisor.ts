/**
 * WHAT: Restores durable runtime pauses and owns incident recording for server scopes.
 * WHY: Failure containment must remain available independently of project and route startup.
 */
import { telemetry } from '@backend/telemetry/harness.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import {
  RuntimeScopePausedError,
  type RuntimeIncident,
  type RuntimeIncidentLedger,
} from '../helper/runtime-incident-ledger.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';

type AnyRecord = Record<string, unknown>;

export function isExecutionScopedCodexFailure(operation: string): boolean {
  return operation === 'codex-execution-timeout'
    || operation === 'adopted-codex-execution-timeout'
    || operation === 'adopted-pipeline-execution-timeout'
    || operation === 'task-execution-dispatch-failed'
    || operation === 'task-execution-cancellation-notification'
    || operation === 'monitor-adopted-task-execution-ingest'
    || operation === 'monitor-adopted-task-execution-notification';
}

export function createIncidentSupervisor(input: {
  incidentLedger: RuntimeIncidentLedger;
}) {
  const pausedTaskProjects = new Map<string, RuntimeIncident>();
  const pausedFederatedTaskProjects = new Map<string, RuntimeIncident>();
  const pausedBackgroundComponents = new Set<string>();
  const pausedProjectWatchers = new Set<string>();
  const pausedProjectRuntimes = new Set<string>();
  const taskProjectsPendingFrameIncidentRevalidation = new Map<string, RuntimeIncident>();
  let globalRuntimeIncident: RuntimeIncident | null = null;

  for (const incident of input.incidentLedger.active()) {
    if (isTaskStateBootstrapGate(incident.code)
      && (incident.scope.startsWith('http-request:')
        || incident.scope.startsWith('project-task-write:')
        || incident.scope.startsWith('background:codex-startup-'))) {
      input.incidentLedger.resolveScope(
        incident.scope,
        'Transient task-state bootstrap gates do not pause runtime scopes.',
      );
      continue;
    }
    if (isTaskStateBootstrapGate(incident.code) && incident.scope.startsWith('background:codex-runtime:')) continue;
    if (incident.scope.startsWith('background:codex-runtime:') && isExecutionScopedCodexFailure(incident.operation)) continue;
    if (incident.scope === 'background:federated-library-sync'
      && (incident.code === 'federation_request_timeout' || /HTTP 504|request.+timeout/i.test(incident.message))) continue;
    if (incident.scope.startsWith('project-task-state:')) {
      const projectId = incident.scope.slice('project-task-state:'.length);
      if (incident.operation === 'handle-federated-state-frame') {
        taskProjectsPendingFrameIncidentRevalidation.set(projectId, incident);
      } else {
        pausedTaskProjects.set(projectId, incident);
      }
    }
    if (incident.scope.startsWith('federated-task-state:')) {
      pausedFederatedTaskProjects.set(incident.scope.slice('federated-task-state:'.length), incident);
    }
    if (incident.scope.startsWith('background:')) {
      pausedBackgroundComponents.add(incident.scope.slice('background:'.length));
    }
    if (incident.scope.startsWith('project-watcher:')) {
      pausedProjectWatchers.add(incident.scope.slice('project-watcher:'.length));
    }
    if (incident.scope.startsWith('project-runtime:')) {
      pausedProjectRuntimes.add(incident.scope.slice('project-runtime:'.length));
    }
    if (incident.scope === 'server-runtime') globalRuntimeIncident = incident;
  }

  const recordIncident = (incident: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    code?: string;
    context?: Record<string, unknown>;
    severity?: RuntimeIncident['severity'];
  }): RuntimeIncident => input.incidentLedger.record(incident);

  const recordStoppedOperation = (operation: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: Record<string, unknown>;
  }): string => {
    const incident = recordIncident({ severity: 'warning', ...operation });
    input.incidentLedger.resolveScope(
      incident.scope,
      'The failed operation stopped without changing project state.',
    );
    return incident.id;
  };

  const recordBackgroundFailure = (
    component: string,
    operation: string,
    error: unknown,
    context: Record<string, unknown> = {},
  ): RuntimeIncident => {
    pausedBackgroundComponents.add(component);
    return recordIncident({ scope: `background:${component}`, component, operation, error, context });
  };

  const assertCodexRuntimeAvailable = (runtime: AnyRecord): void => {
    if (runtime.codexRuntimePaused !== true) return;
    const component = `codex-runtime:${String(runtime.projectId ?? '')}`;
    const incident = input.incidentLedger.active(`background:${component}`)[0];
    if (incident) throw new RuntimeScopePausedError(incident.scope, incident.id);
    throw new Error(`Codex runtime ${String(runtime.projectId ?? '')} is paused without an active incident.`);
  };

  const pauseGlobalRuntime = (error: unknown, operation: string): void => {
    globalRuntimeIncident ??= recordIncident({
      severity: 'fatal',
      scope: 'server-runtime',
      component: 'node-process',
      operation,
      error,
    });
    telemetry('runtime-scope-paused', {
      scope: 'server-runtime',
      incidentId: globalRuntimeIncident.id,
      operation,
    });
  };

  const pauseTaskProject = (
    project: DecisionOsProject,
    error: unknown,
    operation: string,
  ): RuntimeScopePausedError => {
    const scope = `project-task-state:${project.id}`;
    const incident = pausedTaskProjects.get(project.id) ?? recordIncident({
      scope,
      component: 'task-current-state',
      operation,
      error,
      context: {
        projectId: project.id,
        projectName: project.name,
        decisionOsRoot: project.decisionOsRoot,
      },
    });
    pausedTaskProjects.set(project.id, incident);
    return new RuntimeScopePausedError(scope, incident.id);
  };

  return {
    assertCodexRuntimeAvailable,
    clearGlobalRuntimeIncident: () => { globalRuntimeIncident = null; },
    globalRuntimeIncident: () => globalRuntimeIncident,
    pauseGlobalRuntime,
    pauseTaskProject,
    pausedBackgroundComponents,
    pausedFederatedTaskProjects,
    pausedProjectRuntimes,
    pausedProjectWatchers,
    pausedTaskProjects,
    recordBackgroundFailure,
    recordIncident,
    recordStoppedOperation,
    taskProjectsPendingFrameIncidentRevalidation,
  };
}

export type IncidentSupervisor = ReturnType<typeof createIncidentSupervisor>;
