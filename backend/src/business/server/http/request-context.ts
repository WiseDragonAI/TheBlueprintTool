/**
 * WHAT: Creates the stable request context shared by ordered HTTP capability handlers.
 * WHY: URL parsing and shutdown propagation must happen once before route dispatch.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpRequestContext } from './http-route.js';

export function createHttpRequestContext(input: {
  request: IncomingMessage;
  response: ServerResponse;
  shutdownSignal: AbortSignal;
}): HttpRequestContext {
  const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
  return {
    method: String(input.request.method ?? 'GET').toUpperCase(),
    request: input.request,
    requestPath: requestUrl.pathname,
    requestUrl,
    response: input.response,
    shutdownSignal: input.shutdownSignal,
  };
}
