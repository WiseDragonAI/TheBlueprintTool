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
import { createLedgerRevisionTracker } from '../../server/helper/create-ledger-revision-tracker.js';
import type { IncidentSupervisor } from '../../server/runtime/incident-supervisor.js';

type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;
type ExecutionRecord = ReturnType<ProjectTaskState['executions']['find']>;

export function createFederatedTaskRuntime(input: {
  incidentSupervisor: IncidentSupervisor;
  localNodeId: () => string;
  masterDecisionOsRoot: string;
  onExecutionChange: (
    projectId: string,
    executionId: string,
    record: ExecutionRecord,
  ) => void;
  publishContentChange: () => void;
  publishDelta: (delta: TaskStateDelta) => void;
}) {
  const taskStores = new Map<string, TaskCurrentStateStore>();
  const projectStates = new Map<string, ProjectTaskState>();
  const revisions = new Map<string, ReturnType<typeof createLedgerRevisionTracker>>();
  const executionStates = new Map<string, ExecutionState>();

  const storeForProject = (projectId: string, ownerNodeId: string): TaskCurrentStateStore | null => {
    if (!projectId || input.incidentSupervisor.pausedFederatedTaskProjects.has(projectId)) {
      return null;
    }
    const current = taskStores.get(projectId);
    if (current) return current;
    try {
      const replicaRoot = resolve(input.masterDecisionOsRoot, 'cache', 'federation-task-state');
      const state = createProjectTaskState({
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
    projectStates,
    revisionForProject,
    revisions,
    stateForProject,
    storeForProject,
    taskStores,
  };
}

export type FederatedTaskRuntime = ReturnType<typeof createFederatedTaskRuntime>;
