/**
 * WHAT: Adapts Git review reads and staging mutations to HTTP.
 * WHY: Repository review requests belong to Git review, not server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { applyGitReviewPatch, readGitReview } from '../helper/git-review-patch.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleGitReviewRoutes(input: {
  activeProject: DecisionOsProject | null;
  request: IncomingMessage;
  requestUrl: URL;
  response: ServerResponse;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/git-review' && input.request.method === 'GET' && input.activeProject) {
    try {
      const result = readGitReview({
        workspaceRoot: dirname(input.activeProject.decisionOsRoot),
        repository: input.requestUrl.searchParams.get('repo') ?? '.',
        target: input.requestUrl.searchParams.get('path') ?? '.',
      });
      input.response.setHeader('cache-control', 'no-store');
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: true, ...result }));
    } catch (error) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/git-review/stage' && input.request.method === 'POST' && input.activeProject) {
    try {
      const payload = JSON.parse((await readRequestBuffer(input.request)).toString('utf8')) as AnyRecord;
      const result = applyGitReviewPatch({
        workspaceRoot: dirname(input.activeProject.decisionOsRoot),
        repository: String(payload.repository ?? '.'),
        target: String(payload.target ?? '.'),
        expectedPatchHash: String(payload.expectedPatchHash ?? ''),
        patch: String(payload.patch ?? ''),
        operation: payload.operation === 'unstage' ? 'unstage' : 'stage',
      });
      input.response.setHeader('cache-control', 'no-store');
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: true, ...result }));
    } catch (error) {
      input.response.statusCode = 409;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
