/**
 * WHAT: Dispatches project data, task-state, settings, synchronization, and catalog routes in preserved order.
 * WHY: Project data transport should compose capability runtimes outside the server lifecycle root.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { createCardAuthoringRuntime } from '../../ledger/runtime/card-authoring-runtime.js';
import { handleCardContentRoutes } from '../../ledger/http/card-content-routes.js';
import { createTaskExecutionPresentationReader } from '../../codex/runtime/task-execution-presentation-reader.js';
import { handleTaskExecutionReadRoutes } from '../../codex/http/task-execution-read-routes.js';
import { createLedgerPersistence } from '../../ledger/runtime/ledger-persistence.js';
import { handleLedgerReadRoutes } from '../../ledger/http/ledger-read-routes.js';
import { handleFederationContentRoutes } from '../../federation/http/content-routes.js';
import { handleTaskStateRoutes } from '../../task-state/http/task-state-routes.js';
import { handleFederatedLibraryRoutes } from '../../federation/http/library-routes.js';
import { handleSettingsRoutes } from './settings-routes.js';
import { handleProjectSyncRoutes } from '../../project-sync/http/project-sync-routes.js';
import { handleProjectCatalogRoutes } from './project-catalog-routes.js';

type AnyRecord = Record<string, unknown>;
type CardRuntimeInput = Parameters<typeof createCardAuthoringRuntime>[0];
type PresentationInput = Parameters<typeof createTaskExecutionPresentationReader>[0];
type PersistenceInput = Parameters<typeof createLedgerPersistence>[0];
type ContentInput = Parameters<typeof handleFederationContentRoutes>[0];
type TaskStateInput = Parameters<typeof handleTaskStateRoutes>[0];
type LibraryInput = Parameters<typeof handleFederatedLibraryRoutes>[0];
type SettingsInput = Parameters<typeof handleSettingsRoutes>[0];
type SyncInput = Parameters<typeof handleProjectSyncRoutes>[0];
type CatalogInput = Parameters<typeof handleProjectCatalogRoutes>[0];

export type ProjectDataStageResult =
  | { handled: true }
  | {
    handled: false;
    persistLedger(
      ledgerId: string,
      ledgerPath: string,
      ledger: AnyRecord,
    ): Promise<void>;
    persistMutation(
      ledgerId: string,
      ledgerPath: string,
      before: AnyRecord,
      ledger: AnyRecord,
      mutation: LedgerMutation,
      changedFiles: readonly string[],
    ): Promise<void>;
  };

export async function handleProjectDataRequestStage(input: {
  activeProject: CatalogInput['projects'][number] | null;
  cardRuntime: CardRuntimeInput;
  content: Omit<ContentInput, 'request' | 'response' | 'url'>;
  decisionOsRoot: string;
  executeProjectSyncRole: SyncInput['executeRole'];
  exportPipelines: LibraryInput['exportPipelines'];
  federation: SettingsInput['federation'];
  invalidateSkillIndex: LibraryInput['invalidateSkillIndex'];
  ledgerPersistence: PersistenceInput;
  libraryStatus: LibraryInput['status'];
  masterDecisionOsRoot: string;
  masterRoot: string;
  onCodexSettingsChanged: SettingsInput['onCodexSettingsChanged'];
  presentation: Omit<PresentationInput, 'request' | 'response'>;
  projectCatalog: CatalogInput['projectCatalog'];
  projectCatalogStore: CatalogInput['projectCatalogStore'];
  projectScope: CatalogInput['projectScope'];
  projectScoped: boolean;
  projectSyncController: SyncInput['controller'];
  projectSyncStore: SyncInput['store'];
  projects: CatalogInput['projects'];
  readSkillIndex: LibraryInput['readSkillIndex'];
  recordBackgroundFailure: (component: string, operation: string, error: unknown, context?: AnyRecord) => unknown;
  receivePublishedSkill: LibraryInput['receivePublishedSkill'];
  reconcileProjectRuntimes: CatalogInput['reconcileProjectRuntimes'];
  request: IncomingMessage;
  requestUrl: URL;
  response: ServerResponse;
  serverCloseSignal: AbortSignal;
  settingsRuntime: SettingsInput['runtime'];
  synchronizeLibraries: LibraryInput['synchronize'];
  taskState: Omit<TaskStateInput, 'projectScoped' | 'projects' | 'request' | 'response' | 'url'>;
  taskStoreForProject: CatalogInput['taskStoreForProject'];
  url: string;
}): Promise<ProjectDataStageResult> {
  const cardRuntime = createCardAuthoringRuntime(input.cardRuntime);
  const card = await handleCardContentRoutes({
    decisionOsRoot: input.decisionOsRoot,
    loadLedger: cardRuntime.loadLedger,
    localProject: input.cardRuntime.localProject,
    patchCard: cardRuntime.patchCard,
    request: input.request,
    requestUrl: input.requestUrl,
    response: input.response,
    serverCloseSignal: input.serverCloseSignal,
    url: input.url,
  });
  if (card.handled) return { handled: true };
  const presentation = createTaskExecutionPresentationReader({
    ...input.presentation,
    request: input.request,
    response: input.response,
  });
  const execution = await handleTaskExecutionReadRoutes({
    presentation: presentation.presentation,
    queuePosition: presentation.queuePosition,
    request: input.request,
    response: input.response,
    state: presentation.state,
    url: input.url,
  });
  if (execution.handled) return { handled: true };
  const persistence = createLedgerPersistence(input.ledgerPersistence);
  const ledger = await handleLedgerReadRoutes({
    contentDrain: input.cardRuntime.contentDrain,
    contentStore: input.cardRuntime.contentStore,
    decisionOsRoot: input.decisionOsRoot,
    localProject: input.cardRuntime.localProject,
    recordBackgroundFailure: (operation, error, context) => {
      input.recordBackgroundFailure('task-content-read', operation, error, context);
    },
    request: input.request,
    response: input.response,
    revisions: input.ledgerPersistence.revisions,
    stateForProject: input.cardRuntime.stateForProject,
    url: input.url,
  });
  if (ledger.handled) return { handled: true };
  const content = await handleFederationContentRoutes({
    ...input.content,
    request: input.request,
    response: input.response,
    url: input.url,
  });
  if (content.handled) return { handled: true };
  const taskState = await handleTaskStateRoutes({
    ...input.taskState,
    projectScoped: input.projectScoped,
    projects: input.projects,
    request: input.request,
    response: input.response,
    url: input.url,
  });
  if (taskState.handled) return { handled: true };
  const library = await handleFederatedLibraryRoutes({
    exportPipelines: input.exportPipelines,
    invalidateSkillIndex: input.invalidateSkillIndex,
    projectScoped: input.projectScoped,
    readSkillIndex: input.readSkillIndex,
    receivePublishedSkill: input.receivePublishedSkill,
    request: input.request,
    response: input.response,
    status: input.libraryStatus,
    synchronize: input.synchronizeLibraries,
    url: input.url,
  });
  if (library.handled) return { handled: true };
  const settings = await handleSettingsRoutes({
    federation: input.federation,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    onCodexSettingsChanged: input.onCodexSettingsChanged,
    request: input.request,
    response: input.response,
    runtime: input.settingsRuntime,
    url: input.url,
  });
  if (settings.handled) return { handled: true };
  const sync = await handleProjectSyncRoutes({
    controller: input.projectSyncController,
    executeRole: input.executeProjectSyncRole,
    federation: input.federation,
    projects: input.projects,
    request: input.request,
    response: input.response,
    store: input.projectSyncStore,
    url: input.url,
  });
  if (sync.handled) return { handled: true };
  const catalog = await handleProjectCatalogRoutes({
    controlRoomInvalidation: input.ledgerPersistence.invalidateProject,
    federation: input.federation,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    masterRoot: input.masterRoot,
    projectCatalog: input.projectCatalog,
    projectCatalogStore: input.projectCatalogStore,
    projectScope: input.projectScope,
    projects: input.projects,
    reconcileProjectRuntimes: input.reconcileProjectRuntimes,
    request: input.request,
    response: input.response,
    taskStoreForProject: input.taskStoreForProject,
    url: input.url,
  });
  if (catalog.handled) return { handled: true };
  return {
    handled: false,
    persistLedger: (ledgerId, ledgerPath, ledgerDocument) => persistence.persistLedger(
      ledgerId,
      ledgerPath,
      ledgerDocument,
      input.response,
    ),
    persistMutation: (ledgerId, ledgerPath, before, ledgerDocument, mutation, changedFiles) => (
      persistence.persistMutation(
        ledgerId,
        ledgerPath,
        before,
        ledgerDocument,
        mutation,
        changedFiles,
        input.response,
      )
    ),
  };
}
