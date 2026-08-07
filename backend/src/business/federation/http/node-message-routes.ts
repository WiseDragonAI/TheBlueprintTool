import type { IncomingMessage, ServerResponse } from 'node:http';
import { executeNodeMessage } from '../helper/execute-node-message.js';
import type { createFederationNodeConnector } from '../helper/federation-node-connector.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import { availableRepositoryOriginFingerprint } from '../../project-sync/helper/repository-sync-status.js';

type AnyRecord = Record<string, unknown>;
type Federation = ReturnType<typeof createFederationNodeConnector>;

type NodeMessageRoutesInput = {
  federation: Federation;
  messageTimeoutMs: number;
  projectRuntime: (project: DecisionOsProject) => AnyRecord;
  projects: readonly DecisionOsProject[];
  recordFailure: (input: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: AnyRecord;
  }) => string;
  projectScoped: boolean;
  request: IncomingMessage;
  response: ServerResponse;
  url: string;
};

function requestAbort(input: NodeMessageRoutesInput) {
  const abort = new AbortController();
  const abortExecution = (): void => abort.abort(new Error('node_message_client_disconnected'));
  const abortOnResponseClose = (): void => {
    if (!input.response.writableEnded) abortExecution();
  };
  input.request.once('aborted', abortExecution);
  input.response.once('close', abortOnResponseClose);
  return {
    signal: abort.signal,
    dispose: () => {
      input.request.off('aborted', abortExecution);
      input.response.off('close', abortOnResponseClose);
    },
  };
}

export async function handleNodeMessageRoutes(
  input: NodeMessageRoutesInput,
): Promise<{ handled: boolean }> {
  const { federation, request, response } = input;
  if (!input.projectScoped && input.url === '/api/federation/nodes' && request.method === 'GET') {
    const localOwner = federation.localOwner();
    const nodes = [
      {
        nodeId: localOwner.ownerNodeId,
        nodeLabel: localOwner.ownerNodeLabel,
        online: true,
        local: true,
        projects: input.projects.filter((project) => project.available).map((project) => ({
          projectId: project.id,
          name: project.name,
          available: project.available,
          originFingerprint: availableRepositoryOriginFingerprint(project.root),
        })),
      },
      ...federation.topologyNodes().map((node) => ({
        nodeId: node.nodeId,
        nodeLabel: node.nodeLabel,
        online: node.online,
        local: false,
        projects: node.projects.map((project) => ({
          projectId: project.projectId,
          name: project.projectId,
          available: node.online,
          originFingerprint: project.originFingerprint,
        })),
      })),
    ];
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, observedAt: new Date().toISOString(), nodes }));
    return { handled: true };
  }

  if (!input.projectScoped
    && input.url === '/api/federation/node-message-executions'
    && request.method === 'POST') {
    response.setHeader('content-type', 'application/json');
    const requesterNodeId = String(request.headers['x-decision-os-federation-node'] ?? '').trim();
    const peer = federation.nodes().find((node) => node.nodeId === requesterNodeId && node.online);
    if (!requesterNodeId || !peer) {
      response.statusCode = 403;
      response.end(JSON.stringify({ ok: false, error: 'Federation node authentication failed.' }));
      return { handled: true };
    }
    const scope = requestAbort(input);
    try {
      const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
      const projectId = String(body.projectId ?? '').trim();
      const project = input.projects.find((entry) => entry.id === projectId && entry.available);
      if (!project) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, error: 'Target project is unavailable.', projectId }));
        return { handled: true };
      }
      const owner = federation.localOwner();
      response.end(JSON.stringify(await executeNodeMessage({
        project,
        runtime: input.projectRuntime(project),
        requesterNodeId,
        executorNodeId: owner.ownerNodeId,
        executorNodeLabel: owner.ownerNodeLabel,
        message: String(body.message ?? ''),
        codexModel: body.codexModel,
        codexEffort: body.codexEffort,
        signal: scope.signal,
      })));
    } catch (error) {
      response.statusCode = scope.signal.aborted ? 499 : error instanceof RangeError ? 400 : 502;
      const incidentId = !scope.signal.aborted && !(error instanceof RangeError)
        ? input.recordFailure({
          scope: `node-message-execution:${requesterNodeId}`,
          component: 'federation-node-message',
          operation: 'execute-node-message',
          error,
          context: { requesterNodeId },
        })
        : '';
      response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Node message execution failed.',
        ...(incidentId ? { incidentId } : {}),
      }));
    } finally {
      scope.dispose();
    }
    return { handled: true };
  }

  const dispatch = !input.projectScoped && request.method === 'POST'
    ? input.url.match(/^\/api\/federation\/nodes\/([^/]+)\/messages$/)
    : null;
  if (!dispatch) return { handled: false };
  response.setHeader('content-type', 'application/json');
  const targetNodeId = decodeRouteSegment(dispatch[1]);
  const scope = requestAbort(input);
  try {
    const body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as AnyRecord;
    const projectId = String(body.projectId ?? '').trim();
    const owner = federation.localOwner();
    if (targetNodeId === owner.ownerNodeId) {
      const project = input.projects.find((entry) => entry.id === projectId && entry.available);
      if (!project) {
        response.statusCode = 404;
        response.end(JSON.stringify({
          ok: false,
          error: 'Target project is unavailable.',
          projectId,
          nodeId: targetNodeId,
        }));
        return { handled: true };
      }
      response.end(JSON.stringify(await executeNodeMessage({
        project,
        runtime: input.projectRuntime(project),
        requesterNodeId: owner.ownerNodeId,
        executorNodeId: owner.ownerNodeId,
        executorNodeLabel: owner.ownerNodeLabel,
        message: String(body.message ?? ''),
        codexModel: body.codexModel,
        codexEffort: body.codexEffort,
        signal: scope.signal,
      })));
      return { handled: true };
    }
    const remoteProject = federation.remoteProjects().find((project) => (
      project.ownerNodeId === targetNodeId
      && project.localProjectId === projectId
      && project.online
    ));
    if (!remoteProject) {
      response.statusCode = 404;
      response.end(JSON.stringify({
        ok: false,
        error: 'Target federation node project is unavailable.',
        projectId,
        nodeId: targetNodeId,
      }));
      return { handled: true };
    }
    const remote = await federation.request(targetNodeId, '/api/federation/node-message-executions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        projectId,
        message: body.message,
        codexModel: body.codexModel,
        codexEffort: body.codexEffort,
      })),
      timeoutMs: input.messageTimeoutMs,
      signal: scope.signal,
    });
    response.statusCode = remote.status;
    response.end(remote.body);
  } catch (error) {
    response.statusCode = scope.signal.aborted
      ? 499
      : error instanceof RangeError || error instanceof SyntaxError
        ? 400
        : 502;
    const incidentId = !scope.signal.aborted
      && !(error instanceof RangeError)
      && !(error instanceof SyntaxError)
      ? input.recordFailure({
        scope: `node-message-dispatch:${targetNodeId}`,
        component: 'federation-node-message',
        operation: 'dispatch-node-message',
        error,
        context: { targetNodeId },
      })
      : '';
    response.end(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Node message dispatch failed.',
      ...(incidentId ? { incidentId } : {}),
    }));
  } finally {
    scope.dispose();
  }
  return { handled: true };
}
