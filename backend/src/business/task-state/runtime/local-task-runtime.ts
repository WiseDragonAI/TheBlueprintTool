/**
 * WHAT: Owns local project task-state creation, pause containment, and content-head repair.
 * WHY: Task persistence lifecycle must not be hidden inside the HTTP composition closure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TaskEntityChange, TaskStateDelta } from '../helper/task-current-state-types.js';
import { createProjectTaskState, type ProjectTaskState } from '../helper/project-task-state.js';
import { commitTaskContentMutation, taskContentAutoCommitEnabled } from '../helper/commit-task-content-mutation.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { tasksLedgerForProject } from '../../server/helper/project-catalog.js';
import { readDecisionOsSettings } from '../../server/helper/read-decision-os-settings.js';
import {
  RuntimeScopePausedError,
  type RuntimeIncidentLedger,
} from '../../server/helper/runtime-incident-ledger.js';
import type { IncidentSupervisor } from '../../server/runtime/incident-supervisor.js';
import { isTaskStateBootstrapGate } from '../helper/is-task-state-bootstrap-gate.js';

type AnyRecord = Record<string, unknown>;
type ExecutionRecord = ReturnType<ProjectTaskState['executions']['find']>;
type ProjectionEntityChange = {
  entityType: TaskEntityChange['entityType'];
  entityId: string;
};

export function createLocalTaskRuntime(input: {
  federationNodeId: () => string;
  incidentLedger: RuntimeIncidentLedger;
  incidentSupervisor: IncidentSupervisor;
  invalidateProject: (projectId: string, entities?: readonly ProjectionEntityChange[]) => void;
  masterDecisionOsRoot: string;
  migrationAdmissionForProject: (projectId: string) => AnyRecord | null;
  onExecutionChange: (
    project: DecisionOsProject,
    executionId: string,
    record: ExecutionRecord,
  ) => void;
  publishContentChange: () => void;
  publishDelta: (delta: TaskStateDelta) => void;
  replicationAvailable: () => boolean;
  scheduleAutomaticRecovery: (project: DecisionOsProject) => void;
  serverCloseSignal: AbortSignal;
}) {
  const states = new Map<string, ProjectTaskState>();
  const scheduledContentHeadRepairs = new Set<string>();

  const scheduleContentHeadRepair = (projectId: string, state: ProjectTaskState): void => {
    if (scheduledContentHeadRepairs.has(projectId)) return;
    scheduledContentHeadRepairs.add(projectId);
    void state.repairMissingContentHeads().then(({ repaired, missing }) => {
      if (repaired.length > 0) {
        input.invalidateProject(
          projectId,
          repaired.map((head) => ({ entityType: 'resource', entityId: head.key })),
        );
      }
      const scope = `task-content-coverage:${projectId}`;
      if (missing.length === 0) {
        input.incidentLedger.resolveScope(
          scope,
          'Every referenced local task document has a causal content head.',
        );
        return;
      }
      input.incidentSupervisor.recordIncident({
        severity: 'warning',
        scope,
        component: 'task-content-object-store',
        operation: 'repair-missing-task-content-heads',
        code: 'task_content_reference_missing',
        error: new Error(`Referenced task documents are missing locally: ${missing.join(',')}`),
        context: {
          projectId,
          missingCount: missing.length,
          files: missing.slice(0, 50),
        },
      });
    }).catch((error: unknown) => {
      scheduledContentHeadRepairs.delete(projectId);
      input.incidentSupervisor.recordStoppedOperation({
        scope: `task-content-coverage:${projectId}`,
        component: 'task-content-object-store',
        operation: 'repair-missing-task-content-heads',
        error,
        context: { projectId },
      });
    });
  };

  const openStateForProject = (project: DecisionOsProject): ProjectTaskState => {
    const ledger = tasksLedgerForProject(project);
    const tasksLedgerFile = resolve(
      project.decisionOsRoot,
      ledger.ledgerFile.replace(/^\.decision-os\//, ''),
    );
    const stateRoot = resolve(project.decisionOsRoot, 'task-state', project.id);
    let initialize = !existsSync(stateRoot) && !existsSync(tasksLedgerFile);
    if (!existsSync(stateRoot) && existsSync(tasksLedgerFile)) {
      const document = JSON.parse(readFileSync(tasksLedgerFile, 'utf8')) as AnyRecord;
      initialize = ['cards', 'annotations', 'relationships'].every(
        (key) => !Array.isArray(document[key]) || document[key].length === 0,
      );
    }
    const settings = readDecisionOsSettings({
      action_payload: { decisionOsRoot: project.decisionOsRoot },
      runtime_state: {},
    }).settings;
    const state = createProjectTaskState({
      projectId: project.id,
      writerId: input.federationNodeId(),
      decisionOsRoot: project.decisionOsRoot,
      tasksLedgerFile,
      publish: input.publishDelta,
      publishContent: input.publishContentChange,
      commitContent: ({ mutation, changedContentFiles }) => commitTaskContentMutation({
        enabled: taskContentAutoCommitEnabled(settings),
        projectId: project.id,
        decisionOsRoot: project.decisionOsRoot,
        mutation,
        changedContentFiles,
        signal: input.serverCloseSignal,
      }),
      onExecutionChange: ({ executionId, record }) => (
        input.onExecutionChange(project, executionId, record)
      ),
      onPersistenceError: (error) => {
        input.incidentSupervisor.pauseTaskProject(project, error, 'materialize-local-task-state');
      },
      initialize,
    });
    if (input.replicationAvailable()) scheduleContentHeadRepair(project.id, state);
    return state;
  };

  const stateForProject = (project: DecisionOsProject): ProjectTaskState => {
    const paused = input.incidentSupervisor.pausedTaskProjects.get(project.id);
    if (paused) throw new RuntimeScopePausedError(paused.scope, paused.id);
    const migrationAdmission = input.migrationAdmissionForProject(project.id);
    if (migrationAdmission) {
      throw input.incidentSupervisor.pauseTaskProject(
        project,
        new Error(
          `task_migration_transaction_incomplete:${String(migrationAdmission.phase ?? 'unknown')}`,
        ),
        'admit-migrated-task-state',
      );
    }
    const current = states.get(project.id);
    if (current) {
      if (input.replicationAvailable()) scheduleContentHeadRepair(project.id, current);
      return current;
    }
    try {
      const state = openStateForProject(project);
      states.set(project.id, state);
      if (input.incidentSupervisor.taskProjectsPendingFrameIncidentRevalidation.delete(project.id)) {
        input.incidentLedger.resolveScope(
          `project-task-state:${project.id}`,
          'Durable task state revalidated after the retired federation-frame pause.',
        );
      }
      return state;
    } catch (error) {
      if (error instanceof RuntimeScopePausedError) throw error;
      const retained = input.incidentSupervisor
        .taskProjectsPendingFrameIncidentRevalidation.get(project.id);
      if (retained) {
        input.incidentSupervisor.taskProjectsPendingFrameIncidentRevalidation.delete(project.id);
        input.incidentSupervisor.pausedTaskProjects.set(project.id, retained);
      }
      const pausedError = input.incidentSupervisor.pauseTaskProject(
        project,
        error,
        'open-local-task-state',
      );
      if (error instanceof Error && error.message === 'task_state_offline_migration_required') {
        input.scheduleAutomaticRecovery(project);
      }
      throw pausedError;
    }
  };

  const recordBackgroundFailure = (
    project: DecisionOsProject,
    error: unknown,
    operation: string,
  ): void => {
    if (error instanceof RuntimeScopePausedError) return;
    if (isTaskStateBootstrapGate(error)) {
      input.incidentSupervisor.recordStoppedOperation({
        scope: `project-task-write:${project.id}`,
        component: 'task-current-state',
        operation,
        error,
        context: { projectId: project.id, projectName: project.name },
      });
      return;
    }
    input.incidentSupervisor.pauseTaskProject(project, error, operation);
  };

  const tryStateForProject = (project: DecisionOsProject): ProjectTaskState | null => {
    try {
      return stateForProject(project);
    } catch (error) {
      if (!(error instanceof RuntimeScopePausedError)) {
        input.incidentSupervisor.pauseTaskProject(project, error, 'open-local-task-state');
      }
      return null;
    }
  };

  const projectionForProject = (project: DecisionOsProject): AnyRecord => {
    const state = tryStateForProject(project);
    if (state) return state.projection();
    const ledger = tasksLedgerForProject(project);
    const file = resolve(
      project.decisionOsRoot,
      ledger.ledgerFile.replace(/^\.decision-os\//, ''),
    );
    try {
      return {
        ledger: JSON.parse(readFileSync(file, 'utf8')) as AnyRecord,
        conflicts: [],
        degraded: true,
      };
    } catch {
      return {
        ledger: { cards: [], annotations: [], relationships: [] },
        conflicts: [],
        degraded: true,
      };
    }
  };

  return {
    openStateForProject,
    projectionForProject,
    recordBackgroundFailure,
    scheduleContentHeadRepair,
    stateForProject,
    states,
    tryStateForProject,
  };
}

export type LocalTaskRuntime = ReturnType<typeof createLocalTaskRuntime>;
