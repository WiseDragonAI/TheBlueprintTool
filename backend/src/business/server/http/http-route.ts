/**
 * WHAT: Defines the ordered Decision OS HTTP route contract.
 * WHY: Capability handlers need explicit fallthrough without depending on the server composition root.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export type HttpRouteOutcome = { handled: true } | { handled: false };

export type HttpRequestContext = {
  method: string;
  request: IncomingMessage;
  requestPath: string;
  requestUrl: URL;
  response: ServerResponse;
  shutdownSignal: AbortSignal;
};

export type HttpRoute = (context: HttpRequestContext) => Promise<HttpRouteOutcome> | HttpRouteOutcome;

export const HTTP_ROUTE_HANDLED: HttpRouteOutcome = Object.freeze({ handled: true });
export const HTTP_ROUTE_NEXT: HttpRouteOutcome = Object.freeze({ handled: false });
