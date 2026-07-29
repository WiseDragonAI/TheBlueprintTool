/**
 * WHAT: Handles explicit server restart and Codex continuation diagnostics.
 * WHY: Operator transport controls must remain separate from domain routes.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readRequestBuffer } from '../helper/read-request-buffer.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from './http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleOperationalRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  restartServer: unknown;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/server/restart' && input.request.method === 'POST') {
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: true, restarting: true }));
    setTimeout(() => {
      if (typeof input.restartServer === 'function') input.restartServer();
      else process.exit(0);
    }, 25);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/debug/codex-continue' && input.request.method === 'POST') {
    const bodyBuffer = await readRequestBuffer(input.request);
    const debugPayload = (() => {
      try {
        return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
      } catch {
        return { parseError: true, rawLength: bodyBuffer.length };
      }
    })();
    console.log(JSON.stringify({
      codexContinueDebug: true,
      source: 'frontend',
      receivedAt: new Date().toISOString(),
      ...debugPayload,
    }));
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = 204;
    input.response.end();
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
