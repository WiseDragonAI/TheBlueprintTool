/**
 * WHAT: Handles node-local Codex capacity and federation settings requests.
 * WHY: Settings adaptation belongs to HTTP while scheduler and connector behavior remain injected capabilities.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { listCodexPipelinesController } from '../../codex/controller/list-codex-pipelines-controller.js';
import { normalizedConcurrentCodexProcesses } from '../helper/save-codex-process-settings.js';
import { readDecisionOsSettings } from '../helper/read-decision-os-settings.js';
import { readRequestBuffer } from '../helper/read-request-buffer.js';
import { saveCodexProcessSettings } from '../helper/save-codex-process-settings.js';
import { saveFederationSettings } from '../helper/save-federation-settings.js';
import { HTTP_ROUTE_HANDLED, HTTP_ROUTE_NEXT, type HttpRouteOutcome } from './http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleSettingsRoutes(input: {
  federation: FederationNodeConnector;
  masterDecisionOsRoot: string;
  onCodexSettingsChanged: () => void;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: AnyRecord;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/settings/codex-processes' && input.request.method === 'GET') {
    const settings = readDecisionOsSettings({
      action_payload: { decisionOsRoot: input.masterDecisionOsRoot },
      runtime_state: input.runtime,
    }).settings as AnyRecord;
    const configured = normalizedConcurrentCodexProcesses(settings.maxConcurrentCodexProcesses) ?? 1;
    const pipelineCatalog = listCodexPipelinesController({
      runtime_state: {
        ...input.runtime,
        decisionOsRoot: input.masterDecisionOsRoot,
        projectId: '',
      },
    });
    const pipelines = Array.isArray(pipelineCatalog.pipelines)
      ? pipelineCatalog.pipelines as AnyRecord[]
      : [];
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: true,
      maxConcurrentCodexProcesses: Number.isInteger(configured) ? configured : 1,
      voicePipelineId: String(settings.voicePipelineId ?? ''),
      masterTaskCompletionPipelineId: String(settings.masterTaskCompletionPipelineId ?? ''),
      pipelines: pipelines.map((pipeline) => ({
        id: String(pipeline.id ?? ''),
        name: String(pipeline.name ?? pipeline.id ?? ''),
      })),
      minimum: 1,
      maximum: 32,
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/settings/codex-processes' && input.request.method === 'PATCH') {
    const bodyBuffer = await readRequestBuffer(input.request);
    let body: AnyRecord = {};
    try {
      body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
    } catch {
      body = {};
    }
    const pipelineCatalog = listCodexPipelinesController({
      runtime_state: {
        ...input.runtime,
        decisionOsRoot: input.masterDecisionOsRoot,
        projectId: '',
      },
    });
    const pipelines = Array.isArray(pipelineCatalog.pipelines)
      ? pipelineCatalog.pipelines as AnyRecord[]
      : [];
    const availablePipelineIds = pipelines.map((pipeline) => String(pipeline.id ?? '')).filter(Boolean);
    const result = saveCodexProcessSettings({
      decisionOsRoot: input.masterDecisionOsRoot,
      runtime: input.runtime,
      maxConcurrentCodexProcesses: body.maxConcurrentCodexProcesses,
      voicePipelineId: body.voicePipelineId,
      masterTaskCompletionPipelineId: body.masterTaskCompletionPipelineId,
      availableVoicePipelineIds: availablePipelineIds,
      availableMasterTaskCompletionPipelineIds: availablePipelineIds,
    });
    if (result.ok === true) input.onCodexSettingsChanged();
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
    input.response.end(JSON.stringify(result));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/settings/federation' && input.request.method === 'GET') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: true, ...input.federation.status() }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/settings/federation' && input.request.method === 'PATCH') {
    const bodyBuffer = await readRequestBuffer(input.request);
    let body: AnyRecord = {};
    try {
      body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
    } catch {
      body = {};
    }
    const result = saveFederationSettings({
      decisionOsRoot: input.masterDecisionOsRoot,
      runtime: input.runtime,
      value: body,
    });
    if (result.ok === true) input.federation.reconfigure(result.settings);
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
    input.response.end(JSON.stringify(result.ok === true
      ? { ok: true, ...input.federation.status() }
      : result));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
