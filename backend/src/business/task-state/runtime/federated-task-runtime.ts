/**
 * WHAT: Owns replicated task stores, execution repositories, and revisions.
 * WHY: Remote task-state materialization has a distinct lifecycle from local project state.
 */
import { resolve } from 'node:path';
import type { TaskCurrentStateStore } from '../helper/task-current-state-store.js';
import type { TaskStateDelta } from '../helper/task-current-state-types.js';
import { createProjectTaskState, type ProjectTaskState } from '../helper/project-task-state.js';
import { createTaskExecutionRepository } from '../helper/task-execution-repository.js';
import { captureTaskExecutionArtifact } from '../helper/capture-task-execution-artifact.js';
import { archiveIncompatibleFederatedTaskState } from '../helper/archive-incompatible-federated-task-state.js';
import { createLedgerRevisionTracker } from '../../server/helper/create-ledger-revision-tracker.js';
import type { IncidentSupervisor } from '../../server/runtime/incident-supervisor.js';
import type { RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';

type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;
type ExecutionRecord = ReturnType<ProjectTaskState['executions']['find']>;

export function createFederatedTaskRuntime(input: {
  incidentSupervisor: IncidentSupervisor;
  incidentLedger: RuntimeIncidentLedger;
  localNodeId: () => string;
  masterDecisionOsRoot: string;
  onExecutionChange: (
    projectId: string,
    executionId: string,
    record: ExecutionRecord,
  ) => void;
  publishContentChange: () => void;
  publishDelta: (delta: TaskStateDelta) => void;
  reconcileProject: (projectId: string) => void;
}) {
  const taskStores = new Map<string, TaskCurrentStateStore>();
  const projectStates = new Map<string, ProjectTaskState>();
  const revisions = new Map<string, ReturnType<typeof createLedgerRevisionTracker>>();
  const executionStates = new Map<string, ExecutionState>();
  const automaticCacheRecoveries = new Map<string, Promise<void>>();

  const openStateForProject = (projectId: string, ownerNodeId: string): ProjectTaskState => {
    const replicaRoot = resolve(input.masterDecisionOsRoot, 'cache', 'federation-task-state');
    return createProjectTaskState({
      decisionOsRoot: replicaRoot,
      projectId,
      writerId: input.localNodeId(),
      tasksLedgerFile: resolve(replicaRoot, 'replica-ledgers', `${projectId}.json`),
      initialize: true,
      publish: input.publishDelta,
      publishContent: input.publishContentChange,
      onPersistenceError: (error) => {
        const incident = input.incidentSupervisor.recordIncident({
          scope: `federated-task-state:${projectId}`,
          component: 'federation-task-state',
          operation: 'materialize-federated-task-state',
          error,
          context: { projectId, ownerNodeId },
        });
        input.incidentSupervisor.pausedFederatedTaskProjects.set(projectId, incident);
      },
    });
  };

  const scheduleCacheRecovery = (projectId: string, ownerNodeId: string): void => {
    if (automaticCacheRecoveries.has(projectId)) return;
    const recovery = (async () => {
      let sourceFingerprint = '';
      try {
        const archived = await archiveIncompatibleFederatedTaskState({
          replicaDecisionOsRoot: resolve(
            input.masterDecisionOsRoot,
            'cache',
            'federation-task-state',
          ),
          projectId,
        });
        sourceFingerprint = archived.fingerprint;
        executionStates.delete(projectId);
        projectStates.delete(projectId);
        taskStores.delete(projectId);
        const state = openStateForProject(projectId, ownerNodeId);
        projectStates.set(projectId, state);
        taskStores.set(projectId, state.store);
        const scope = `federated-task-state:${projectId}`;
        const resolved = input.incidentLedger.resolveScope(
          scope,
          'Incompatible derived task cache archived and rebuilt automatically.',
        );
        if (resolved.length === 0) {
          throw new Error(`runtime_incident_resolution_not_persisted:${scope}`);
        }
        input.incidentSupervisor.pausedFederatedTaskProjects.delete(projectId);
        input.reconcileProject(projectId);
      } catch (error) {
        input.incidentSupervisor.recordIncident({
          scope: `federated-task-state:${projectId}`,
          component: 'federation-task-state-recovery',
          operation: 'automatic-federated-task-state-recovery',
          error,
          context: { projectId, ownerNodeId, sourceFingerprint },
        });
      }
    })().finally(() => {
      automaticCacheRecoveries.delete(projectId);
    });
    automaticCacheRecoveries.set(projectId, recovery);
  };

  const storeForProject = (projectId: string, ownerNodeId: string): TaskCurrentStateStore | null => {
    if (!projectId || input.incidentSupervisor.pausedFederatedTaskProjects.has(projectId)) {
      return null;
    }
    const current = taskStores.get(projectId);
    if (current) return current;
    try {
      const state = openStateForProject(projectId, ownerNodeId);
      projectStates.set(projectId, state);
      taskStores.set(projectId, state.store);
      return state.store;
    } catch (error) {
      const incident = input.incidentSupervisor.recordIncident({
        scope: `federated-task-state:${projectId}`,
        component: 'federation-task-state',
        operation: 'open-federated-task-state',
        error,
        context: { projectId, ownerNodeId },
      });
      input.incidentSupervisor.pausedFederatedTaskProjects.set(projectId, incident);
      if (error instanceof Error && error.message === 'unsupported_task_current_state_format') {
        scheduleCacheRecovery(projectId, ownerNodeId);
      }
      return null;
    }
  };

  const stateForProject = (projectId: string, ownerNodeId: string): ProjectTaskState | null => {
    const current = projectStates.get(projectId);
    if (current) return current;
    storeForProject(projectId, ownerNodeId);
    return projectStates.get(projectId) ?? null;
  };

  const revisionForProject = (
    projectId: string,
  ): ReturnType<typeof createLedgerRevisionTracker> => {
    const current = revisions.get(projectId);
    if (current) return current;
    const created = createLedgerRevisionTracker();
    revisions.set(projectId, created);
    return created;
  };

  const executionStateForProject = (
    projectId: string,
    ownerNodeId: string,
  ): ExecutionState | null => {
    const current = executionStates.get(projectId);
    if (current) return current;
    const store = storeForProject(projectId, ownerNodeId);
    if (!store) return null;
    const executions = createTaskExecutionRepository({
      store,
      writerId: input.localNodeId(),
      projectId,
      persist: async (changes, emittedAt) => {
        const result = await store.mutate({
          replicaId: input.localNodeId(),
          changes,
          emittedAt,
        });
        input.publishDelta(result.delta);
        return result.delta;
      },
      onCommitted: ({ executionId, record }) => (
        input.onExecutionChange(projectId, executionId, record)
      ),
    });
    const state: ExecutionState = {
      executions,
      finalizeExecutionArtifacts: async (executionId, files) => {
        const objectRoot = resolve(store.root, 'objects');
        const [jsonl, stderr, telemetry, result] = await Promise.all([
          files.jsonl
            ? captureTaskExecutionArtifact({
              objectRoot,
              file: files.jsonl,
              mediaType: 'application/x-ndjson',
            })
            : null,
          files.stderr
            ? captureTaskExecutionArtifact({
              objectRoot,
              file: files.stderr,
              mediaType: 'text/plain',
            })
            : null,
          files.telemetry
            ? captureTaskExecutionArtifact({
              objectRoot,
              file: files.telemetry,
              mediaType: 'application/x-ndjson',
            })
            : null,
          files.result
            ? captureTaskExecutionArtifact({
              objectRoot,
              file: files.result,
              mediaType: 'application/json',
            })
            : null,
        ]);
        return executions.finalizeArtifacts(executionId, { jsonl, stderr, telemetry, result });
      },
    };
    executionStates.set(projectId, state);
    return state;
  };

  return {
    executionStateForProject,
    executionStates,
    openStateForProject,
    projectStates,
    revisionForProject,
    revisions,
    stateForProject,
    storeForProject,
    taskStores,
  };
}

export type FederatedTaskRuntime = ReturnType<typeof createFederatedTaskRuntime>;
