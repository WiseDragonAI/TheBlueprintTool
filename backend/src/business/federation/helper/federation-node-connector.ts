/**
 * WHAT: Connects one Decision OS server to a federation relay and proxies owner-scoped HTTP streams.
 * WHY: Every node must expose remote projects without copying project state or moving Codex execution.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';

type ProjectManifest = Pick<DecisionOsProject, 'id' | 'name' | 'description' | 'color' | 'ledgers'>;
type RelayFrame = {
  version: 1;
  type: string;
  requestId?: string;
  to?: string;
  direction?: 'request' | 'response';
  bytes?: number;
  data?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  status?: number;
  projects?: ProjectManifest[];
  nodes?: Array<{ nodeId: string; online: boolean; projects: ProjectManifest[] }>;
  code?: string;
  message?: string;
};

export type FederationSettings = {
  relayUrl: string;
  federationId: string;
  nodeId: string;
  nodeCredential: string;
  nodeLabel: string;
};

export type RemoteDecisionOsProject = DecisionOsProject & {
  remote: true;
  ownerNodeId: string;
  ownerNodeLabel: string;
  localProjectId: string;
  online: boolean;
};

const protocolVersion = 1;
const chunkBytes = 64 * 1024;
const creditWindowBytes = 1024 * 1024;
const maximumBodyBytes = 25 * 1024 * 1024;

function configuredSettings(value: unknown): FederationSettings | null {
  const settings = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const relayUrl = String(settings.federationRelayUrl ?? '').trim().replace(/\/$/, '');
  const federationId = String(settings.federationId ?? '').trim();
  const nodeId = String(settings.federationNodeId ?? '').trim();
  const nodeCredential = String(settings.federationNodeCredential ?? '').trim();
  const nodeLabel = String(settings.federationNodeLabel ?? nodeId).trim();
  if (!relayUrl || !federationId || !nodeId || !nodeCredential) return null;
  if (![federationId, nodeId].every((entry) => /^[a-zA-Z0-9_-]+$/.test(entry))) return null;
  return { relayUrl, federationId, nodeId, nodeCredential, nodeLabel: nodeLabel || nodeId };
}

function webSocketUrl(settings: FederationSettings): string {
  const url = new URL(settings.relayUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/connect/${settings.federationId}/${settings.nodeId}`;
  return url.toString();
}

function publicHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  const blocked = new Set(['connection', 'host', 'transfer-encoding', 'upgrade']);
  return Object.fromEntries(Object.entries(headers).flatMap(([key, value]) => {
    if (blocked.has(key.toLowerCase()) || value === undefined) return [];
    return [[key, Array.isArray(value) ? value.join(', ') : value]];
  }));
}

class CreditGate {
  private available = creditWindowBytes;
  private waiters: Array<() => void> = [];

  async consume(bytes: number): Promise<void> {
    while (this.available < bytes) await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.available -= bytes;
  }

  grant(bytes: number): void {
    this.available = Math.min(creditWindowBytes, this.available + bytes);
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}

type RequesterStream = { response: ServerResponse; requestCredit: CreditGate; settled: boolean };
type OwnerStream = {
  method: string;
  path: string;
  headers: Record<string, string>;
  chunks: Buffer[];
  bytes: number;
  responseCredit: CreditGate;
  abort: AbortController;
};

export function createFederationNodeConnector(input: {
  settings: unknown;
  localProjects: () => DecisionOsProject[];
  localServerUrl: () => string;
}) {
  const settings = configuredSettings(input.settings);
  const requesterStreams = new Map<string, RequesterStream>();
  const ownerStreams = new Map<string, OwnerStream>();
  const remoteNodes = new Map<string, { online: boolean; projects: ProjectManifest[] }>();
  let socket: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let stopped = false;
  let reconnectAttempt = 0;
  let messageQueue = Promise.resolve();

  const send = (frame: RelayFrame): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Federation relay is offline.');
    socket.send(JSON.stringify(frame));
  };

  const manifest = (): ProjectManifest[] => input.localProjects()
    .filter((project) => project.available)
    .map(({ id, name, description, color, ledgers }) => ({ id, name, description, color, ledgers }));

  const failRequester = (requestId: string, status: number, code: string, message: string): void => {
    const stream = requesterStreams.get(requestId);
    if (!stream || stream.settled) return;
    stream.settled = true;
    stream.response.statusCode = status;
    stream.response.setHeader('content-type', 'application/json');
    stream.response.end(JSON.stringify({ ok: false, error: code, message }));
    requesterStreams.delete(requestId);
  };

  const sendChunks = async (requestId: string, direction: 'request' | 'response', buffer: Uint8Array, gate: CreditGate): Promise<void> => {
    for (let offset = 0; offset < buffer.byteLength; offset += chunkBytes) {
      const chunk = buffer.subarray(offset, Math.min(buffer.byteLength, offset + chunkBytes));
      await gate.consume(chunk.byteLength);
      send({ version: 1, type: `${direction}-chunk`, requestId, data: Buffer.from(chunk).toString('base64') });
    }
  };

  const handleOwnerRequest = async (requestId: string): Promise<void> => {
    const stream = ownerStreams.get(requestId);
    if (!stream) return;
    try {
      const result = await fetch(`${input.localServerUrl()}${stream.path}`, {
        method: stream.method,
        headers: stream.headers,
        body: ['GET', 'HEAD'].includes(stream.method) ? undefined : Buffer.concat(stream.chunks),
        signal: stream.abort.signal,
        redirect: 'manual',
      });
      const headers = Object.fromEntries([...result.headers].filter(([key]) => !['connection', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())));
      send({ version: 1, type: 'response-open', requestId, status: result.status, headers });
      if (result.body) {
        const reader = result.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          await sendChunks(requestId, 'response', value, stream.responseCredit);
        }
      }
      send({ version: 1, type: 'response-end', requestId });
    } catch (error) {
      send({
        version: 1,
        type: 'response-error',
        requestId,
        code: error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'owner_request_failed',
        message: error instanceof Error ? error.message : 'Owner request failed.',
      });
    } finally {
      ownerStreams.delete(requestId);
    }
  };

  const handleFrame = async (frame: RelayFrame): Promise<void> => {
    if (frame.type === 'catalog') {
      remoteNodes.clear();
      for (const node of frame.nodes ?? []) {
        if (node.nodeId !== settings?.nodeId) remoteNodes.set(node.nodeId, { online: node.online, projects: node.projects });
      }
      return;
    }
    const requestId = String(frame.requestId ?? '');
    if (!requestId) return;
    if (frame.type === 'request-open') {
      ownerStreams.set(requestId, {
        method: String(frame.method ?? 'GET').toUpperCase(),
        path: String(frame.path ?? '/'),
        headers: frame.headers ?? {},
        chunks: [],
        bytes: 0,
        responseCredit: new CreditGate(),
        abort: new AbortController(),
      });
      return;
    }
    const owner = ownerStreams.get(requestId);
    if (frame.type === 'request-chunk' && owner) {
      const chunk = Buffer.from(String(frame.data ?? ''), 'base64');
      owner.bytes += chunk.byteLength;
      if (owner.bytes > maximumBodyBytes) {
        ownerStreams.delete(requestId);
        send({ version: 1, type: 'response-error', requestId, code: 'federation_body_limit', message: 'Remote body exceeds 25 MiB.' });
        return;
      }
      owner.chunks.push(chunk);
      send({ version: 1, type: 'credit', requestId, direction: 'request', bytes: chunk.byteLength });
      return;
    }
    if (frame.type === 'request-end' && owner) {
      void handleOwnerRequest(requestId);
      return;
    }
    if (frame.type === 'cancel' && owner) {
      owner.abort.abort();
      ownerStreams.delete(requestId);
      return;
    }
    if (frame.type === 'credit') {
      const requester = requesterStreams.get(requestId);
      if (frame.direction === 'request' && requester) requester.requestCredit.grant(Number(frame.bytes ?? 0));
      if (frame.direction === 'response' && owner) owner.responseCredit.grant(Number(frame.bytes ?? 0));
      return;
    }
    const requester = requesterStreams.get(requestId);
    if (!requester) return;
    if (frame.type === 'response-open') {
      requester.response.statusCode = Number(frame.status ?? 502);
      for (const [key, value] of Object.entries(frame.headers ?? {})) requester.response.setHeader(key, value);
      return;
    }
    if (frame.type === 'response-chunk') {
      const chunk = Buffer.from(String(frame.data ?? ''), 'base64');
      if (!requester.response.write(chunk)) await once(requester.response, 'drain');
      send({ version: 1, type: 'credit', requestId, direction: 'response', bytes: chunk.byteLength });
      return;
    }
    if (frame.type === 'response-end') {
      requester.settled = true;
      requester.response.end();
      requesterStreams.delete(requestId);
      return;
    }
    if (frame.type === 'response-error') {
      const status = frame.code === 'owner_offline' ? 503 : frame.code === 'federation_body_limit' ? 413 : 502;
      failRequester(requestId, status, String(frame.code ?? 'federation_error'), String(frame.message ?? 'Federation request failed.'));
    }
  };

  const connect = (): void => {
    if (!settings || stopped) return;
    const active = new WebSocket(webSocketUrl(settings), { headers: { authorization: `Bearer ${settings.nodeCredential}` } });
    socket = active;
    active.addEventListener('open', () => {
      reconnectAttempt = 0;
      send({ version: 1, type: 'manifest', projects: manifest() });
    });
    active.addEventListener('message', (event) => {
      messageQueue = messageQueue.then(async () => {
        const text = typeof event.data === 'string'
          ? event.data
          : Buffer.isBuffer(event.data)
            ? event.data.toString('utf8')
            : Buffer.from(event.data as ArrayBuffer).toString('utf8');
        await handleFrame(JSON.parse(text) as RelayFrame);
      }).catch(() => undefined);
    });
    active.addEventListener('error', () => undefined);
    active.addEventListener('close', () => {
      if (socket === active) socket = null;
      for (const requestId of requesterStreams.keys()) failRequester(requestId, 502, 'federation_outcome_unknown', 'Relay disconnected before the owner response completed.');
      for (const stream of remoteNodes.values()) stream.online = false;
      if (!stopped) {
        const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt) * (0.75 + Math.random() * 0.5);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
        reconnectTimer.unref?.();
      }
    });
  };

  return {
    configured: Boolean(settings),
    status(): { configured: boolean; socketState: number | null } {
      return { configured: Boolean(settings), socketState: socket?.readyState ?? null };
    },
    start: connect,
    stop(): void {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close(1000, 'server_stopped');
      socket = null;
    },
    publishManifest(): void {
      if (socket?.readyState === WebSocket.OPEN) send({ version: 1, type: 'manifest', projects: manifest() });
    },
    remoteProjects(): RemoteDecisionOsProject[] {
      if (!settings) return [];
      return [...remoteNodes].flatMap(([ownerNodeId, node]) => node.projects.map((project) => ({
        ...project,
        id: `${ownerNodeId}:${project.id}`,
        localProjectId: project.id,
        ownerNodeId,
        ownerNodeLabel: ownerNodeId,
        remote: true as const,
        online: node.online,
        available: node.online,
        diagnostic: node.online ? '' : 'Owner offline',
        relativePath: '',
        root: '',
        decisionOsRoot: '',
      })));
    },
    async proxy(request: IncomingMessage, response: ServerResponse, ownerNodeId: string, localProjectId: string, scopedPath: string): Promise<void> {
      if (!settings || !remoteNodes.get(ownerNodeId)?.online || socket?.readyState !== WebSocket.OPEN) {
        response.statusCode = 503;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: false, error: 'owner_offline' }));
        return;
      }
      const requestId = randomUUID();
      const requestCredit = new CreditGate();
      requesterStreams.set(requestId, { response, requestCredit, settled: false });
      response.on('close', () => {
        if (requesterStreams.has(requestId)) {
          try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Relay already closed. */ }
          requesterStreams.delete(requestId);
        }
      });
      const query = (request.url ?? '').includes('?') ? `?${(request.url ?? '').split('?').slice(1).join('?')}` : '';
      const ownerPath = `/p/${encodeURIComponent(localProjectId)}${scopedPath}${query}`;
      send({ version: 1, type: 'request-open', requestId, to: ownerNodeId, method: request.method ?? 'GET', path: ownerPath, headers: publicHeaders(request.headers) });
      let total = 0;
      for await (const part of request) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        total += chunk.byteLength;
        if (total > maximumBodyBytes) {
          send({ version: 1, type: 'cancel', requestId });
          failRequester(requestId, 413, 'federation_body_limit', 'Remote body exceeds 25 MiB.');
          return;
        }
        await sendChunks(requestId, 'request', chunk, requestCredit);
      }
      send({ version: 1, type: 'request-end', requestId });
    },
  };
}

export type FederationNodeConnector = ReturnType<typeof createFederationNodeConnector>;
