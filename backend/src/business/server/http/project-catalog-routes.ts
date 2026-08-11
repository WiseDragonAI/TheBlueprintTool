/**
 * WHAT: Handles project catalog, project canvas, directory, and legacy project-scope HTTP requests.
 * WHY: Project membership and catalog presentation must not be owned by server composition.
 */
import { writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { FederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { federatedProjectCatalog } from '../helper/federated-project-catalog.js';
import { ensureProjectsCanvasDocument } from '../helper/ensure-projects-canvas-document.js';
import { listProjectDirectories } from '../helper/project-directory-browser.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import type { ProjectCatalogStore } from '../helper/project-catalog-store.js';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint } from '../helper/project-url-scope.js';
import { readRequestBuffer } from '../helper/read-request-buffer.js';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { decodeRouteSegment } from './route-segment.js';
import { HTTP_ROUTE_HANDLED, HTTP_ROUTE_NEXT, type HttpRouteOutcome } from './http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleProjectCatalogRoutes(input: {
  controlRoomInvalidation: (projectId?: string) => void;
  federation: FederationNodeConnector;
  masterDecisionOsRoot: string;
  masterRoot: string;
  projectCatalog: () => DecisionOsProject[];
  projectCatalogStore: ProjectCatalogStore;
  projectScope: { scopedPath: string } | null;
  projects: DecisionOsProject[];
  reconcileProjectRuntimes: () => void;
  request: IncomingMessage;
  response: ServerResponse;
  taskStoreForProject: (projectId: string, nodeId?: string) => TaskCurrentStateStore | null;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/decision-os/directories' && input.request.method === 'GET') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    try {
      const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
      const listing = listProjectDirectories({
        masterRoot: input.masterRoot,
        path: requestUrl.searchParams.get('path') ?? '.',
      });
      input.response.end(JSON.stringify({ ok: true, listing }));
    } catch (error) {
      input.response.statusCode = 400;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Directory listing failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/decision-os/projects' && input.request.method === 'GET') {
    const localOwner = input.federation.localOwner();
    const remoteProjects = input.federation.remoteProjects().map((project) => {
      const store = input.taskStoreForProject(project.localProjectId, project.ownerNodeId);
      const replicated = Boolean(store && store.diagnostics().entityCount > 0);
      const replica = {
        status: replicated ? 'replicated' : project.online ? 'synchronizing' : 'offline',
        updatedAt: '',
        message: replicated
          ? ''
          : project.online
            ? 'Synchronizing current task state.'
            : 'Owner offline.',
        resource: '',
      };
      return { ...project, available: project.online || replicated, replica };
    });
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      projects: federatedProjectCatalog({
        localProjects: input.projects,
        remoteProjects,
        localNode: {
          nodeId: localOwner.ownerNodeId,
          nodeLabel: localOwner.ownerNodeLabel,
        },
      }),
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/decision-os/projects-canvas' && input.request.method === 'GET') {
    const canvas = ensureProjectsCanvasDocument({
      masterDecisionOsRoot: input.masterDecisionOsRoot,
      projects: input.projects,
    });
    const summaries = new Map(input.projects.map((project) => [project.id, {
      ledgerCount: project.ledgers.length,
      available: project.available,
      diagnostic: project.diagnostic,
    }]));
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ...canvas.document,
      cards: (canvas.document.cards as AnyRecord[]).map((card) => ({
        ...card,
        projectSummary: summaries.get(String(card.targetProjectId ?? '')) ?? null,
      })),
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/decision-os/projects-canvas' && input.request.method === 'PATCH') {
    const bodyBuffer = await readRequestBuffer(input.request);
    try {
      const mutation = JSON.parse(bodyBuffer.toString('utf8') || '{}') as LedgerMutation;
      const canvas = ensureProjectsCanvasDocument({
        masterDecisionOsRoot: input.masterDecisionOsRoot,
        projects: input.projects,
      });
      if (mutation.action === 'delete-card' && mutation.cardId) {
        const card = (canvas.document.cards as AnyRecord[])
          .find((entry) => String(entry.id ?? '') === mutation.cardId);
        const projectId = String(card?.targetProjectId ?? '');
        if (!projectId) throw new Error('Project card is not registered.');
        input.projectCatalogStore.unregister(projectId);
        input.reconcileProjectRuntimes();
        input.controlRoomInvalidation(projectId);
        const updated = ensureProjectsCanvasDocument({
          masterDecisionOsRoot: input.masterDecisionOsRoot,
          projects: input.projectCatalog(),
        });
        input.response.setHeader('content-type', 'application/json');
        input.response.end(JSON.stringify(updated.document));
        return HTTP_ROUTE_HANDLED;
      }
      if (mutation.action !== 'patch-geometry' && mutation.action !== 'patch-viewport') {
        throw new Error('Projects canvas accepts geometry, viewport, and unregister mutations only.');
      }
      const result = applyLedgerMutation({
        decisionOsRoot: input.masterDecisionOsRoot,
        ledgerPath: canvas.path,
        ledger: canvas.document,
        mutation,
      });
      if (!result.ok) {
        throw new Error(String(result.error?.body?.error ?? 'Projects canvas mutation failed.'));
      }
      writeFileSync(canvas.path, JSON.stringify(result.ledger, null, 2));
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify(result.ledger));
    } catch (error) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Projects canvas mutation failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/decision-os/projects' && input.request.method === 'POST') {
    const bodyBuffer = await readRequestBuffer(input.request);
    try {
      const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
      const project = typeof body.directory === 'string'
        ? input.projectCatalogStore.create(String(body.name ?? ''), String(body.description ?? ''), body.directory)
        : typeof body.path === 'string'
          ? input.projectCatalogStore.register(body.path)
          : input.projectCatalogStore.create(String(body.name ?? ''), String(body.description ?? ''));
      input.federation.publishManifest();
      input.controlRoomInvalidation();
      input.reconcileProjectRuntimes();
      input.response.statusCode = 201;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: true, project }));
    } catch (error) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Project creation failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/decision-os/projects/') && input.request.method === 'PATCH') {
    const projectId = decodeRouteSegment(input.url.slice('/decision-os/projects/'.length));
    const bodyBuffer = await readRequestBuffer(input.request);
    try {
      const body = JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
      const project = typeof body.relativePath === 'string'
        ? input.projectCatalogStore.relink(projectId, body.relativePath)
        : input.projectCatalogStore.update(
          projectId,
          String(body.name ?? ''),
          String(body.description ?? ''),
          String(body.color ?? ''),
        );
      input.reconcileProjectRuntimes();
      input.controlRoomInvalidation(projectId);
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: true, project }));
    } catch (error) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Project update failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/decision-os/projects/') && input.request.method === 'DELETE') {
    const projectId = decodeRouteSegment(input.url.slice('/decision-os/projects/'.length));
    try {
      const project = input.projectCatalogStore.unregister(projectId);
      input.reconcileProjectRuntimes();
      input.controlRoomInvalidation(projectId);
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({ ok: true, project, filesDeleted: false }));
    } catch (error) {
      input.response.statusCode = 400;
      input.response.setHeader('content-type', 'application/json');
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Project unregister failed.',
      }));
    }
    return HTTP_ROUTE_HANDLED;
  }

  if (!input.projectScope
    && isProjectSensitiveEndpoint(input.url)
    && !isGlobalProjectEndpoint(input.url)
    && input.projects.length !== 1) {
    input.response.statusCode = 400;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: false,
      error: 'Project id is required in the URL.',
    }));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
