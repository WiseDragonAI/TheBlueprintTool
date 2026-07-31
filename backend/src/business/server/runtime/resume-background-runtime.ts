/**
 * WHAT: Revalidates and resumes one paused background runtime component.
 * WHY: Background recovery has its own component dispatch and must not inflate project-state recovery.
 */
import { recoverTaskExecutions } from '../../codex/helper/recover-task-executions.js';
import type { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederatedLibraryRuntime } from '../../federation/runtime/federated-library-runtime.js';
import type { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import type { createIncidentSupervisor } from './incident-supervisor.js';
import type { createProjectRuntimeRegistry } from './project-runtime-registry.js';
import { telemetry } from '../../../telemetry/harness.js';

export async function resumeBackgroundRuntime(input: {
  activeIncidentIds: (scope: string) => string[];
  codexCoordinator: ReturnType<typeof createCodexProcessCoordinator>;
  component: string;
  contentScheduler: () => ReturnType<typeof createFederationContentScheduler> | null;
  federation: ReturnType<typeof createFederationNodeConnector>;
  federatedLibrary: ReturnType<typeof createFederatedLibraryRuntime>;
  incidentSupervisor: ReturnType<typeof createIncidentSupervisor>;
  initializePipelineCatalog: () => void;
  migrateProjectPipelines: () => void;
  projectRuntimeRegistry: ReturnType<typeof createProjectRuntimeRegistry>;
  projectSyncRuntime: ReturnType<typeof createProjectSyncRuntime>;
  resolution: string;
  resolveScope: (scope: string, resolution: string) => string[];
  scope: string;
}): Promise<string[]> {
  if (!input.incidentSupervisor.pausedBackgroundComponents.has(input.component)) return [];
  const activeIncidentIds = input.activeIncidentIds(input.scope);
  try {
    if (input.component === 'pipeline-migration') input.migrateProjectPipelines();
    else if (input.component === 'pipeline-catalog') input.initializePipelineCatalog();
    else if (input.component === 'federated-library-sync') {
      await input.federatedLibrary.synchronize();
    // WHAT: Reopen the retained project catalog only after its preserved bytes validate and a durable rewrite succeeds.
    // WHY: Merely clearing the incident would leave catalog persistence disabled for the process lifetime.
    } else if (input.component === 'federation-project-catalog') {
      input.federation.recoverRetainedProjectCatalog();
    } else if (input.component === 'codex-process-scheduler') {
      await input.codexCoordinator.schedule();
    } else if (input.component === 'federation-content-scheduler') {
      await input.contentScheduler()?.drain();
    } else if (
      input.component === 'project-sync-store'
      || input.component === 'project-sync-runtime'
    ) {
      input.projectSyncRuntime.resume();
    } else if (
      input.component.startsWith('codex-runtime:')
      || input.component.startsWith('codex-startup-')
    ) {
      const prefix = input.component.startsWith('codex-runtime:')
        ? 'codex-runtime:'
        : 'codex-startup-';
      const projectId = input.component.slice(prefix.length);
      const context = [...input.projectRuntimeRegistry.contexts.values()]
        .find((candidate) => String(candidate.runtime.projectId ?? '') === projectId);
      if (!context) throw new Error(`Codex runtime ${projectId} is unavailable.`);
      await recoverTaskExecutions(context.runtime);
      if (prefix === 'codex-runtime:') await input.codexCoordinator.schedule();
    } else {
      throw new Error(`runtime_background_scope_not_resumable:${input.component}`);
    }
    // WHAT: Accept a component-owned successful recovery when it already cleared its pause and incident.
    // WHY: Federated library synchronization resolves its incident atomically with installing synchronized state.
    if (!input.incidentSupervisor.pausedBackgroundComponents.has(input.component)) {
      telemetry('background-runtime-recovery-settled', {
        component: input.component,
        scope: input.scope,
        candidateIncidentIds: activeIncidentIds,
        resolvedIncidentIds: activeIncidentIds,
        finalPaused: false,
        outcome: 'component-recovered',
      });
      return activeIncidentIds;
    }
    const ids = input.resolveScope(input.scope, input.resolution);
    input.incidentSupervisor.pausedBackgroundComponents.delete(input.component);
    if (input.component.startsWith('codex-runtime:')) {
      const projectId = input.component.slice('codex-runtime:'.length);
      const context = [...input.projectRuntimeRegistry.contexts.values()]
        .find((candidate) => String(candidate.runtime.projectId ?? '') === projectId);
      if (context) context.runtime.codexRuntimePaused = false;
    }
    telemetry('background-runtime-recovery-settled', {
      component: input.component,
      scope: input.scope,
      candidateIncidentIds: activeIncidentIds,
      resolvedIncidentIds: ids,
      finalPaused: false,
      outcome: 'generic-recovered',
    });
    return ids;
  } catch (error) {
    input.incidentSupervisor.recordBackgroundFailure(
      input.component,
      'operator-resume-background-component',
      error,
    );
    telemetry('background-runtime-recovery-settled', {
      component: input.component,
      scope: input.scope,
      candidateIncidentIds: activeIncidentIds,
      resolvedIncidentIds: [],
      finalPaused: true,
      outcome: 'failed',
    });
    return [];
  }
}
