/**
 * WHAT: Adapts skill and thread execution lifecycle operations to HTTP.
 * WHY: Execution request parsing and response shaping belong to Codex.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startCardSkillProcessController } from '../controller/start-card-skill-process-controller.js';
import { startThreadCodexProcessController } from '../controller/start-thread-codex-process-controller.js';
import { readCardSkillRunController } from '../controller/read-card-skill-run-controller.js';
import { readCompactSkillRunStatusController } from '../controller/read-compact-run-status-controller.js';
import { cancelCardSkillRunController } from '../controller/cancel-card-skill-run-controller.js';
import { deleteThreadCodexSessionController } from '../controller/delete-thread-codex-session-controller.js';
import { continueCardSkillRunController } from '../controller/continue-card-skill-run-controller.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

function debug(phase: string, detail: AnyRecord): void {
  console.log(JSON.stringify({
    codexContinueDebug: true,
    source: 'backend',
    phase,
    at: new Date().toISOString(),
    ...detail,
  }));
}

async function readJsonObject(request: IncomingMessage): Promise<AnyRecord> {
  const body = await readRequestBuffer(request);
  try {
    return JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
  } catch {
    return {};
  }
}

function sendResult(response: ServerResponse, result: AnyRecord, successStatus: number): void {
  response.setHeader('content-type', 'application/json');
  response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : successStatus));
  response.end(JSON.stringify(result));
}

export async function handleCodexSkillRunRoutes(input: {
  assertRuntimeAvailable: () => void;
  onLedgerChange: (event: AnyRecord) => void;
  readReplicatedRun: (query: {
    runId: string;
    ledgerId: string;
    cardId: string;
  }) => AnyRecord | null;
  request: IncomingMessage;
  requestRuntime: AnyRecord;
  requestUrl: URL;
  response: ServerResponse;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/codex/skills/process' && input.request.method === 'POST') {
    input.assertRuntimeAvailable();
    const result = await startCardSkillProcessController({
      action_payload: {
        ...await readJsonObject(input.request),
        onLedgerChange: input.onLedgerChange,
      },
      runtime_state: input.requestRuntime,
    });
    sendResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/codex/threads/process' && input.request.method === 'POST') {
    input.assertRuntimeAvailable();
    const result = await startThreadCodexProcessController({
      action_payload: {
        ...await readJsonObject(input.request),
        onLedgerChange: input.onLedgerChange,
      },
      runtime_state: input.requestRuntime,
    });
    sendResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skills/runs/')
    && input.url.endsWith('/status')
    && input.request.method === 'GET') {
    const runId = decodeRouteSegment(
      input.url.slice('/api/codex/skills/runs/'.length, -'/status'.length),
    );
    const result = readCompactSkillRunStatusController({
      runId,
      ledgerId: input.requestUrl.searchParams.get('ledgerId') ?? '',
      cardId: input.requestUrl.searchParams.get('cardId') ?? '',
      runtime: input.requestRuntime,
    });
    input.response.setHeader('cache-control', 'no-store');
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skills/runs/') && input.request.method === 'GET') {
    const runId = decodeURIComponent(input.url.slice('/api/codex/skills/runs/'.length));
    const traceId = input.requestUrl.searchParams.get('traceId') ?? '';
    const ledgerId = input.requestUrl.searchParams.get('ledgerId') ?? '';
    const cardId = input.requestUrl.searchParams.get('cardId') ?? '';
    const since = input.requestUrl.searchParams.get('since') ?? '0';
    if (traceId) debug('status-route-entry', { traceId, runId, ledgerId, cardId, since });
    const replicated = input.readReplicatedRun({ runId, ledgerId, cardId });
    if (replicated) {
      sendResult(input.response, replicated, 200);
      return HTTP_ROUTE_HANDLED;
    }
    const result = await readCardSkillRunController({
      action_payload: { runId, ledgerId, cardId, since, traceId },
      runtime_state: input.requestRuntime,
    });
    if (traceId) {
      debug('status-route-response', {
        traceId,
        runId,
        statusCode: Number(result.statusCode ?? (result.ok === false ? 400 : 200)),
        ok: result.ok,
        status: result.status,
        lineCount: result.lineCount,
        nextSince: result.nextSince,
        persistedEventCount: result.persistedEventCount,
        latestEventType: result.latestEvent && typeof result.latestEvent === 'object'
          ? String((result.latestEvent as AnyRecord).type ?? '')
          : '',
        latestEventLine: result.latestEvent && typeof result.latestEvent === 'object'
          ? String((result.latestEvent as AnyRecord).line ?? '')
          : '',
        error: result.error,
      });
    }
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skills/runs/')
    && input.url.endsWith('/continue')
    && input.request.method === 'POST') {
    input.assertRuntimeAvailable();
    const payload = await readJsonObject(input.request);
    const runId = decodeURIComponent(
      input.url.slice('/api/codex/skills/runs/'.length, -'/continue'.length),
    );
    const traceId = String(payload.traceId ?? '');
    debug('continue-route-entry', {
      traceId,
      runId,
      ledgerId: payload.ledgerId,
      cardId: payload.cardId,
    });
    const result = await continueCardSkillRunController({
      action_payload: { ...payload, runId, onLedgerChange: input.onLedgerChange },
      runtime_state: input.requestRuntime,
    });
    debug('continue-route-response', {
      traceId,
      runId,
      statusCode: Number(result.statusCode ?? (result.ok === false ? 400 : 202)),
      ok: result.ok,
      status: result.status,
      error: result.error,
      pid: result.run && typeof result.run === 'object'
        ? (result.run as AnyRecord).pid
        : undefined,
      continuedMessageCount: result.run && typeof result.run === 'object'
        ? (result.run as AnyRecord).continuedMessageCount
        : undefined,
    });
    sendResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skills/runs/')
    && input.url.endsWith('/cancel')
    && input.request.method === 'POST') {
    const runId = decodeURIComponent(
      input.url.slice('/api/codex/skills/runs/'.length, -'/cancel'.length),
    );
    const result = await cancelCardSkillRunController({
      action_payload: { ...await readJsonObject(input.request), runId },
      runtime_state: input.requestRuntime,
    });
    sendResult(input.response, result, 202);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skills/runs/') && input.request.method === 'DELETE') {
    const runId = decodeURIComponent(input.url.slice('/api/codex/skills/runs/'.length));
    const result = await deleteThreadCodexSessionController({
      action_payload: {
        ...await readJsonObject(input.request),
        runId,
        onLedgerChange: input.onLedgerChange,
      },
      runtime_state: input.requestRuntime,
    });
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
