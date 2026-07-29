/**
 * WHAT: Serves task-content manifests, immutable objects, and replication diagnostics.
 * WHY: Federation content transport must remain separate from ledger request handling.
 */
import { createReadStream, existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { FederationContentManifest } from '../helper/federation-content-manifest.js';
import { resolveVerifiedManifestResourceFile } from '../helper/federation-content-manifest.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;
type StoreIdentity = {
  ownerNodeId: string;
  projectId: string;
  store: TaskCurrentStateStore;
};

export async function handleFederationContentRoutes(input: {
  contentObjectFile: (hash: string) => string;
  contentStatus: () => AnyRecord;
  localNodeId: string;
  projectScoped: boolean;
  projects: DecisionOsProject[];
  remoteProjectKnown: (projectId: string) => boolean;
  replicationDiagnostics: () => AnyRecord;
  replicationStores: () => StoreIdentity[];
  request: IncomingMessage;
  response: ServerResponse;
  schedulerRunning: boolean;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.projectScoped || input.request.method !== 'GET') return HTTP_ROUTE_NEXT;

  if (input.url === '/api/federation/content-manifest') {
    const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
    const project = input.projects.find(
      (entry) => entry.id === requestUrl.searchParams.get('projectId') && entry.available,
    );
    if (!project) {
      input.response.statusCode = 404;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: false, error: 'Local project is unavailable.' }));
      return HTTP_ROUTE_HANDLED;
    }
    const requestedKey = requestUrl.searchParams.get('key') ?? '';
    const resources = input.stateForProject(project).store.contentHeads(requestedKey)
      .map(({ sourceReplicaId: _sourceReplicaId, ...head }) => head);
    const manifest: FederationContentManifest = {
      version: 1,
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      complete: !requestedKey,
      resources,
    };
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify(manifest));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/federation/replication-status') {
    const stores = input.replicationStores();
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      stateLane: {
        ...input.replicationDiagnostics(),
        projects: stores.map(({ projectId, ownerNodeId, store }) => ({
          projectId,
          ownerNodeId,
          entityCount: store.diagnostics().entityCount,
          journalCount: store.diagnostics().journalCount,
          currentBytes: store.diagnostics().currentBytes,
          conflictCount: store.projection().conflicts.length,
          projectionVersion: store.projection().version,
        })),
      },
      contentLane: {
        ...input.contentStatus(),
        running: input.schedulerRunning,
      },
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url !== '/api/federation/content-object') return HTTP_ROUTE_NEXT;
  const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
  const projectId = requestUrl.searchParams.get('projectId') ?? '';
  const project = input.projects.find((entry) => entry.id === projectId && entry.available);
  if (!project && !input.remoteProjectKnown(projectId)) {
    input.response.statusCode = 404;
    input.response.end();
    return HTTP_ROUTE_HANDLED;
  }
  const hash = requestUrl.searchParams.get('hash') ?? '';
  const validHash = /^[a-f0-9]{64}$/i.test(hash);
  const localFile = project && validHash
    ? resolve(input.stateForProject(project).store.root, 'objects', hash.slice(0, 2), hash)
    : '';
  const cachedFile = validHash ? input.contentObjectFile(hash) : '';
  const head = project && validHash
    ? input.stateForProject(project).store.contentHeads().find((entry) => entry.hash === hash)
    : undefined;
  const referencedFile = project && head
    ? await resolveVerifiedManifestResourceFile({
      decisionOsRoot: project.decisionOsRoot,
      key: head.key,
      hash,
    })
    : '';
  const file = localFile && existsSync(localFile) ? localFile : referencedFile || cachedFile;
  if (!file || !existsSync(file)) {
    input.response.statusCode = 404;
    input.response.end();
    return HTTP_ROUTE_HANDLED;
  }
  input.response.setHeader('cache-control', 'private, max-age=31536000, immutable');
  input.response.setHeader('content-type', 'application/octet-stream');
  const stream = createReadStream(file);
  stream.on('error', () => {
    if (!input.response.headersSent) input.response.statusCode = 500;
    input.response.end();
  });
  stream.pipe(input.response);
  return HTTP_ROUTE_HANDLED;
}
