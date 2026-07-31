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

async function readReceiptRequest(request: IncomingMessage): Promise<{
  skillName: string;
  revision: string;
}> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    // WHAT: Reject a receipt command after its bounded metadata envelope is exceeded.
    // WHY: Revision acknowledgement never transports skill content in the command body.
    if (bytes > 16 * 1024) throw new Error('Federated skill receipt request is too large.');
    chunks.push(buffer);
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as AnyRecord;
  return { skillName: String(payload.skillName ?? '').trim(), revision: String(payload.revision ?? '').trim() };
}

export async function handleFederatedLibraryRoutes(input: {
  exportPipelines: () => AnyRecord;
  invalidateSkillIndex: () => void;
  projectScoped: boolean;
  readSkillIndex: () => Promise<FederatedSkillExportIndex>;
  receivePublishedSkill: (sourceNodeId: string, skillName: string, revision: string) => Promise<AnyRecord>;
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

  // WHAT: Accept one internal targeted skill receipt command outside project-scoped routing.
  // WHY: Publication proof belongs to the server-authored federation library authority.
  if (input.url === '/api/federation/skills-receipt' && input.request.method === 'POST') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    try {
      const sourceNodeId = String(input.request.headers['x-decision-os-federation-node'] ?? '').trim();
      const { skillName, revision } = await readReceiptRequest(input.request);
      // WHAT: Require the authenticated source identity and exact bounded skill identity before pulling content.
      // WHY: The receipt endpoint must not become a generic unauthenticated federation import trigger.
      if (!sourceNodeId || !skillName || !/^[a-f0-9]{64}$/.test(revision)) {
        input.response.statusCode = 400;
        input.response.end(JSON.stringify({ ok: false, error: 'federated_skill_receipt_request_invalid' }));
        return HTTP_ROUTE_HANDLED;
      }
      input.response.end(JSON.stringify(
        await input.receivePublishedSkill(sourceNodeId, skillName, revision),
      ));
    } catch (error) {
      input.response.statusCode = 502;
      input.response.end(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Federated skill receipt failed.',
      }));
    }
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
