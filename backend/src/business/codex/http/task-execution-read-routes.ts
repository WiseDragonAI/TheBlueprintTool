/**
 * WHAT: Serves task execution hierarchy and one execution presentation.
 * WHY: Execution read transport belongs to Codex and consumes runtime projections through callbacks.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { projectTaskExecutionState } from '../helper/project-task-execution-state.js';
import { resolveExecutionStateScope } from '../helper/execution-state-scope.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';
import { codexExecutionStatus } from '../helper/codex-execution-status.js';

export async function handleTaskExecutionReadRoutes(input: {
  presentation: (executionId: string) => Promise<{ body: string; statusCode: number }>;
  providerSessionId?: (executionId: string) => string | null;
  queuePosition: (record: ReturnType<ProjectTaskState['executions']['find']>) => number;
  request: IncomingMessage;
  response: ServerResponse;
  state: ProjectTaskState | null;
  url: string;
}): Promise<HttpRouteOutcome> {
  const canonicalStateRead = input.request.method === 'GET'
    ? input.url.match(/^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)\/execution-state$/)
    : null;
  const legacyTaskStateRead = input.request.method === 'GET'
    ? input.url.match(/^\/api\/tasks\/([^/]+)\/execution-state$/)
    : null;
  // WHAT: Serve the canonical ledger-card execution summary and retain the task-only compatibility route.
  // WHY: Ordinary card identity requires an explicit ledger while existing task clients remain valid.
  if (canonicalStateRead || legacyTaskStateRead) {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    const ledgerId = canonicalStateRead ? decodeRouteSegment(canonicalStateRead[1]) : 'tasks';
    const requestedCardId = decodeRouteSegment(canonicalStateRead?.[2] ?? legacyTaskStateRead?.[1] ?? '');
    // WHAT: Contain unavailable synchronized task state inside this read route.
    // WHY: Other project and diagnostic routes must remain available while execution state recovers.
    if (!input.state) {
      input.response.statusCode = 503;
      input.response.end(JSON.stringify({
        ok: false,
        error: 'task_execution_state_unavailable',
        taskId: requestedCardId,
      }));
      return HTTP_ROUTE_HANDLED;
    }
    const scope = resolveExecutionStateScope({
      taskLedger: input.state.projection().ledger,
      ledgerId,
      requestedCardId,
    });
    input.response.end(JSON.stringify(projectTaskExecutionState({
      scope,
      state: input.state,
      queuePosition: input.queuePosition,
    })));
    return HTTP_ROUTE_HANDLED;
  }

  const statusRead = input.request.method === 'GET'
    ? input.url.match(/^\/api\/task-executions\/([^/]+)\/codex-status$/)
    : null;
  if (statusRead) {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    const executionId = decodeRouteSegment(statusRead[1]);
    const execution = input.state?.executions.find(executionId) ?? null;
    // WHAT: Return one stable project-scoped not-found response.
    // WHY: An execution from another project must not leak identity or provider usage.
    if (!execution) {
      input.response.statusCode = 404;
      input.response.end(JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }));
      return HTTP_ROUTE_HANDLED;
    }
    input.response.end(JSON.stringify({ ok: true, status: codexExecutionStatus({ execution, providerSessionId: input.providerSessionId?.(executionId) }) }));
    return HTTP_ROUTE_HANDLED;
  }

  const presentationRead = input.request.method === 'GET'
    ? input.url.match(/^\/api\/task-executions\/([^/]+)$/)
    : null;
  if (!presentationRead) return HTTP_ROUTE_NEXT;
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  const executionId = decodeRouteSegment(presentationRead[1]);
  const result = await input.presentation(executionId);
  input.response.statusCode = result.statusCode;
  input.response.end(result.body);
  return HTTP_ROUTE_HANDLED;
}
