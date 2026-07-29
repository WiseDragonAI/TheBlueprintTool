/**
 * WHAT: Verifies ordered HTTP dispatch and explicit fallthrough.
 * WHY: Route precedence must remain stable while capability handlers leave the monolith.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HttpRequestContext, HttpRoute } from '../../../../src/business/server/http/http-route.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
} from '../../../../src/business/server/http/http-route.js';
import { dispatchHttpRequest } from '../../../../src/business/server/http/dispatch-http-request.js';

function requestContext(): HttpRequestContext {
  return {
    method: 'GET',
    request: {} as HttpRequestContext['request'],
    requestPath: '/api/health',
    requestUrl: new URL('http://127.0.0.1/api/health'),
    response: {} as HttpRequestContext['response'],
    shutdownSignal: new AbortController().signal,
  };
}

test('stops at the first handler that owns the request', async () => {
  const calls: string[] = [];
  const routes: HttpRoute[] = [
    () => {
      calls.push('first');
      return HTTP_ROUTE_NEXT;
    },
    () => {
      calls.push('second');
      return HTTP_ROUTE_HANDLED;
    },
    () => {
      calls.push('third');
      return HTTP_ROUTE_HANDLED;
    },
  ];

  const outcome = await dispatchHttpRequest(requestContext(), routes);

  assert.deepEqual(outcome, { handled: true });
  assert.deepEqual(calls, ['first', 'second']);
});

test('returns fallthrough when no handler owns the request', async () => {
  const outcome = await dispatchHttpRequest(requestContext(), [
    () => HTTP_ROUTE_NEXT,
    async () => HTTP_ROUTE_NEXT,
  ]);

  assert.deepEqual(outcome, { handled: false });
});
