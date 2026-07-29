/**
 * WHAT: Handles transcription, voice upload, Git-review voice, and voice retry requests.
 * WHY: Voice request adaptation belongs to transcription instead of server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentEntity } from '../../task-state/helper/task-current-state-types.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readDecisionOsSettings } from '../../server/helper/read-decision-os-settings.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { parseMultipartFormData } from '../../server/helper/parse-multipart-form-data.js';
import { transcribeVoiceController } from '../controller/transcribe-voice-controller.js';
import {
  readVoiceTranscriptionStatusController,
  startVoiceRetryOrchestrationController,
  startVoiceUploadOrchestrationController,
} from '../controller/start-voice-upload-orchestration-controller.js';
import { transcribeGitReviewVoiceController } from '../../git-review/controller/transcribe-git-review-voice-controller.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleTranscriptionRoutes(input: {
  invalidateProject: (projectId: string, entities: readonly TaskCurrentEntity[]) => void;
  localProject: DecisionOsProject | null;
  masterDecisionOsRoot: string;
  onCardContentChange: (event: AnyRecord) => void;
  onLedgerChange: (event: AnyRecord) => void;
  request: IncomingMessage;
  requestRuntime: AnyRecord;
  response: ServerResponse;
  runtime: AnyRecord;
  taskStateForProject: (project: DecisionOsProject) => ProjectTaskState;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/voice-transcription-status' && input.request.method === 'GET') {
    const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
    const result = readVoiceTranscriptionStatusController({
      action_payload: {
        ledgerId: requestUrl.searchParams.get('ledgerId') ?? '',
        threadId: requestUrl.searchParams.get('threadId') ?? '',
        noteId: requestUrl.searchParams.get('noteId') ?? '',
      },
      runtime_state: input.requestRuntime,
    });
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
    input.response.end(JSON.stringify(result));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/transcribe' && input.request.method === 'POST') {
    const audioBuffer = await readRequestBuffer(input.request);
    await transcribeVoiceController({
      action_payload: {
        method: input.request.method,
        url: input.url,
        response: input.response,
        audioBuffer,
        mimeType: input.request.headers['content-type'] ?? 'audio/webm',
        threadId: input.request.headers['x-thread-id'] ?? '',
      },
      runtime_state: input.requestRuntime,
    });
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/voice-upload' && input.request.method === 'POST') {
    const bodyBuffer = await readRequestBuffer(input.request);
    const contentType = String(input.request.headers['content-type'] ?? '');
    const form = contentType.includes('multipart/form-data')
      ? parseMultipartFormData(bodyBuffer, contentType)
      : { fields: {}, files: {} };
    const audio = form.files.audio ?? Object.values(form.files)[0];
    const fields = form.fields as AnyRecord;
    const result = await startVoiceUploadOrchestrationController({
      action_payload: {
        ...fields,
        voicePipelineId: String((readDecisionOsSettings({
          action_payload: { decisionOsRoot: input.masterDecisionOsRoot },
          runtime_state: input.runtime,
        }).settings as AnyRecord).voicePipelineId ?? ''),
        audioBuffer: audio?.buffer ?? bodyBuffer,
        mimeType: audio?.mimeType ?? (contentType || 'audio/webm'),
        onCardContentChange: input.onCardContentChange,
        onLedgerChange: input.onLedgerChange,
      },
      runtime_state: input.requestRuntime,
    });
    const ledgerId = String(fields.ledgerId ?? '');
    const cardId = String(fields.cardId ?? '');
    const threadId = String(fields.threadId ?? (cardId ? `thread-${cardId}` : ''));
    if (result.ok !== false && result.uploaded && ledgerId === 'tasks' && input.localProject && cardId) {
      const state = input.taskStateForProject(input.localProject);
      const projection = state.projection().ledger;
      const refs = projection.threadFiles && typeof projection.threadFiles === 'object'
        ? projection.threadFiles as AnyRecord
        : {};
      const delta = await state.recordContentContribution(cardId, String(refs[threadId] ?? ''));
      input.invalidateProject(input.localProject.id, delta.entities);
    }
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
    input.response.end(JSON.stringify({ body: result }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/git-review/voice'
    && input.request.method === 'POST'
    && input.localProject) {
    const bodyBuffer = await readRequestBuffer(input.request);
    const contentType = String(input.request.headers['content-type'] ?? '');
    const form = contentType.includes('multipart/form-data')
      ? parseMultipartFormData(bodyBuffer, contentType)
      : { fields: {}, files: {} };
    const audio = form.files.audio ?? Object.values(form.files)[0];
    const result = await transcribeGitReviewVoiceController({
      action_payload: {
        ...form.fields,
        audioBuffer: audio?.buffer ?? bodyBuffer,
        mimeType: audio?.mimeType ?? (contentType || 'audio/webm'),
      },
      runtime_state: input.requestRuntime,
    });
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
    input.response.end(JSON.stringify(result));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/transcribe/retry' && input.request.method === 'POST') {
    const bodyBuffer = await readRequestBuffer(input.request);
    let retryPayload: AnyRecord = {};
    try {
      retryPayload = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
    } catch {
      retryPayload = {};
    }
    const result = await startVoiceRetryOrchestrationController({
      action_payload: {
        ...retryPayload,
        voicePipelineId: String((readDecisionOsSettings({
          action_payload: { decisionOsRoot: input.masterDecisionOsRoot },
          runtime_state: input.runtime,
        }).settings as AnyRecord).voicePipelineId ?? ''),
        threadId: input.request.headers['x-thread-id'] ?? retryPayload.threadId ?? '',
        onCardContentChange: input.onCardContentChange,
        onLedgerChange: input.onLedgerChange,
      },
      runtime_state: input.requestRuntime,
    });
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
    input.response.end(JSON.stringify({ body: result }));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
