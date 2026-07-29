/**
 * WHAT: Serves task execution hierarchy and one execution presentation.
 * WHY: Execution read transport belongs to Codex and consumes runtime projections through callbacks.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import {
  resolveTaskLineage,
  TaskExecutionAdmissionError,
} from '../helper/task-execution-router.js';
import { projectTaskExecutionState } from '../helper/project-task-execution-state.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

export async function handleTaskExecutionReadRoutes(input: {
  presentation: (executionId: string) => Promise<{ body: string; statusCode: number }>;
  queuePosition: (record: ReturnType<ProjectTaskState['executions']['find']>) => number;
  request: IncomingMessage;
  response: ServerResponse;
  state: ProjectTaskState | null;
  url: string;
}): Promise<HttpRouteOutcome> {
  const stateRead = input.request.method === 'GET'
    ? input.url.match(/^\/api\/tasks\/([^/]+)\/execution-state$/)
    : null;
  if (stateRead) {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    const requestedCardId = decodeRouteSegment(stateRead[1]);
    if (!input.state) {
      input.response.statusCode = 503;
      input.response.end(JSON.stringify({
        ok: false,
        error: 'task_execution_state_unavailable',
        taskId: requestedCardId,
      }));
      return HTTP_ROUTE_HANDLED;
    }
    let taskId = requestedCardId;
    try {
      taskId = resolveTaskLineage({
        ledger: input.state.projection().ledger,
        sourceCardId: requestedCardId,
      }).taskId;
    } catch (error) {
      if (!(error instanceof TaskExecutionAdmissionError) || error.code !== 'task_card_not_found') {
        throw error;
      }
      // An optimistic or deleted card has no execution history. This read remains an empty projection.
    }
    input.response.end(JSON.stringify(projectTaskExecutionState({
      taskId,
      state: input.state,
      queuePosition: input.queuePosition,
    })));
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
