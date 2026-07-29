/**
 * WHAT: Serves federated skill and pipeline snapshots and explicit synchronization.
 * WHY: Library federation is a capability boundary independent of server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FederatedSkillExportIndex } from '../helper/federated-library-cache.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleFederatedLibraryRoutes(input: {
  exportPipelines: () => AnyRecord;
  invalidateSkillIndex: () => void;
  projectScoped: boolean;
  readSkillIndex: () => Promise<FederatedSkillExportIndex>;
  request: IncomingMessage;
  response: ServerResponse;
  status: () => AnyRecord | undefined;
  synchronize: () => Promise<void>;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.projectScoped) return HTTP_ROUTE_NEXT;

  if (input.url === '/api/federation/skills-manifest' && input.request.method === 'GET') {
    const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.searchParams.get('refresh') === '1') input.invalidateSkillIndex();
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify((await input.readSkillIndex()).manifest));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/federation/skills-snapshot' && input.request.method === 'GET') {
    const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
    const skillName = requestUrl.searchParams.get('name')?.trim() ?? '';
    if (!skillName) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: false, error: 'Skill name is required.' }));
      return HTTP_ROUTE_HANDLED;
    }
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify(
      (await input.readSkillIndex()).snapshot(new Set([skillName])),
    ));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/federation/pipelines-snapshot' && input.request.method === 'GET') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify(input.exportPipelines()));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/federation/libraries/synchronize'
    && input.request.method === 'POST') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    try {
      await input.synchronize();
      const status = input.status();
      if (status?.phase === 'synchronized') {
        input.response.end(JSON.stringify({
          ok: true,
          synchronizedPeerCount: Number(status.synchronizedPeerCount ?? 0),
        }));
      } else {
        input.response.statusCode = 202;
        input.response.end(JSON.stringify({ ok: false, ...status }));
      }
    } catch (error) {
      input.response.statusCode = 502;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error
          ? error.message
          : 'Federated library synchronization failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
