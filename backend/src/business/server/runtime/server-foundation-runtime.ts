/**
 * WHAT: Creates server-wide incident, content, catalog, execution, and presentation foundations.
 * WHY: These mutually dependent lifecycle capabilities need one explicit late-binding boundary.
 */
import type { ServerResponse } from 'node:http';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import { ensureDecisionOsGitRepository } from '../helper/ensure-decision-os-git-repository.js';
import { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import { createRuntimeIncidentLedger, type RuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createFederationTaskStateReplicator } from '../../federation/helper/federation-task-state-replicator.js';
import { createIncidentSupervisor, type IncidentSupervisor } from './incident-supervisor.js';
import { createServerExecutionRuntime } from './server-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

export function createServerFoundationRuntime(input: {
  incidentLedger?: RuntimeIncidentLedger;
  incidentSupervisor?: IncidentSupervisor;
  masterDecisionOsRoot: string;
  masterRoot: string;
  migrationAdmissionForProject: (projectId: string) => AnyRecord | null;
  runtime: AnyRecord;
}) {
  const pendingAutomaticRecoveries = new Map<string, DecisionOsProject>();
  const connections: {
    contentScheduler: ReturnType<typeof createFederationContentScheduler> | null;
    controlRoom: ReturnType<typeof createControlRoomProjectionStore> | null;
    federation: ReturnType<typeof createFederationNodeConnector> | null;
    publishPipelineSnapshot: (projectId: string, pipelineRunId: string, executionId: string) => void;
    replicator: ReturnType<typeof createFederationTaskStateReplicator> | null;
    scheduleAutomaticRecovery: (project: DecisionOsProject) => void;
    serverClosing: boolean;
  } = {
    contentScheduler: null,
    controlRoom: null,
    federation: null,
    publishPipelineSnapshot: () => undefined,
    replicator: null,
    scheduleAutomaticRecovery: (project) => {
      pendingAutomaticRecoveries.set(project.id, project);
    },
    serverClosing: false,
  };
  let protectedScopes = (): Iterable<string> => [];
  const incidentLedger =
    input.incidentLedger ??
    createRuntimeIncidentLedger({
      decisionOsRoot: input.masterDecisionOsRoot,
      protectedScopes: () => protectedScopes(),
    });
  const incidentSupervisor = input.incidentSupervisor ?? createIncidentSupervisor({ incidentLedger });
  protectedScopes = incidentSupervisor.protectedScopes;
  const globalClients = new Set<ServerResponse>();
  const federatedSchedulerContexts = new Map<string, { root: string; runtime: AnyRecord }>();
  const projectCatalogStore = createProjectCatalogStore({
    masterRoot: input.masterRoot,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
  });
  const authoredRoots = new Set([
    input.masterDecisionOsRoot,
    ...projectCatalogStore
      .projects()
      .filter((project) => project.available)
      .map((project) => project.decisionOsRoot),
  ]);
  for (const decisionOsRoot of [...authoredRoots].sort()) {
    ensureDecisionOsGitRepository(decisionOsRoot);
  }
  const contentStore = createFederationContentReplicaStore({
    decisionOsRoot: input.masterDecisionOsRoot,
  });
  const executionObservations = new Map<string, TaskExecutionObservation>();
  const serverCloseAbort = new AbortController();
  const executionPresentations = createTaskExecutionPresentationRegistry({
    contentStore,
    federation: () => connections.federation,
    serverCloseSignal: serverCloseAbort.signal,
  });
  const pipelinePresentations = new Map<string, AnyRecord>();
  const executionRuntime = createServerExecutionRuntime({
    baseRuntime: input.runtime,
    contentScheduler: () => connections.contentScheduler,
    contentStore,
    federatedSchedulerContexts,
    federation: () => connections.federation,
    globalClients,
    incidentLedger,
    incidentSupervisor,
    invalidateProject: (projectId, entities) =>
      connections.controlRoom?.invalidate(projectId, entities ? [...entities] : undefined),
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    migrationAdmissionForProject: input.migrationAdmissionForProject,
    presentations: executionPresentations,
    projectCatalogStore,
    publishPipelineSnapshot: (...args) => connections.publishPipelineSnapshot(...args),
    replicator: () => connections.replicator,
    scheduleAutomaticRecovery: (project) => connections.scheduleAutomaticRecovery(project),
    serverClosing: () => connections.serverClosing,
    serverCloseSignal: serverCloseAbort.signal,
  });
  return {
    connections,
    contentStore,
    executionObservations,
    executionPresentations,
    executionRuntime,
    federatedSchedulerContexts,
    globalClients,
    incidentLedger,
    incidentSupervisor,
    pendingAutomaticRecoveries,
    pipelinePresentations,
    projectCatalogStore,
    serverCloseAbort,
  };
}
