/**
 * WHAT: Resolves one explicitly requested paused runtime scope after revalidation.
 * WHY: Recovery branching belongs to runtime supervision, not HTTP dispatch.
 */
import type { IncidentSupervisor } from './incident-supervisor.js';
import type { RuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';

export async function resumeRuntimeScope(input: {
  incidentLedger: RuntimeIncidentLedger;
  incidentSupervisor: IncidentSupervisor;
  resolution: string;
  resumeBackground: (component: string) => Promise<boolean>;
  resumeFederatedTaskProject: (projectId: string) => boolean;
  resumeProjectRuntime: (projectId: string) => boolean;
  resumeProjectWatcher: (projectId: string) => boolean;
  resumeTaskProject: (projectId: string) => boolean;
  scope: string;
}) {
  let resumed = false;
  if (input.scope.startsWith('project-task-state:')) {
    resumed = input.resumeTaskProject(
      input.scope.slice('project-task-state:'.length),
    );
  } else if (input.scope.startsWith('federated-task-state:')) {
    resumed = input.resumeFederatedTaskProject(
      input.scope.slice('federated-task-state:'.length),
    );
  } else if (input.scope.startsWith('background:')) {
    const component = input.scope.slice('background:'.length);
    input.incidentSupervisor.pausedBackgroundComponents.delete(component);
    try {
      resumed = await input.resumeBackground(component);
    } catch (error) {
      input.incidentSupervisor.recordBackgroundFailure(
        component,
        'operator-resume-background-component',
        error,
      );
    }
  } else if (input.scope.startsWith('project-watcher:')) {
    resumed = input.resumeProjectWatcher(
      input.scope.slice('project-watcher:'.length),
    );
  } else if (input.scope.startsWith('project-runtime:')) {
    resumed = input.resumeProjectRuntime(
      input.scope.slice('project-runtime:'.length),
    );
  } else if (input.scope === 'server-runtime') {
    input.incidentSupervisor.clearGlobalRuntimeIncident();
    resumed = true;
  }
  const resolved = resumed
    ? input.incidentLedger.resolveScope(input.scope, input.resolution)
    : [];
  return {
    ok: resumed,
    scope: input.scope,
    resolvedIncidentIds: resolved.map((incident) => incident.id),
  };
}
