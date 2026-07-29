/**
 * WHAT: Dispatches one HTTP request through capability handlers in declared order.
 * WHY: Route precedence is a behavioral contract and must remain visible during monolith extraction.
 */
import type { HttpRequestContext, HttpRoute, HttpRouteOutcome } from './http-route.js';
import { HTTP_ROUTE_NEXT } from './http-route.js';

export async function dispatchHttpRequest(
  context: HttpRequestContext,
  routes: readonly HttpRoute[],
): Promise<HttpRouteOutcome> {
  for (const route of routes) {
    const outcome = await route(context);
    if (outcome.handled) return outcome;
  }
  return HTTP_ROUTE_NEXT;
}
