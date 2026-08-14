/**
 * WHAT: Revalidates, replaces, and resumes one explicitly selected runtime scope.
 * WHY: Recovery must install valid state and durable incident resolution before reopening admission.
 */
import { resolve } from 'node:path';
import { normalizeFederationStateRejection } from '../../../../../shared/federation-state-transport.js';
import type { TaskEntityType } from '../../../../../shared/task-current-state-core.js';
import { recoverTaskExecutions } from '../../codex/helper/recover-task-executions.js';
import type { createCodexProcessCoordinator } from '../../codex/runtime/codex-process-coordinator.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederatedLibraryRuntime } from '../../federation/runtime/federated-library-runtime.js';
import type { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import { recoverProjectTaskCurrentState } from '../../task-state/helper/recover-project-task-current-state.js';
import { createTaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { createFederatedTaskRuntime } from '../../task-state/runtime/federated-task-runtime.js';
import type { createLocalTaskRuntime } from '../../task-state/runtime/local-task-runtime.js';
import { tasksLedgerForProject, type DecisionOsProject } from '../helper/project-catalog.js';
import { hasPendingFederationRepair } from '../helper/federation-repair-recovery.js';
import type { createRuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import type { createIncidentSupervisor } from './incident-supervisor.js';
import type { createProjectRuntimeRegistry } from './project-runtime-registry.js';
import { resumeBackgroundRuntime } from './resume-background-runtime.js';

type AnyRecord = Record<string, unknown>;
const collisionRecoveryResolution = 'reconcile-local-authority';
const collisionRecoveryDeadlineMs = 15_000;

export function createRuntimeRecoveryService(input: {
  codexCoordinator: ReturnType<typeof createCodexProcessCoordinator>;
  contentObjectRoots: string[];
  contentScheduler: () => ReturnType<typeof createFederationContentScheduler> | null;
  federatedLibrary: ReturnType<typeof createFederatedLibraryRuntime>;
  federation: ReturnType<typeof createFederationNodeConnector>;
  federatedTaskRuntime: ReturnType<typeof createFederatedTaskRuntime>;
  incidentLedger: ReturnType<typeof createRuntimeIncidentLedger>;
  incidentSupervisor: ReturnType<typeof createIncidentSupervisor>;
  initializePipelineCatalog: () => void;
  invalidateProject: (projectId: string) => void;
  localNodeId: () => string;
  localTaskRuntime: ReturnType<typeof createLocalTaskRuntime>;
  migrationAdmissionFile: string;
  migrateProjectPipelines: () => void;
  projectById: (projectId: string) => DecisionOsProject | null;
  projectRuntimeRegistry: ReturnType<typeof createProjectRuntimeRegistry>;
  projectSyncRuntime: ReturnType<typeof createProjectSyncRuntime>;
  replicator: () => ReturnType<typeof createFederationTaskStateReplicator> | null;
}) {
  const automaticRecoveries = new Map<string, Promise<void>>();
  let automaticRecoveryTail: Promise<void> = Promise.resolve();

  const recoverCodex = (projectId: string, runtime: AnyRecord): void => {
    void recoverTaskExecutions(runtime)
      .then(() => input.codexCoordinator.schedule())
      .catch((error: unknown) => input.incidentSupervisor.recordBackgroundFailure(
        `codex-runtime:${projectId}`,
        'recover-codex-after-task-state-recovery',
        error,
        { projectId, decisionOsRoot: String(runtime.decisionOsRoot ?? '') },
      ));
  };

  const installLocalReplacement = (
    project: DecisionOsProject,
    operation: string,
    reconcile = true,
  ) => {
    const active = input.projectRuntimeRegistry.contexts.get(project.decisionOsRoot);
    if (active) input.projectRuntimeRegistry.dispose(active);
    input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
    input.localTaskRuntime.states.delete(project.id);
    const state = input.localTaskRuntime.openStateForProject(project);
    input.localTaskRuntime.states.set(project.id, state);
    const context = input.projectRuntimeRegistry.tryContext(project, operation, state);
    if (!context) {
      input.localTaskRuntime.states.delete(project.id);
      throw new Error(`project_context_recovery_failed:${project.id}`);
    }
    input.invalidateProject(project.id);
    // WHAT: Reconcile immediately for ordinary recovery and defer collision recovery until both pauses resolve.
    // WHY: A terminal collision marker must remain authoritative throughout replacement installation.
    if (reconcile) input.replicator()?.reconcileProject('relay', project.id);
    return context;
  };

  const scheduleAutomaticTaskStateRecovery = (project: DecisionOsProject): void => {
    if (automaticRecoveries.has(project.id)) return;
    const recovery = automaticRecoveryTail
      .catch(() => undefined)
      .then(async () => {
        let replacement: ReturnType<typeof input.projectRuntimeRegistry.tryContext> = null;
        try {
          const ledger = tasksLedgerForProject(project);
          await recoverProjectTaskCurrentState({
            decisionOsRoot: project.decisionOsRoot,
            projectId: project.id,
            nodeId: input.localNodeId(),
            defaultAssignedNodeId: input.localNodeId(),
            tasksLedgerFile: resolve(
              project.decisionOsRoot,
              ledger.ledgerFile.replace(/^\.decision-os\//, ''),
            ),
            admissionMarker: input.migrationAdmissionFile,
            contentObjectRoots: input.contentObjectRoots,
          });
          replacement = installLocalReplacement(project, 'automatic-task-state-recovery');
          const scope = `project-task-state:${project.id}`;
          const resolved = input.incidentLedger.resolveScope(
            scope,
            'Compatible legacy task state recovered automatically.',
          );
          if (resolved.length === 0) {
            throw new Error(`runtime_incident_resolution_not_persisted:${scope}`);
          }
          input.incidentSupervisor.pausedTaskProjects.delete(project.id);
          recoverCodex(project.id, replacement.runtime);
        } catch (error) {
          if (replacement) input.projectRuntimeRegistry.dispose(replacement);
          input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
          input.localTaskRuntime.states.delete(project.id);
          const sourceFingerprint = error && typeof error === 'object'
            && 'sourceFingerprint' in error
            ? String((error as { sourceFingerprint?: unknown }).sourceFingerprint ?? '')
            : '';
          input.incidentSupervisor.recordIncident({
            scope: `project-task-state:${project.id}`,
            component: 'task-current-state-recovery',
            operation: 'automatic-project-task-state-recovery',
            error,
            context: {
              projectId: project.id,
              decisionOsRoot: project.decisionOsRoot,
              sourceFingerprint,
            },
          });
        }
      })
      .finally(() => {
        automaticRecoveries.delete(project.id);
      });
    automaticRecoveryTail = recovery;
    automaticRecoveries.set(project.id, recovery);
  };

  const resolveScope = (scope: string, resolution: string): string[] => {
    const resolved = input.incidentLedger.resolveScope(scope, resolution);
    if (resolved.length === 0) throw new Error(`runtime_incident_resolution_not_persisted:${scope}`);
    return resolved.map((incident) => incident.id);
  };

  const resumeLocalProject = async (
    projectId: string,
    scope: string,
    resolution: string,
  ): Promise<string[]> => {
    const project = input.projectById(projectId);
    if (!project || !input.incidentSupervisor.pausedTaskProjects.has(projectId)) return [];
    let replacement: ReturnType<typeof input.projectRuntimeRegistry.tryContext> = null;
    try {
      replacement = installLocalReplacement(project, 'operator-resume-task-state');
      const ids = resolveScope(scope, resolution);
      input.incidentSupervisor.pausedTaskProjects.delete(projectId);
      recoverCodex(projectId, replacement.runtime);
      return ids;
    } catch (error) {
      if (replacement) input.projectRuntimeRegistry.dispose(replacement);
      input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
      input.localTaskRuntime.states.delete(projectId);
      input.incidentSupervisor.recordIncident({
        scope,
        component: 'task-current-state',
        operation: 'operator-resume-task-state',
        error,
        context: { projectId, decisionOsRoot: project.decisionOsRoot },
      });
      return [];
    }
  };

  const resumeFederatedProject = (
    projectId: string,
    scope: string,
    resolution: string,
  ): string[] => {
    if (!input.incidentSupervisor.pausedFederatedTaskProjects.has(projectId)) return [];
    try {
      input.federatedTaskRuntime.executionStates.delete(projectId);
      input.federatedTaskRuntime.projectStates.delete(projectId);
      input.federatedTaskRuntime.taskStores.delete(projectId);
      const state = input.federatedTaskRuntime.openStateForProject(projectId, 'operator-resume');
      input.federatedTaskRuntime.projectStates.set(projectId, state);
      input.federatedTaskRuntime.taskStores.set(projectId, state.store);
      input.replicator()?.reconcileProject('relay', projectId);
      const ids = resolveScope(scope, resolution);
      input.incidentSupervisor.pausedFederatedTaskProjects.delete(projectId);
      return ids;
    } catch (error) {
      input.federatedTaskRuntime.executionStates.delete(projectId);
      input.federatedTaskRuntime.projectStates.delete(projectId);
      input.federatedTaskRuntime.taskStores.delete(projectId);
      input.incidentSupervisor.recordIncident({
        scope,
        component: 'federation-task-state',
        operation: 'operator-resume-federated-task-state',
        error,
        context: { projectId },
      });
      return [];
    }
  };

  const resumeFederationRepair = async (
    projectId: string,
    scope: string,
    resolution: string,
  ): Promise<string[]> => {
    const cachedPause = input.incidentSupervisor.pausedFederationRepairs.get(projectId);
    let paused = input.incidentLedger.active(scope)
      .find((incident) => incident.code === 'task_current_dot_collision') ?? cachedPause;
    const replicator = input.replicator();
    const project = input.projectById(projectId);
    const state = input.localTaskRuntime.states.get(projectId);
    // WHAT: Reject recovery outside a locally owned, durably paused collision scope.
    // WHY: A remote replica and a free-form resume request cannot create local causal authority.
    if (!paused || !replicator || !project || resolution !== collisionRecoveryResolution) return [];
    const recoveryStore = state?.store ?? createTaskCurrentStateStore({ decisionOsRoot: project.decisionOsRoot, projectId });
    input.incidentSupervisor.pausedFederationRepairs.set(projectId, paused);
    const attemptId = String(paused.context.attemptId ?? '');
    // WHAT: Reject a collision incident that lost its stable repair-attempt identity.
    // WHY: Recovery must bind its exactly-once receipt to the durable rejected delivery evidence.
    if (!attemptId) return [];
    let retainedEvidence = recoveryStore.repairCollisionEvidence(attemptId);
    let adoptedLegacyEvidence = false;
    // WHAT: Adopt a legacy publication incident into the current durable evidence contract only during the explicit authority action.
    // WHY: Pre-patch incidents retained exact hashes and dots but could not bind their already archived receiver entity to the publication attempt.
    if (retainedEvidence.length === 0 && attemptId.startsWith('publication:')) {
      const deliveryId = String(paused.context.deliveryId ?? '');
      const rejected = Array.isArray(paused.context.rejected)
        ? paused.context.rejected.map(normalizeFederationStateRejection)
        : [];
      // WHAT: Reject missing, mismatched, or empty legacy delivery coordinates before archive adoption.
      // WHY: The operator action must remain bound to the exact rejected publication identity.
      if (!deliveryId || attemptId !== `publication:${deliveryId}` || rejected.length < 1) return [];
      const submittedEntities = rejected.map((rejection) => {
        const separator = rejection.key.indexOf('\u0000');
        // WHAT: Reject an entity key that cannot identify one current local submission.
        // WHY: Recovery cannot infer entity identity from malformed retained context.
        if (separator < 1) throw new Error('invalid_task_current_publication_collision_evidence');
        const entity = recoveryStore.entity(rejection.key.slice(0, separator) as TaskEntityType, rejection.key.slice(separator + 1));
        // WHAT: Require the current local entity to remain byte-identical to the legacy submitted hash.
        // WHY: A later mutation requires a new operator decision instead of stale evidence adoption.
        if (!entity || entity.stateHash !== rejection.stateHash) throw new Error('task_current_publication_collision_receiver_changed');
        return entity;
      });
      retainedEvidence = await recoveryStore.adoptPublicationCollisionEvidence({ attemptId, deliveryId, rejected, submittedEntities });
      adoptedLegacyEvidence = true;
    }
    // WHAT: Keep the legacy scope paused when neither current nor adopted durable evidence authorizes recovery.
    // WHY: Explicit resolution cannot proceed from incident strings alone.
    if (retainedEvidence.length < 1) return [];
    // WHAT: Upgrade the original collision incident under its exact fingerprint after legacy evidence becomes durable.
    // WHY: Restart and generation guards must observe relay-root and evidence-key authority before creating the successor.
    if (adoptedLegacyEvidence) {
      const historicalNoProgress = input.incidentLedger.snapshot().incidents
        .filter((incident) => incident.scope === `project-task-state:${projectId}` && incident.code === 'federation_state_no_progress')
        .sort((left, right) => left.lastObservedAt.localeCompare(right.lastObservedAt))
        .at(-1);
      const historicalAttempt = String(historicalNoProgress?.context.attemptId ?? '');
      const historicalParts = /^([a-f0-9]{64}):([a-f0-9]{64})$/.exec(historicalAttempt);
      const relayRoot = String(paused.context.relayRoot ?? '') || (historicalParts && historicalParts[2] === recoveryStore.rootHash() ? historicalParts[1] : '');
      paused = input.incidentSupervisor.recordIncident({
        scope,
        component: 'federation-task-state-replicator',
        operation: 'terminal-state-collision',
        code: 'task_current_dot_collision',
        error: new Error(`task_current_dot_collision:${projectId}`),
        context: {
          ...paused.context,
          ...(relayRoot ? { relayRoot } : {}),
          evidenceKeys: retainedEvidence.map((entry) => `${entry.deliveryId}\u0000${entry.key}`).sort(),
        },
      });
      input.incidentSupervisor.pausedFederationRepairs.set(projectId, paused);
    }
    const receipt = await recoveryStore.recoverRepairCollisionLocalAuthority(attemptId);
    const recoveryKeys = Object.keys(receipt.resultingStateHashes).sort();
    const diagnostics = replicator.diagnostics();
    const hasPendingRecovery = hasPendingFederationRepair(diagnostics.runtimeDirty, projectId, receipt.resultingStateHashes);
    let converged = diagnostics.convergence.some((entry) => entry.peerId === 'relay' && entry.projectId === projectId && entry.converged)
      && !diagnostics.runtimeDirty.some((entry) => entry.projectId === projectId && recoveryKeys.includes(entry.entityKey));
    // WHAT: Publish the deterministic successor only when no prior recovery delivery remains pending.
    // WHY: Restart may need one retry, while repeated operator requests must not flood the same durable hash.
    if (!converged && !hasPendingRecovery) replicator.publishRecoveryDelta(recoveryStore.activeDelta(recoveryKeys), recoveryStore);
    const recoveryDeadline = Date.now() + collisionRecoveryDeadlineMs;
    while (!converged && Date.now() < recoveryDeadline) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      const current = replicator.diagnostics();
      converged = current.convergence.some((entry) => entry.peerId === 'relay' && entry.projectId === projectId && entry.converged)
        && !current.runtimeDirty.some((entry) => entry.projectId === projectId && recoveryKeys.includes(entry.entityKey));
    }
    // WHAT: Retain the pause when the bounded recovery request does not reach exact relay equality.
    // WHY: A committed local successor alone cannot authorize incident resolution.
    if (!converged) return [];
    await recoveryStore.flush();
    const reopened = createTaskCurrentStateStore({ decisionOsRoot: project.decisionOsRoot, projectId });
    await reopened.flush();
    // WHAT: Reject completion when a fresh durable reload does not reproduce the converged root and successor hashes.
    // WHY: In-memory equality cannot authorize incident resolution after a persistence failure.
    if (reopened.rootHash() !== recoveryStore.rootHash() || recoveryKeys.some((key) => {
      const [entityType, entityId] = key.split('\u0000');
      return reopened.entity(entityType as Parameters<typeof reopened.entity>[0], entityId)?.stateHash !== receipt.resultingStateHashes[key];
    })) throw new Error(`federation_repair_reload_validation_failed:${projectId}`);
    const currentPause = input.incidentLedger.active(scope)
      .find((incident) => incident.code === 'task_current_dot_collision');
    // WHAT: Retain a collision generation that replaced the recovered attempt during its bounded convergence wait.
    // WHY: Scope-wide resolution must never clear newer durable evidence with an older recovery receipt.
    if (!currentPause || currentPause.id !== paused.id || String(currentPause.context.attemptId ?? '') !== attemptId) {
      // WHAT: Refresh the admission cache only when a newer durable collision remains active.
      // WHY: An externally resolved scope has no pause authority to reinstall.
      if (currentPause) input.incidentSupervisor.pausedFederationRepairs.set(projectId, currentPause);
      return [];
    }
    const downstreamScope = `project-task-state:${projectId}`;
    const downstreamActive = input.incidentLedger.active(downstreamScope);
    // WHAT: Reject replacement installation while any independent project-state incident remains active.
    // WHY: Repair timeout history has no pause authority, so every active project-state incident is a separate invariant failure.
    if (downstreamActive.length > 0) return [];
    let replacement: ReturnType<typeof input.projectRuntimeRegistry.tryContext> = null;
    let ids: string[] = [];
    try {
      replacement = installLocalReplacement(project, 'federation-collision-recovery', false);
      ids.push(...resolveScope(scope, resolution));
      input.incidentSupervisor.pausedTaskProjects.delete(projectId);
    } catch (error) {
      // WHAT: Remove transient replacement state and contexts after installation or resolution failure.
      // WHY: Partial runtime restoration must not expose a project whose durable pauses remain authoritative.
      if (replacement) input.projectRuntimeRegistry.dispose(replacement);
      input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
      input.localTaskRuntime.states.delete(projectId);
      const restoreIncident = (incident: typeof paused) => input.incidentSupervisor.recordIncident({
        scope: incident.scope,
        component: incident.component,
        operation: incident.operation,
        code: incident.code,
        severity: incident.severity,
        error: new Error(incident.message),
        context: incident.context,
      });
      const restoredCollision = input.incidentLedger.active(scope)
        .find((incident) => incident.code === 'task_current_dot_collision') ?? restoreIncident(paused);
      input.incidentSupervisor.pausedFederationRepairs.set(projectId, restoredCollision);
      input.incidentSupervisor.recordIncident({
        scope,
        component: 'federation-task-state-recovery',
        operation: 'restore-federation-repair-runtime',
        code: 'federation_repair_runtime_restore_failed',
        error,
        context: { projectId, attemptId },
      });
      return [];
    }
    replicator.clearTerminalRepair(projectId);
    input.incidentSupervisor.pausedFederationRepairs.delete(projectId);
    replicator.reconcileProject('relay', projectId);
    recoverCodex(projectId, replacement.runtime);
    return ids;
  };

  const resumeProjectContext = (
    projectId: string,
    scope: string,
    resolution: string,
    kind: 'project-watcher' | 'project-runtime',
  ): string[] => {
    const paused = kind === 'project-watcher'
      ? input.incidentSupervisor.pausedProjectWatchers
      : input.incidentSupervisor.pausedProjectRuntimes;
    const project = input.projectById(projectId);
    if (!project || !paused.has(projectId)) return [];
    const active = input.projectRuntimeRegistry.contexts.get(project.decisionOsRoot);
    if (active) input.projectRuntimeRegistry.dispose(active);
    input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
    const replacement = input.projectRuntimeRegistry.tryContext(
      project,
      `operator-resume-${kind}`,
      null,
      kind,
    );
    if (!replacement) return [];
    try {
      const ids = resolveScope(scope, resolution);
      paused.delete(projectId);
      return ids;
    } catch {
      input.projectRuntimeRegistry.dispose(replacement);
      input.projectRuntimeRegistry.contexts.delete(project.decisionOsRoot);
      return [];
    }
  };

  const resume = async (scope: string, resolution: string): Promise<AnyRecord> => {
    let resolvedIncidentIds: string[] = [];
    // WHAT: Retry the primary incident ledger before dispatching application-scope recovery.
    // WHY: The diagnostic-storage scope is not owned by a project or background component supervisor set.
    if (scope === 'runtime-incident-ledger') {
      resolvedIncidentIds = input.incidentLedger.recoverPersistence(resolution)
        .map((incident) => incident.id);
    } else if (scope.startsWith('project-task-state:')) {
      resolvedIncidentIds = await resumeLocalProject(
        scope.slice('project-task-state:'.length),
        scope,
        resolution,
      );
    } else if (scope.startsWith('federated-task-state:')) {
      resolvedIncidentIds = resumeFederatedProject(
        scope.slice('federated-task-state:'.length),
        scope,
        resolution,
      );
    } else if (scope.startsWith('federation-repair:')) {
      resolvedIncidentIds = await resumeFederationRepair(
        scope.slice('federation-repair:'.length),
        scope,
        resolution,
      );
    } else if (scope.startsWith('background:')) {
      resolvedIncidentIds = await resumeBackgroundRuntime({
        activeIncidentIds: (activeScope) => input.incidentLedger
          .active(activeScope)
          .map((incident) => incident.id),
        codexCoordinator: input.codexCoordinator,
        component: scope.slice('background:'.length),
        contentScheduler: input.contentScheduler,
        federation: input.federation,
        federatedLibrary: input.federatedLibrary,
        incidentSupervisor: input.incidentSupervisor,
        initializePipelineCatalog: input.initializePipelineCatalog,
        migrateProjectPipelines: input.migrateProjectPipelines,
        projectRuntimeRegistry: input.projectRuntimeRegistry,
        projectSyncRuntime: input.projectSyncRuntime,
        resolveScope,
        scope,
        resolution,
      });
    } else if (scope.startsWith('project-watcher:')) {
      resolvedIncidentIds = resumeProjectContext(
        scope.slice('project-watcher:'.length),
        scope,
        resolution,
        'project-watcher',
      );
    } else if (scope.startsWith('project-runtime:')) {
      resolvedIncidentIds = resumeProjectContext(
        scope.slice('project-runtime:'.length),
        scope,
        resolution,
        'project-runtime',
      );
    }
    return {
      ok: resolvedIncidentIds.length > 0,
      scope,
      resolvedIncidentIds,
    };
  };

  return { resume, scheduleAutomaticTaskStateRecovery };
}
