/**
 * WHAT: Parses explicit runtime recovery requests and returns their stable result.
 * WHY: Recovery transport remains failsafe and precedes normal runtime admission.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readRequestBuffer } from '../helper/read-request-buffer.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from './http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleRuntimeRecoveryRoute(input: {
  request: IncomingMessage;
  response: ServerResponse;
  resume: (scope: string, resolution: string) => Promise<AnyRecord>;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url !== '/api/diagnostics/runtime/resume' || input.request.method !== 'POST') {
    return HTTP_ROUTE_NEXT;
  }
  const body = JSON.parse(
    (await readRequestBuffer(input.request)).toString('utf8') || '{}',
  ) as AnyRecord;
  const scope = String(body.scope ?? '').trim();
  const result = await input.resume(
    scope,
    String(body.resolution ?? 'Operator resumed the paused runtime scope.'),
  );
  input.response.statusCode = result.ok === true ? 200 : 409;
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  input.response.end(JSON.stringify(result));
  return HTTP_ROUTE_HANDLED;
}
