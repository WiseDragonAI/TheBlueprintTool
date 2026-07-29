/**
 * WHAT: Adapts project synchronization admission, status, retry, and lock operations to HTTP.
 * WHY: Project-sync transport belongs to its capability instead of server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { createProjectSyncController } from '../controller/start-project-sync.js';
import type { createProjectSyncStore } from '../helper/project-sync-store.js';
import {
  isNetworkGitOrigin,
  readRepositoryOriginIdentity,
  readRepositorySyncStatus,
} from '../helper/repository-sync-status.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleProjectSyncRoutes(input: {
  controller: () => NonNullable<ReturnType<typeof createProjectSyncController>>;
  executeRole: (body: AnyRecord, authenticatedNodeId: string) => Promise<AnyRecord>;
  federation: ReturnType<typeof createFederationNodeConnector>;
  projects: DecisionOsProject[];
  request: IncomingMessage;
  response: ServerResponse;
  store: ReturnType<typeof createProjectSyncStore>;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/project-sync/role' && input.request.method === 'POST') {
    const body = await readRequestBuffer(input.request);
    input.response.setHeader('content-type', 'application/json');
    input.controller();
    try {
      const payload = JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
      const result = await input.executeRole(
        payload,
        String(input.request.headers['x-decision-os-federation-node'] ?? ''),
      );
      input.response.end(JSON.stringify(result));
    } catch (error) {
      input.response.statusCode = 409;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Project synchronization role failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/project-sync/repository-status'
    && input.request.method === 'GET') {
    const projectId = new URL(
      input.request.url ?? '/',
      'http://127.0.0.1',
    ).searchParams.get('projectId') ?? '';
    const project = input.projects.find((entry) => entry.id === projectId && entry.available);
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    if (!project) {
      input.response.statusCode = 404;
      input.response.end(JSON.stringify({ ok: false, error: 'Local project is unavailable.' }));
      return HTTP_ROUTE_HANDLED;
    }
    try {
      const snapshot = readRepositorySyncStatus(project.root);
      if (input.request.headers['x-decision-os-federation-node']
        && !isNetworkGitOrigin(snapshot.originUrl)) {
        throw new Error('Federated synchronization requires a network Git origin.');
      }
      input.response.end(JSON.stringify({ ok: true, projectId, snapshot }));
    } catch (error) {
      input.response.statusCode = 409;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Repository preflight failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/project-sync/lock-release'
    && input.request.method === 'POST') {
    const body = await readRequestBuffer(input.request);
    input.response.setHeader('content-type', 'application/json');
    input.controller();
    try {
      const payload = JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
      if (!String(input.request.headers['x-decision-os-federation-node'] ?? '')) {
        throw new Error('Federation participant authentication failed.');
      }
      input.store.releaseLock(
        String(payload.originFingerprint ?? ''),
        String(payload.syncId ?? ''),
      );
      input.response.end(JSON.stringify({ ok: true }));
    } catch {
      input.response.statusCode = 400;
      input.response.end(JSON.stringify({
        ok: false,
        error: 'Invalid project synchronization lock release.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/project-sync' && input.request.method === 'POST') {
    const body = await readRequestBuffer(input.request);
    input.response.setHeader('content-type', 'application/json');
    const controller = input.controller();
    try {
      const payload = JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
      const sourceId = String(payload.sourceProjectId ?? '');
      const sourceNodeId = String(payload.sourceNodeId ?? '');
      const localOwner = input.federation.localOwner();
      const projects = [
        ...input.projects.map((project) => {
          let originFingerprint = '';
          try {
            originFingerprint = readRepositoryOriginIdentity(project.root).originFingerprint;
          } catch {
            // Admission reports repository identity failures.
          }
          return {
            ...project,
            ...localOwner,
            remote: false,
            localProjectId: project.id,
            originFingerprint,
          };
        }),
        ...input.federation.remoteProjects(),
      ];
      const source = projects.find((project) => (
        String(project.localProjectId ?? project.id) === sourceId
        && (!sourceNodeId || String(project.ownerNodeId) === sourceNodeId)
      ));
      if (!source) throw new Error('Unknown source project.');
      const admitted = controller.start(
        source,
        String(payload.idempotencyKey ?? input.request.headers['idempotency-key'] ?? sourceId),
      );
      input.response.statusCode = admitted.duplicate ? 200 : 202;
      input.response.end(JSON.stringify({
        ok: true,
        duplicate: admitted.duplicate,
        masterCardId: admitted.run.masterCardId,
        ledgerId: admitted.run.ledgerId,
        pipelineRunId: admitted.run.pipelineRunId,
        projectId: admitted.run.taskProjectId || admitted.run.sourceProjectId,
        run: admitted.run,
      }));
    } catch (error) {
      input.response.statusCode = 409;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Project synchronization admission failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/project-sync' && input.request.method === 'GET') {
    input.controller();
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: true, runs: input.store.list() }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/project-sync/')
    && input.url.endsWith('/retry')
    && input.request.method === 'POST') {
    const syncId = decodeRouteSegment(
      input.url.slice('/api/project-sync/'.length, -'/retry'.length),
    );
    input.response.setHeader('content-type', 'application/json');
    try {
      const run = input.controller().retry(syncId);
      input.response.statusCode = 202;
      input.response.end(JSON.stringify({ ok: true, run }));
    } catch (error) {
      input.response.statusCode = 409;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Project synchronization retry failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/project-sync/')
    && input.url !== '/api/project-sync/role'
    && input.url !== '/api/project-sync/repository-status'
    && input.request.method === 'GET') {
    input.controller();
    const syncId = decodeRouteSegment(input.url.slice('/api/project-sync/'.length));
    const run = input.store.read(syncId);
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = run ? 200 : 404;
    input.response.end(JSON.stringify(run
      ? { ok: true, run }
      : { ok: false, error: 'Unknown project synchronization run.' }));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
