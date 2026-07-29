/**
 * WHAT: Adapts pipeline catalog and pipeline-run operations to HTTP.
 * WHY: Pipeline transport belongs to Codex instead of server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { listCodexPipelinesController } from '../controller/list-codex-pipelines-controller.js';
import { saveCodexPipelineController } from '../controller/save-codex-pipeline-controller.js';
import { startCodexPipelineRunController } from '../controller/start-codex-pipeline-run-controller.js';
import { readCodexPipelineRunController } from '../controller/read-codex-pipeline-run-controller.js';
import { cancelCodexPipelineRunController } from '../controller/cancel-codex-pipeline-run-controller.js';
import { restartCodexPipelineRunController } from '../controller/restart-codex-pipeline-run-controller.js';
import { queueCodexSkillAfterExecutionController } from '../controller/queue-codex-skill-after-execution-controller.js';
import { readCompactPipelineRunStatusController } from '../controller/read-compact-run-status-controller.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

async function readJsonObject(request: IncomingMessage): Promise<AnyRecord> {
  const body = await readRequestBuffer(request);
  try {
    return JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
  } catch {
    return {};
  }
}

function sendControllerResult(
  response: ServerResponse,
  result: AnyRecord,
  successStatus: number,
): void {
  response.setHeader('content-type', 'application/json');
  response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : successStatus));
  response.end(JSON.stringify(result));
}

export async function handleCodexPipelineRoutes(input: {
  assertRuntimeAvailable: () => void;
  masterDecisionOsRoot: string;
  onLedgerChange: (event: AnyRecord) => void;
  publishManifest: () => void;
  request: IncomingMessage;
  requestRuntime: AnyRecord;
  response: ServerResponse;
  url: string;
}): Promise<HttpRouteOutcome> {
  if ((input.url === '/api/codex/pipelines' || input.url === '/api/codex/server-pipelines')
    && input.request.method === 'GET') {
    const result = listCodexPipelinesController({
      runtime_state: input.url === '/api/codex/server-pipelines'
        ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
        : input.requestRuntime,
    });
    sendControllerResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if ((input.url === '/api/codex/pipelines' || input.url === '/api/codex/server-pipelines')
    && input.request.method === 'POST') {
    const savePayload = await readJsonObject(input.request);
    const result = saveCodexPipelineController({
      action_payload: {
        ...savePayload,
        operation: 'create',
        ...(input.url === '/api/codex/server-pipelines' ? { scope: 'server' } : {}),
      },
      runtime_state: input.requestRuntime,
    });
    if (result.ok === true) input.publishManifest();
    sendControllerResult(input.response, result, 201);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/codex/pipelines/runs' && input.request.method === 'POST') {
    input.assertRuntimeAvailable();
    const runPayload = await readJsonObject(input.request);
    const result = await startCodexPipelineRunController({
      action_payload: { ...runPayload, onLedgerChange: input.onLedgerChange },
      runtime_state: input.requestRuntime,
    });
    sendControllerResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/executions/')
    && input.url.endsWith('/queue-skill')
    && input.request.method === 'POST') {
    input.assertRuntimeAvailable();
    const executionId = decodeRouteSegment(
      input.url.slice('/api/codex/executions/'.length, -'/queue-skill'.length),
    );
    const queuePayload = await readJsonObject(input.request);
    const result = await queueCodexSkillAfterExecutionController({
      action_payload: { ...queuePayload, executionId, onLedgerChange: input.onLedgerChange },
      runtime_state: input.requestRuntime,
    });
    sendControllerResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/pipelines/runs/')
    && input.url.endsWith('/cancel')
    && input.request.method === 'POST') {
    const runId = decodeRouteSegment(
      input.url.slice('/api/codex/pipelines/runs/'.length, -'/cancel'.length),
    );
    const payload = await readJsonObject(input.request);
    const result = await cancelCodexPipelineRunController({
      action_payload: { runId, executionId: payload.executionId },
      runtime_state: input.requestRuntime,
    });
    sendControllerResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/pipelines/runs/')
    && input.url.endsWith('/restart')
    && input.request.method === 'POST') {
    input.assertRuntimeAvailable();
    const runId = decodeRouteSegment(
      input.url.slice('/api/codex/pipelines/runs/'.length, -'/restart'.length),
    );
    const result = await restartCodexPipelineRunController({
      action_payload: { runId },
      runtime_state: input.requestRuntime,
    });
    sendControllerResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/pipelines/runs/')
    && input.url.endsWith('/status')
    && input.request.method === 'GET') {
    const runId = decodeRouteSegment(
      input.url.slice('/api/codex/pipelines/runs/'.length, -'/status'.length),
    );
    const result = readCompactPipelineRunStatusController({
      runId,
      runtime: input.requestRuntime,
    });
    input.response.setHeader('cache-control', 'no-store');
    sendControllerResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/pipelines/runs/') && input.request.method === 'GET') {
    const runId = decodeRouteSegment(input.url.slice('/api/codex/pipelines/runs/'.length));
    const result = await readCodexPipelineRunController({
      action_payload: { runId },
      runtime_state: input.requestRuntime,
    });
    sendControllerResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/pipelines/') && input.request.method === 'PUT') {
    const pipelineId = decodeRouteSegment(input.url.slice('/api/codex/pipelines/'.length));
    const savePayload = await readJsonObject(input.request);
    const result = saveCodexPipelineController({
      action_payload: { ...savePayload, pipelineId, operation: 'update' },
      runtime_state: input.requestRuntime,
    });
    if (result.ok === true) input.publishManifest();
    sendControllerResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/server-pipelines/') && input.request.method === 'PUT') {
    const pipelineId = decodeRouteSegment(input.url.slice('/api/codex/server-pipelines/'.length));
    const savePayload = await readJsonObject(input.request);
    const result = saveCodexPipelineController({
      action_payload: {
        ...savePayload,
        pipelineId,
        operation: 'update',
        scope: 'server',
      },
      runtime_state: input.requestRuntime,
    });
    if (result.ok === true) input.publishManifest();
    sendControllerResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
