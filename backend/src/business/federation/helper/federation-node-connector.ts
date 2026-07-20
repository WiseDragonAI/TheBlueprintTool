/**
 * WHAT: Connects one Decision OS server to a federation relay and proxies owner-scoped HTTP streams.
 * WHY: Every node must expose remote projects without copying project state or moving Codex execution.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readRepositoryOriginIdentity } from '../../project-sync/helper/repository-sync-status.js';

type ProjectManifest = Pick<DecisionOsProject, 'id' | 'name' | 'description' | 'color' | 'ledgers' | 'originFingerprint'>;
type RelayFrame = {
  version: 1;
  type: string;
  requestId?: string;
  to?: string;
  from?: string;
  direction?: 'request' | 'response';
  bytes?: number;
  data?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  status?: number;
  nodeLabel?: string;
  projects?: ProjectManifest[];
  nodes?: Array<{ nodeId: string; nodeLabel?: string; online: boolean; projects: ProjectManifest[] }>;
  code?: string;
  message?: string;
  projectId?: string;
  stateVersion?: 1;
  payload?: unknown;
};

export type FederationStateFrame = {
  type: 'state-event-batch' | 'state-relay-ack' | 'state-ack' | 'state-bucket-summary' | 'state-missing-request' | 'state-snapshot-manifest' | 'state-snapshot-request' | 'state-snapshot-chunk' | 'state-snapshot-end' | 'state-converged';
  from: string;
  projectId: string;
  payload: unknown;
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
const connectTimeoutMs = 10_000;
const defaultInternalRequestTimeoutMs = 15_000;

type FederationConnectionPhase = 'not_configured' | 'connecting' | 'retrying' | 'connected' | 'disconnected';

function configuredSettings(value: unknown): FederationSettings | null {
  const settings = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const relayUrl = String(settings.federationRelayUrl ?? '').trim().replace(/\/$/, '');
  const federationId = String(settings.federationId ?? '').trim();
  const nodeId = String(settings.federationNodeId ?? '').trim();
  const nodeCredential = String(settings.federationNodeCredential ?? '').trim();
  const nodeLabel = String(settings.federationNodeLabel ?? nodeId).trim();
  if (!relayUrl || !federationId || !nodeId || !nodeCredential) return null;
  if (![federationId, nodeId].every((entry) => /^[a-zA-Z0-9_-]+$/.test(entry))) return null;
  try {
    const parsed = new URL(relayUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }
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

type InternalResponse = { status: number; headers: Record<string, string>; body: Buffer };
type RequesterStream = {
  response?: ServerResponse;
  requestCredit: CreditGate;
  settled: boolean;
  status: number;
  headers: Record<string, string>;
  chunks: Buffer[];
  bytes: number;
  resolve?: (response: InternalResponse) => void;
  timeout?: NodeJS.Timeout;
};
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
  onRemoteContentChange?: (nodeId: string) => void;
  onRemoteCatalogChange?: () => void;
  onStateConnected?: () => void;
  onStateFrame?: (frame: FederationStateFrame) => void | Promise<void>;
  internalRequestTimeoutMs?: number;
}) {
  const internalRequestTimeoutMs = input.internalRequestTimeoutMs ?? defaultInternalRequestTimeoutMs;
  let settings = configuredSettings(input.settings);
  const requesterStreams = new Map<string, RequesterStream>();
  const ownerStreams = new Map<string, OwnerStream>();
  const remoteNodes = new Map<string, { nodeLabel: string; online: boolean; projects: ProjectManifest[] }>();
  let socket: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let connectTimer: NodeJS.Timeout | null = null;
  let stopped = false;
  let reconnectAttempt = 0;
  let messageQueue = Promise.resolve();
  let phase: FederationConnectionPhase = settings ? 'disconnected' : 'not_configured';
  let phaseSince = Date.now();
  let connectionStartedAt: number | null = null;
  let connectedAt: number | null = null;
  let lastConnectedAt: number | null = null;
  let lastDisconnectedAt: number | null = null;
  let nextRetryAt: number | null = null;
  let lastError = '';
  let lastCloseCode: number | null = null;
  let lastCloseReason = '';

  const setPhase = (value: FederationConnectionPhase): void => {
    if (phase !== value) phaseSince = Date.now();
    phase = value;
  };

  const clearConnectTimer = (): void => {
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = null;
  };

  const send = (frame: RelayFrame): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Federation relay is offline.');
    socket.send(JSON.stringify(frame));
  };

  const manifest = (): ProjectManifest[] => input.localProjects()
    .filter((project) => project.available)
    .map(({ id, name, description, color, ledgers, root }) => {
      let fingerprint = '';
      try { fingerprint = readRepositoryOriginIdentity(root).originFingerprint; } catch { /* Non-Git projects remain visible but cannot synchronize. */ }
      return { id, name, description, color, ledgers, originFingerprint: fingerprint };
    });

  const settleInternal = (stream: RequesterStream, status: number, headers: Record<string, string>, body: Buffer): void => {
    stream.resolve?.({ status, headers, body });
  };

  const failRequester = (requestId: string, status: number, code: string, message: string): void => {
    const stream = requesterStreams.get(requestId);
    if (!stream || stream.settled) return;
    stream.settled = true;
    if (stream.timeout) clearTimeout(stream.timeout);
    const body = Buffer.from(JSON.stringify({ ok: false, error: code, message }));
    if (stream.response) {
      stream.response.statusCode = status;
      stream.response.setHeader('content-type', 'application/json');
      stream.response.end(body);
    } else settleInternal(stream, status, { 'content-type': 'application/json' }, body);
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
      try {
        send({
          version: 1,
          type: 'response-error',
          requestId,
          code: error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'owner_request_failed',
          message: error instanceof Error ? error.message : 'Owner request failed.',
        });
      } catch {
        // The relay can close while an owner-side fetch is being aborted during shutdown.
      }
    } finally {
      ownerStreams.delete(requestId);
    }
  };

  const handleFrame = async (frame: RelayFrame): Promise<void> => {
    if (frame.type === 'catalog') {
      remoteNodes.clear();
      for (const node of frame.nodes ?? []) {
        if (node.nodeId !== settings?.nodeId) remoteNodes.set(node.nodeId, { nodeLabel: String(node.nodeLabel || node.nodeId), online: node.online, projects: node.projects });
      }
      input.onRemoteCatalogChange?.();
      return;
    }
    if (frame.type === 'content-change') {
      input.onRemoteContentChange?.(String(frame.from ?? ''));
      return;
    }
    if (frame.type.startsWith('state-')) {
      await input.onStateFrame?.({
        type: frame.type as FederationStateFrame['type'],
        from: String(frame.from ?? ''),
        projectId: String(frame.projectId ?? ''),
        payload: frame.payload,
      });
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
      requester.status = Number(frame.status ?? 502);
      requester.headers = frame.headers ?? {};
      if (requester.response) {
        requester.response.statusCode = requester.status;
        for (const [key, value] of Object.entries(requester.headers)) requester.response.setHeader(key, value);
      }
      return;
    }
    if (frame.type === 'response-chunk') {
      const chunk = Buffer.from(String(frame.data ?? ''), 'base64');
      requester.bytes += chunk.byteLength;
      if (requester.bytes > maximumBodyBytes) {
        failRequester(requestId, 413, 'federation_body_limit', 'Remote response exceeds 25 MiB.');
        return;
      }
      if (requester.response) {
        if (!requester.response.write(chunk)) await once(requester.response, 'drain');
      } else requester.chunks.push(chunk);
      send({ version: 1, type: 'credit', requestId, direction: 'response', bytes: chunk.byteLength });
      return;
    }
    if (frame.type === 'response-end') {
      requester.settled = true;
      if (requester.timeout) clearTimeout(requester.timeout);
      if (requester.response) requester.response.end();
      else settleInternal(requester, requester.status, requester.headers, Buffer.concat(requester.chunks));
      requesterStreams.delete(requestId);
      return;
    }
    if (frame.type === 'response-error') {
      const status = frame.code === 'owner_offline' ? 503 : frame.code === 'federation_body_limit' ? 413 : 502;
      failRequester(requestId, status, String(frame.code ?? 'federation_error'), String(frame.message ?? 'Federation request failed.'));
    }
  };

  const openRequest = (ownerNodeId: string, path: string, options: { method?: string; body?: Buffer; headers?: Record<string, string> } = {}): { requestId: string; response: Promise<InternalResponse> } => {
    if (!settings || !remoteNodes.get(ownerNodeId)?.online || socket?.readyState !== WebSocket.OPEN) {
      return { requestId: '', response: Promise.resolve({ status: 503, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":false,"error":"owner_offline"}') }) };
    }
    const requestId = randomUUID();
    const method = String(options.method ?? 'GET').toUpperCase();
    const body = options.body ?? Buffer.alloc(0);
    if (body.byteLength > maximumBodyBytes) return { requestId: '', response: Promise.resolve({ status: 413, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":false,"error":"federation_body_limit"}') }) };
    let resolveResponse: (response: InternalResponse) => void = () => undefined;
    const response = new Promise<InternalResponse>((resolve) => { resolveResponse = resolve; });
    const stream: RequesterStream = {
      requestCredit: new CreditGate(), settled: false, status: 502, headers: {}, chunks: [], bytes: 0,
      resolve: resolveResponse,
    };
    stream.timeout = setTimeout(() => {
      if (!requesterStreams.has(requestId)) return;
      try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Connection settlement owns relay cleanup. */ }
      failRequester(requestId, 504, 'federation_request_timeout', `Federation request exceeded ${internalRequestTimeoutMs}ms.`);
    }, internalRequestTimeoutMs);
    stream.timeout.unref?.();
    requesterStreams.set(requestId, stream);
    send({
      version: 1,
      type: 'request-open',
      requestId,
      to: ownerNodeId,
      method,
      path,
      headers: { ...options.headers, 'x-decision-os-federation-node': settings.nodeId },
    });
    for (let offset = 0; offset < body.byteLength; offset += chunkBytes) {
      const chunk = body.subarray(offset, Math.min(body.byteLength, offset + chunkBytes));
      send({ version: 1, type: 'request-chunk', requestId, data: chunk.toString('base64') });
    }
    send({ version: 1, type: 'request-end', requestId });
    return { requestId, response };
  };

  const connect = (): void => {
    if (!settings || stopped) return;
    nextRetryAt = null;
    if (connectionStartedAt === null) connectionStartedAt = Date.now();
    setPhase(reconnectAttempt > 0 ? 'retrying' : 'connecting');
    const active = new WebSocket(webSocketUrl(settings), { headers: { authorization: `Bearer ${settings.nodeCredential}` } });
    let retryAllowed = true;
    socket = active;
    const stopForAuthenticationFailure = (statusCode: number): void => {
      retryAllowed = false;
      lastError = `Relay rejected node authentication (${statusCode}). Save valid federation credentials to reconnect.`;
      clearConnectTimer();
      if (socket === active) socket = null;
      connectedAt = null;
      lastDisconnectedAt = Date.now();
      lastCloseCode = null;
      lastCloseReason = `HTTP ${statusCode}`;
      connectionStartedAt = null;
      nextRetryAt = null;
      for (const requestId of requesterStreams.keys()) failRequester(requestId, 502, 'federation_authentication', lastError);
      for (const stream of remoteNodes.values()) stream.online = false;
      setPhase('disconnected');
    };
    connectTimer = setTimeout(() => {
      if (socket !== active || active.readyState === WebSocket.OPEN) return;
      lastError = `Relay connection attempt timed out after ${connectTimeoutMs / 1_000} seconds.`;
      active.terminate();
    }, connectTimeoutMs);
    connectTimer.unref?.();
    active.addEventListener('open', () => {
      clearConnectTimer();
      reconnectAttempt = 0;
      connectedAt = Date.now();
      lastConnectedAt = connectedAt;
      connectionStartedAt = null;
      nextRetryAt = null;
      lastError = '';
      lastCloseCode = null;
      lastCloseReason = '';
      setPhase('connected');
      send({ version: 1, type: 'manifest', nodeLabel: settings?.nodeLabel, projects: manifest() });
      input.onStateConnected?.();
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
    active.on('error', (error) => {
      const authentication = error.message.match(/^Unexpected server response: (401|403)$/);
      if (authentication) stopForAuthenticationFailure(Number(authentication[1]));
      else if (retryAllowed && error.message) lastError = error.message;
    });
    active.on('unexpected-response', (_request, response) => {
      if (response.statusCode === 401 || response.statusCode === 403) {
        stopForAuthenticationFailure(response.statusCode);
      }
      response.resume();
      active.terminate();
    });
    active.addEventListener('close', (event) => {
      if (socket !== active) return;
      clearConnectTimer();
      socket = null;
      connectedAt = null;
      lastDisconnectedAt = Date.now();
      lastCloseCode = event.code;
      lastCloseReason = event.reason;
      if (event.code === 4001) {
        retryAllowed = false;
        lastError = 'Another server connected with this node ID. Save a unique node identity to reconnect this server.';
      }
      else if (!lastError && event.reason) lastError = event.reason;
      for (const requestId of requesterStreams.keys()) failRequester(requestId, 502, 'federation_outcome_unknown', 'Relay disconnected before the owner response completed.');
      for (const stream of remoteNodes.values()) stream.online = false;
      if (!stopped && retryAllowed) {
        const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt) * (0.75 + Math.random() * 0.5);
        reconnectAttempt += 1;
        nextRetryAt = Date.now() + delay;
        setPhase('retrying');
        reconnectTimer = setTimeout(connect, delay);
        reconnectTimer.unref?.();
      } else {
        connectionStartedAt = null;
        nextRetryAt = null;
        setPhase(settings ? 'disconnected' : 'not_configured');
      }
    });
  };

  return {
    get configured(): boolean { return Boolean(settings); },
    status() {
      return {
        configured: Boolean(settings), connected: socket?.readyState === WebSocket.OPEN, socketState: socket?.readyState ?? null,
        phase,
        observedAt: Date.now(),
        phaseSince,
        connectionStartedAt,
        connectedAt,
        lastConnectedAt,
        lastDisconnectedAt,
        reconnectAttempt,
        nextRetryAt,
        connectTimeoutMs,
        internalRequestTimeoutMs,
        lastError,
        lastCloseCode,
        lastCloseReason,
        relayUrl: settings?.relayUrl ?? '', federationId: settings?.federationId ?? '', nodeId: settings?.nodeId ?? '', nodeLabel: settings?.nodeLabel ?? '', credentialConfigured: Boolean(settings?.nodeCredential),
        peers: [...remoteNodes].map(([nodeId, node]) => ({ nodeId, nodeLabel: node.nodeLabel, online: node.online, projectCount: node.projects.length })),
      };
    },
    start(): void { stopped = false; connect(); },
    stop(): void {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      clearConnectTimer();
      for (const requestId of requesterStreams.keys()) failRequester(requestId, 502, 'federation_reconfigured', 'Federation connection was reconfigured.');
      for (const stream of ownerStreams.values()) stream.abort.abort();
      ownerStreams.clear();
      socket?.close(1000, 'server_stopped');
      socket = null;
      connectedAt = null;
      nextRetryAt = null;
      connectionStartedAt = null;
      remoteNodes.clear();
      setPhase(settings ? 'disconnected' : 'not_configured');
    },
    reconfigure(value: unknown): void {
      this.stop();
      settings = configuredSettings(value);
      stopped = false;
      reconnectAttempt = 0;
      lastError = '';
      lastCloseCode = null;
      lastCloseReason = '';
      setPhase(settings ? 'disconnected' : 'not_configured');
      connect();
    },
    publishManifest(): void {
      if (socket?.readyState === WebSocket.OPEN) send({ version: 1, type: 'manifest', nodeLabel: settings?.nodeLabel, projects: manifest() });
    },
    publishContentChange(): void {
      if (socket?.readyState === WebSocket.OPEN) send({ version: 1, type: 'content-change' });
    },
    publishStateFrame(ownerNodeId: string, frame: Omit<FederationStateFrame, 'from'>): boolean {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      send({ version: 1, type: frame.type, stateVersion: 1, ...(ownerNodeId === 'relay' ? {} : { to: ownerNodeId }), projectId: frame.projectId, payload: frame.payload });
      return true;
    },
    localOwner(): { ownerNodeId: string; ownerNodeLabel: string; online: true } {
      return { ownerNodeId: settings?.nodeId || 'local', ownerNodeLabel: settings?.nodeLabel || 'This server', online: true };
    },
    nodes(): Array<{ nodeId: string; nodeLabel: string; online: boolean; projectCount: number }> {
      return [...remoteNodes].map(([nodeId, node]) => ({ nodeId, nodeLabel: node.nodeLabel, online: node.online, projectCount: node.projects.length }));
    },
    remoteProjects(): RemoteDecisionOsProject[] {
      if (!settings) return [];
      return [...remoteNodes].flatMap(([ownerNodeId, node]) => node.projects.map((project) => ({
        ...project,
        id: `${ownerNodeId}:${project.id}`,
        localProjectId: project.id,
        ownerNodeId,
        ownerNodeLabel: node.nodeLabel,
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
      requesterStreams.set(requestId, { response, requestCredit, settled: false, status: 502, headers: {}, chunks: [], bytes: 0 });
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
    async request(ownerNodeId: string, path: string, options?: { method?: string; body?: Buffer; headers?: Record<string, string> }): Promise<InternalResponse> {
      return openRequest(ownerNodeId, path, options).response;
    },
  };
}

export type FederationNodeConnector = ReturnType<typeof createFederationNodeConnector>;
