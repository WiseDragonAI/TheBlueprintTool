import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, dirname } from 'node:path';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';
import { taskExecutionState } from '../../codex/helper/task-execution-runtime.js';
import { readReplicatedCardSkillRun } from '../../codex/runtime/read-replicated-card-skill-run.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import {
  materializeTaskMutationInputs,
  TaskContentMaterializationError,
} from '../../federation/helper/materialize-task-mutation-inputs.js';
import { exportFederatedPipelineSnapshot } from '../../federation/helper/federated-library-cache.js';
import type { createFederatedLibraryRuntime } from '../../federation/runtime/federated-library-runtime.js';
import type { createFederationStateRuntime } from '../../federation/runtime/federation-state-runtime.js';
import { executeFederatedProjectSyncRole } from '../../project-sync/runtime/execute-federated-project-sync-role.js';
import type { createProjectSyncRuntime } from '../../project-sync/runtime/project-sync-runtime.js';
import type { TaskEntityChange } from '../../task-state/helper/task-current-state-types.js';
import type { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import type { createProjectCatalogStore } from '../helper/project-catalog-store.js';
import type { IncidentSupervisor } from '../runtime/incident-supervisor.js';
import type { createServerExecutionRuntime } from '../runtime/server-execution-runtime.js';
import type { AdmittedProjectRequest } from './global-request-stage.js';
import { handleProjectDataRequestStage } from './project-data-request-stage.js';
import { handleProjectInteractionRequestStage } from './project-interaction-request-stage.js';

type AnyRecord = Record<string, unknown>;

function projectNameForDecisionOsRoot(decisionOsRoot: string): string {
  return basename(dirname(decisionOsRoot)) || 'Project';
}

export function createProjectRequestHandler(input: {
  baseRuntime: AnyRecord;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  controlRoom: () => ReturnType<typeof createControlRoomProjectionStore>;
  executionPresentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  executionRuntime: ReturnType<typeof createServerExecutionRuntime>;
  federatedLibrary: ReturnType<typeof createFederatedLibraryRuntime>;
  federatedSchedulerContexts: Map<string, { root: string; runtime: AnyRecord }>;
  federation: ReturnType<typeof createFederationNodeConnector>;
  federationState: ReturnType<typeof createFederationStateRuntime>;
  frontendRoot: string;
  globalClients: Set<ServerResponse>;
  incidentSupervisor: IncidentSupervisor;
  localDecisionOsRoots: () => string[];
  masterDecisionOsRoot: string;
  masterRoot: string;
  projectCatalogStore: ReturnType<typeof createProjectCatalogStore>;
  projectSyncRuntime: ReturnType<typeof createProjectSyncRuntime>;
  reconcileProjectRuntimes: () => void;
  recordBackgroundFailure: (
    component: string,
    operation: string,
    error: unknown,
    context?: AnyRecord,
  ) => unknown;
  recordIncident: (incident: {
    severity?: 'warning' | 'error' | 'fatal';
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context?: AnyRecord;
  }) => unknown;
  restartServer: unknown;
  serverCloseSignal: AbortSignal;
}) {
  const localTaskRuntime = input.executionRuntime.localTaskRuntime;
  const projectRuntimeRegistry = input.executionRuntime.projectRuntimeRegistry;
  return async (
    admitted: AdmittedProjectRequest,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const {
      activeProject,
      projectScope,
      projects,
      requestPath,
      requestUrl,
      url,
    } = admitted;
    const decisionOsRoot = activeProject?.decisionOsRoot ?? input.masterDecisionOsRoot;
    const context = projectRuntimeRegistry.context(decisionOsRoot, activeProject?.id ?? '');
    const requestRuntime = context.runtime;
    const localProject = activeProject ?? projects
      .find((project) => project.decisionOsRoot === decisionOsRoot) ?? null;
    const projectData = await handleProjectDataRequestStage({
      activeProject,
      cardRuntime: {
        contentDrain: input.federationState.contentScheduler.drain,
        contentStore: input.contentStore,
        decisionOsRoot,
        invalidateProject: (projectId, changes) => input.controlRoom().invalidate(
          projectId,
          changes ? [...changes] as TaskEntityChange[] : undefined,
        ),
        localProject,
        publishContentChange: () => input.federation.publishContentChange(),
        revisions: context.revisions,
        stateForProject: localTaskRuntime.stateForProject,
        watcher: context.watcher,
      },
      content: {
        contentObjectFile: (hash) => input.contentStore.objectFile(hash),
        contentStatus: () => input.contentStore.status() as AnyRecord,
        localNodeId: input.federation.localOwner().ownerNodeId,
        projectScoped: Boolean(projectScope),
        projects,
        remoteProjectKnown: (projectId) => input.federation.remoteProjects()
          .some((project) => project.localProjectId === projectId),
        replicationDiagnostics: () => input.federationState.replicator.diagnostics(),
        replicationStores: () => [
          ...[...localTaskRuntime.states].map(([projectId, state]) => ({
            projectId,
            ownerNodeId: input.federation.localOwner().ownerNodeId,
            store: state.store,
          })),
          ...[...input.executionRuntime.federatedTaskRuntime.taskStores]
            .map(([projectId, store]) => ({
              projectId,
              ownerNodeId: 'replicated',
              store,
            })),
        ],
        schedulerRunning: input.federationState.contentScheduler.running,
        stateForProject: localTaskRuntime.stateForProject,
      },
      decisionOsRoot,
      executeProjectSyncRole: (body, authenticatedNodeId) => executeFederatedProjectSyncRole({
        authenticatedNodeId,
        body,
        executionState: input.executionRuntime.executionStateForProject,
        installSchedulerRuntime: (executionId, root, activeRuntime) => {
          input.federatedSchedulerContexts.set(executionId, { root, runtime: activeRuntime });
        },
        localNodeId: input.federation.localOwner().ownerNodeId,
        projectRuntime: (project) => projectRuntimeRegistry.context(
          project.decisionOsRoot,
          project.id,
        ).runtime,
        projects,
        removeSchedulerRuntime: (executionId) => {
          input.federatedSchedulerContexts.delete(executionId);
        },
        store: input.projectSyncRuntime.store(),
      }),
      exportPipelines: () => exportFederatedPipelineSnapshot(input.localDecisionOsRoots()),
      federation: input.federation,
      invalidateSkillIndex: input.federatedLibrary.invalidateIndex,
      ledgerPersistence: {
        decisionOsRoot,
        invalidateProject: (projectId, entities) => input.controlRoom().invalidate(
          projectId,
          entities ? [...entities] : undefined,
        ),
        localProject,
        projectId: activeProject?.id ?? '',
        publishContentChange: () => input.federation.publishContentChange(),
        revisions: context.revisions,
        stateForProject: localTaskRuntime.stateForProject,
        watcher: context.watcher,
      },
      libraryStatus: () => input.baseRuntime.federatedLibrarySyncStatus as AnyRecord | undefined,
      masterDecisionOsRoot: input.masterDecisionOsRoot,
      masterRoot: input.masterRoot,
      onCodexSettingsChanged: () => {
        input.incidentSupervisor.pausedBackgroundComponents.delete('codex-process-scheduler');
        void input.executionRuntime.processCoordinator.schedule()
          .catch((error: unknown) => input.recordBackgroundFailure(
            'codex-process-scheduler',
            'settings-change-schedule',
            error,
          ));
      },
      presentation: {
        presentationRegistry: input.executionPresentations,
        recordFailure: (incident) => { input.recordIncident(incident as Parameters<typeof input.recordIncident>[0]); },
        runtime: requestRuntime,
        runtimeForExecution: (executionId) => (
          input.federatedSchedulerContexts.get(executionId)?.runtime ?? null
        ),
      },
      projectCatalog: () => input.projectCatalogStore.projects(),
      projectCatalogStore: input.projectCatalogStore,
      recordBackgroundFailure: input.recordBackgroundFailure,
      projectScope,
      projectScoped: Boolean(projectScope),
      projectSyncController: input.projectSyncRuntime.controller,
      projectSyncStore: input.projectSyncRuntime.store(),
      projects,
      readSkillIndex: input.federatedLibrary.readSkillIndex,
      reconcileProjectRuntimes: input.reconcileProjectRuntimes,
      request,
      requestUrl,
      response,
      serverCloseSignal: input.serverCloseSignal,
      settingsRuntime: input.baseRuntime,
      synchronizeLibraries: async () => {
        input.incidentSupervisor.pausedBackgroundComponents.delete('federated-library-sync');
        await input.federatedLibrary.synchronize(true);
      },
      taskState: {
        invalidateProject: (projectId, entities) => input.controlRoom()
          .invalidate(projectId, [...entities]),
        stateForProject: localTaskRuntime.stateForProject,
      },
      taskStoreForProject: input.executionRuntime.taskStoreForProject,
      url,
    });
    if (!('persistLedger' in projectData)) return;
    await handleProjectInteractionRequestStage({
      activeExecutionPhase: (taskId) => taskExecutionState(requestRuntime)
        ?.executions.byTaskId(taskId)
        .find((execution) => [
          'preparing',
          'queued',
          'starting',
          'running',
          'cancelling',
        ].includes(execution.lifecycle.phase))?.lifecycle.phase ?? '',
      advanceRevision: (ledgerId) => context.revisions.advance(ledgerId),
      applyOwnedDetail: input.federatedLibrary.applyOwnedDetail,
      applyOwnedMetadata: input.federatedLibrary.applyOwnedMetadata,
      assertRuntimeAvailable: () => input.incidentSupervisor
        .assertCodexRuntimeAvailable(requestRuntime),
      contentDrain: input.federationState.contentScheduler.drain,
      contentEventClients: context.clients,
      contentStore: input.contentStore,
      currentRevision: (ledgerId) => context.revisions.current(ledgerId),
      decisionOsRoot,
      frontendRoot: input.frontendRoot,
      globalContentEventClients: input.globalClients,
      invalidateProject: (projectId, entities) => input.controlRoom()
        .invalidate(projectId, [...entities]),
      localProject,
      masterDecisionOsRoot: input.masterDecisionOsRoot,
      materializeTaskMutation: async (before, mutation) => {
        if (!localProject) return null;
        try {
          await materializeTaskMutationInputs({
            projectId: localProject.id,
            decisionOsRoot,
            ledger: before,
            mutation,
            store: localTaskRuntime.stateForProject(localProject).store,
            contentStore: input.contentStore,
            drain: input.federationState.contentScheduler.drain,
          });
          return null;
        } catch (error) {
          if (!(error instanceof TaskContentMaterializationError)) throw error;
          return { error: error.code, key: error.key, statusCode: error.statusCode };
        }
      },
      onCardContentChange: context.publishCard,
      onLedgerChange: context.publishLedger,
      persistLedger: projectData.persistLedger,
      persistMutation: projectData.persistMutation,
      projectColor: activeProject?.color ?? '#38d9e8',
      projectId: activeProject?.id ?? '',
      projectName: projectNameForDecisionOsRoot(decisionOsRoot),
      projectScope,
      projects,
      publishAuthoredSkill: input.federatedLibrary.publishAuthoredSkill,
      publishManifest: () => input.federation.publishManifest(),
      readReplicatedRun: ({ runId, ledgerId, cardId }) => (
        readReplicatedCardSkillRun({
          runId,
          ledgerId,
          cardId,
          runtime: requestRuntime,
          localNodeId: input.federation.localOwner().ownerNodeId,
          executionPresentations: input.executionPresentations,
        })
      ),
      recordRevisionFailure: (skillName, result) => {
        input.recordIncident({
          severity: 'warning',
          scope: `content-authoring:${skillName}`,
          component: 'codex-content-authoring',
          operation: 'commit-authored-content',
          error: String(result.error ?? 'Git revision failed.'),
          context: { skillName, recovery: result.recovery },
        });
      },
      request,
      requestRuntime,
      requestPath,
      requestUrl,
      response,
      restartServer: input.restartServer,
      runtime: input.baseRuntime,
      taskStateForProject: localTaskRuntime.stateForProject,
      taskLedger: () => localProject
        ? localTaskRuntime.stateForProject(localProject).projection().ledger
        : null,
      url,
    });
  };
}
