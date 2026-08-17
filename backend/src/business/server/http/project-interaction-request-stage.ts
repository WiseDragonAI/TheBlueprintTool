/**
 * WHAT: Dispatches project interaction, authoring, Codex, upload, and application routes in preserved order.
 * WHY: The server composition root must expose ordering without owning every capability's HTTP adaptation.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tryServeDecisionOsAsset } from './decision-os-asset-handler.js';
import { handleOperationalRoutes } from './operational-routes.js';
import { handleContentEventRoutes } from './content-event-routes.js';
import { serveStaticApplication } from './static-application-handler.js';
import { handleCodexPipelineRoutes } from '../../codex/http/pipeline-routes.js';
import { handleCodexSkillLibraryRoutes } from '../../codex/http/skill-library-routes.js';
import { handleCodexSkillRunRoutes } from '../../codex/http/skill-run-routes.js';
import { handleTranscriptionRoutes } from '../../transcription/http/transcription-routes.js';
import { handleThreadUploadRoutes } from '../../transcription/http/thread-upload-routes.js';
import { handleLegacyLedgerRoutes } from '../../ledger/http/legacy-ledger-routes.js';
import { handleTaskContentRoutes } from '../../task-state/http/task-content-routes.js';

type OperationalInput = Parameters<typeof handleOperationalRoutes>[0];
type PipelineInput = Parameters<typeof handleCodexPipelineRoutes>[0];
type SkillLibraryInput = Parameters<typeof handleCodexSkillLibraryRoutes>[0];
type SkillRunInput = Parameters<typeof handleCodexSkillRunRoutes>[0];
type TranscriptionInput = Parameters<typeof handleTranscriptionRoutes>[0];
type UploadInput = Parameters<typeof handleThreadUploadRoutes>[0];
type LegacyInput = Parameters<typeof handleLegacyLedgerRoutes>[0];
type StaticInput = Parameters<typeof serveStaticApplication>[0];

export async function handleProjectInteractionRequestStage(input: {
  activeExecutionPhase: LegacyInput['activeExecutionPhase'];
  advanceRevision: LegacyInput['advanceRevision'];
  applyOwnedDetail: SkillLibraryInput['applyOwnedDetail'];
  applyOwnedMetadata: SkillLibraryInput['applyOwnedMetadata'];
  assertRuntimeAvailable: () => void;
  contentDrain: UploadInput['contentDrain'];
  contentEventClients: Parameters<typeof handleContentEventRoutes>[0]['contentEventClients'];
  contentStore: UploadInput['contentStore'];
  currentRevision: LegacyInput['currentRevision'];
  decisionOsRoot: string;
  frontendRoot: string;
  globalContentEventClients: Parameters<typeof handleContentEventRoutes>[0]['globalContentEventClients'];
  invalidateProject: TranscriptionInput['invalidateProject'];
  localProject: TranscriptionInput['localProject'];
  masterDecisionOsRoot: string;
  materializeTaskMutation: LegacyInput['materializeTaskMutation'];
  onCardContentChange: TranscriptionInput['onCardContentChange'];
  onLedgerChange: PipelineInput['onLedgerChange'];
  persistLedger: LegacyInput['persistLedger'];
  persistMutation: LegacyInput['persistMutation'];
  projectColor: string;
  projectId: string;
  projectName: string;
  projectScope: StaticInput['projectScope'];
  projects: StaticInput['projects'];
  publishAuthoredSkill: SkillLibraryInput['publishAuthoredSkill'];
  publishManifest: PipelineInput['publishManifest'];
  readReplicatedRun: SkillRunInput['readReplicatedRun'];
  recordRevisionFailure: SkillLibraryInput['recordRevisionFailure'];
  request: IncomingMessage;
  requestPath: string;
  requestRuntime: PipelineInput['requestRuntime'];
  requestUrl: URL;
  response: ServerResponse;
  restartServer: OperationalInput['restartServer'];
  runtime: TranscriptionInput['runtime'];
  taskLedger: LegacyInput['taskLedger'];
  taskStateForProject: TranscriptionInput['taskStateForProject'];
  url: string;
}): Promise<void> {
  if (tryServeDecisionOsAsset({
    url: input.url,
    decisionOsRoot: input.decisionOsRoot,
    response: input.response,
  })) return;
  const operational = await handleOperationalRoutes({
    request: input.request,
    response: input.response,
    restartServer: input.restartServer,
    url: input.url,
  });
  if (operational.handled) return;
  const events = handleContentEventRoutes({
    contentEventClients: input.contentEventClients,
    globalContentEventClients: input.globalContentEventClients,
    request: input.request,
    response: input.response,
    url: input.url,
  });
  if (events.handled) return;
  const pipeline = await handleCodexPipelineRoutes({
    assertRuntimeAvailable: input.assertRuntimeAvailable,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    onLedgerChange: input.onLedgerChange,
    publishManifest: input.publishManifest,
    request: input.request,
    requestRuntime: input.requestRuntime,
    response: input.response,
    url: input.url,
  });
  if (pipeline.handled) return;
  const skillLibrary = await handleCodexSkillLibraryRoutes({
    applyOwnedDetail: input.applyOwnedDetail,
    applyOwnedMetadata: input.applyOwnedMetadata,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    publishAuthoredSkill: input.publishAuthoredSkill,
    recordRevisionFailure: input.recordRevisionFailure,
    request: input.request,
    requestRuntime: input.requestRuntime,
    requestUrl: input.requestUrl,
    response: input.response,
    url: input.url,
  });
  if (skillLibrary.handled) return;
  const skillRun = await handleCodexSkillRunRoutes({
    assertRuntimeAvailable: input.assertRuntimeAvailable,
    onLedgerChange: input.onLedgerChange,
    readReplicatedRun: input.readReplicatedRun,
    request: input.request,
    requestRuntime: input.requestRuntime,
    requestUrl: input.requestUrl,
    response: input.response,
    url: input.url,
  });
  if (skillRun.handled) return;
  const transcription = await handleTranscriptionRoutes({
    invalidateProject: input.invalidateProject,
    localProject: input.localProject,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    onCardContentChange: input.onCardContentChange,
    onLedgerChange: input.onLedgerChange,
    request: input.request,
    requestRuntime: input.requestRuntime,
    response: input.response,
    runtime: input.runtime,
    taskStateForProject: input.taskStateForProject,
    url: input.url,
  });
  if (transcription.handled) return;
  const upload = await handleThreadUploadRoutes({
    contentDrain: input.contentDrain,
    contentStore: input.contentStore,
    decisionOsRoot: input.decisionOsRoot,
    invalidateProject: input.invalidateProject,
    localProject: input.localProject,
    request: input.request,
    response: input.response,
    taskStateForProject: input.taskStateForProject,
    url: input.url,
  });
  if (upload.handled) return;
  const taskContent = await handleTaskContentRoutes({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    request: input.request,
    response: input.response,
    taskLedger: input.taskLedger,
    url: input.url,
  });
  // WHAT: stop route traversal after one task-content operation handles the request.
  // WHY: a committed response cannot fall through to legacy ledger routing.
  if (taskContent.handled) return;
  const legacy = await handleLegacyLedgerRoutes({
    activeExecutionPhase: input.activeExecutionPhase,
    advanceRevision: input.advanceRevision,
    currentRevision: input.currentRevision,
    decisionOsRoot: input.decisionOsRoot,
    materializeTaskMutation: input.materializeTaskMutation,
    persistLedger: input.persistLedger,
    persistMutation: input.persistMutation,
    projectColor: input.projectColor,
    projectId: input.projectId,
    projectName: input.projectName,
    request: input.request,
    response: input.response,
    runtime: input.requestRuntime,
    taskLedger: input.taskLedger,
    url: input.url,
  });
  if (legacy.handled) return;
  serveStaticApplication({
    frontendRoot: input.frontendRoot,
    projectScope: input.projectScope,
    projects: input.projects,
    request: input.request,
    requestPath: input.requestPath,
    response: input.response,
    url: input.url,
  });
}
