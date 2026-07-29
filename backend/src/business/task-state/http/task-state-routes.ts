/**
 * WHAT: Serves task projections and accepts scoped lifecycle transitions.
 * WHY: Task commands must remain owned by task state instead of generic ledger HTTP code.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { ProjectTaskState } from '../helper/project-task-state.js';
import type { TaskEntityChange } from '../helper/task-current-state-types.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;
type ProjectionEntityChange = {
  entityType: TaskEntityChange['entityType'];
  entityId: string;
};

export async function handleTaskStateRoutes(input: {
  invalidateProject: (
    projectId: string,
    entities: readonly ProjectionEntityChange[],
  ) => void;
  projectScoped: boolean;
  projects: DecisionOsProject[];
  request: IncomingMessage;
  response: ServerResponse;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.projectScoped) return HTTP_ROUTE_NEXT;

  if (input.url === '/api/task-state/projection' && input.request.method === 'GET') {
    const projectId = new URL(
      input.request.url ?? '/',
      'http://127.0.0.1',
    ).searchParams.get('projectId') ?? '';
    const project = input.projects.find((entry) => entry.id === projectId && entry.available);
    if (!project) {
      input.response.statusCode = 404;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: false, error: 'task_state_project_not_found' }));
      return HTTP_ROUTE_HANDLED;
    }
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: true,
      projectId,
      ledger: input.stateForProject(project).projection().ledger,
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/task-state/transition-card-lifecycle'
    && input.request.method === 'POST') {
    const body = JSON.parse(
      (await readRequestBuffer(input.request)).toString('utf8') || '{}',
    ) as AnyRecord;
    const project = input.projects.find(
      (entry) => entry.id === String(body.projectId ?? '') && entry.available,
    );
    const cardId = String(body.cardId ?? '');
    const lifecycleStatus = String(body.lifecycleStatus ?? '');
    if (!project || !cardId || (lifecycleStatus !== 'todo' && lifecycleStatus !== 'done')) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: 'A local project, card, and todo or done lifecycle are required.',
      }));
      return HTTP_ROUTE_HANDLED;
    }
    const state = input.stateForProject(project);
    let committed: Awaited<ReturnType<typeof state.transitionCardLifecycle>>;
    try {
      committed = await state.transitionCardLifecycle(cardId, lifecycleStatus);
    } catch (error) {
      if (error instanceof Error && error.message === 'task_state_bootstrap_incomplete') {
        input.response.statusCode = 503;
        input.response.setHeader('content-type', 'application/json');
        input.response.end(JSON.stringify({
          ok: false,
          error: 'task-state-bootstrap-incomplete',
        }));
        return HTTP_ROUTE_HANDLED;
      }
      if (error instanceof Error && error.message === `task_card_not_found:${cardId}`) {
        input.response.statusCode = 404;
        input.response.setHeader('content-type', 'application/json');
        input.response.end(JSON.stringify({ ok: false, error: 'Card not found.', cardId }));
        return HTTP_ROUTE_HANDLED;
      }
      throw error;
    }
    if (committed.changed) input.invalidateProject(project.id, committed.localChanges);
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: true,
      cardId,
      lifecycleStatus,
      changedBatchCount: Number(committed.changed),
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/task-state/commit' && input.request.method === 'POST') {
    input.response.statusCode = 410;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: false,
      error: 'aggregate_task_state_commit_removed',
    }));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
