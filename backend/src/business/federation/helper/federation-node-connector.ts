/**
 * WHAT: Connects one Decision OS server to a federation relay and proxies owner-scoped HTTP streams.
 * WHY: Every node must expose remote projects without copying project state or moving Codex execution.
 */
import { createHash, randomUUID, type Hash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, open, rename, rm, type FileHandle } from 'node:fs/promises';
import { dirname } from 'node:path';
import WebSocket from 'ws';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { availableRepositoryOriginFingerprint } from '../../project-sync/helper/repository-sync-status.js';
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../task-state/helper/task-current-state-types.js';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import type { TaskExecutionPresentationUpdate } from '../../../../../shared/schemas/task-execution-presentation-types.js';
import { parseDeliveryNodeCommand, type DeliveryNodeCommand } from '../../../../../shared/schemas/decision-os-delivery-types.js';
import { maximumDeliveryRequestBytes } from '../../delivery/helper/delivery-http-boundary.js';

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
  stateVersion?: typeof taskCurrentStateVersion;
  stateProtocol?: typeof taskStateProtocol;
  stateSchema?: typeof taskCurrentStateVersion;
  baselineEpoch?: typeof taskCurrentBaselineEpoch;
  payload?: unknown;
};

export type FederationStateFrame = {
  type: 'state-entity-batch' | 'state-relay-ack' | 'state-ack' | 'state-summary-request' | 'state-bucket-summary' | 'state-missing-request' | 'state-converged' | 'state-subscribe';
  from: string;
  projectId: string;
  payload: unknown;
};

export type FederationExecutionObservationFrame = {
  type: 'state-execution-observation';
  from: string;
  projectId: string;
  payload: {
    executionId: string;
    observation?: TaskExecutionObservation | null;
    presentation?: TaskExecutionPresentationUpdate;
    pipeline?: { runId: string; result: Record<string, unknown> };
  };
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
const maximumContentBodyBytes = 1024 * 1024 * 1024;
const connectTimeoutMs = 10_000;
const defaultInternalRequestTimeoutMs = 15_000;
const maximumInternalRequestTimeoutMs = 30 * 60_000;
const defaultFlowControlTimeoutMs = 15_000;
const defaultOwnerRequestTimeoutMs = 30 * 60_000;

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

function configuredLocalOwner(value: unknown): { ownerNodeId: string; ownerNodeLabel: string; online: true } {
  const settings = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nodeId = String(settings.federationNodeId ?? '').trim();
  const nodeLabel = String(settings.federationNodeLabel ?? nodeId).trim();
  if (!nodeId || !/^[a-zA-Z0-9_-]+$/.test(nodeId)) {
    return { ownerNodeId: 'local', ownerNodeLabel: 'This server', online: true };
  }
  return { ownerNodeId: nodeId, ownerNodeLabel: nodeLabel || nodeId, online: true };
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
  private waiters = new Set<() => void>();
  private closed: Error | null = null;

  constructor(private readonly timeoutMs: number) {}

  async consume(bytes: number, signal?: AbortSignal): Promise<void> {
    const deadline = Date.now() + this.timeoutMs;
    while (this.available < bytes) {
      if (this.closed) throw this.closed;
      if (signal?.aborted) throw new Error('federation_credit_cancelled');
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new Error(`federation_credit_timeout:${this.timeoutMs}`);
      await new Promise<void>((resolveWait) => {
        let timer: NodeJS.Timeout | null = null;
        const wake = (): void => {
          if (timer) clearTimeout(timer);
          this.waiters.delete(wake);
          signal?.removeEventListener('abort', wake);
          resolveWait();
        };
        timer = setTimeout(wake, remainingMs);
        timer.unref?.();
        this.waiters.add(wake);
        signal?.addEventListener('abort', wake, { once: true });
      });
    }
    if (this.closed) throw this.closed;
    if (signal?.aborted) throw new Error('federation_credit_cancelled');
    this.available -= bytes;
  }

  grant(bytes: number): void {
    if (this.closed || !Number.isFinite(bytes) || bytes <= 0) return;
    this.available = Math.min(creditWindowBytes, this.available + bytes);
    for (const wake of [...this.waiters]) wake();
  }

  close(error: Error): void {
    this.closed ??= error;
    for (const wake of [...this.waiters]) wake();
  }
}

type InternalResponse = { status: number; headers: Record<string, string>; body: Buffer };
export type FederationInternalResponse = InternalResponse & { requestId: string };
type RequesterStream = {
  response?: ServerResponse;
  requestCredit: CreditGate;
  settled: boolean;
  status: number;
  headers: Record<string, string>;
  chunks: Buffer[];
  bytes: number;
  maximumBytes?: number;
  resolve?: (response: InternalResponse) => void;
  timeout?: NodeJS.Timeout;
  abortSignal?: AbortSignal;
  abortListener?: () => void;
  file?: { descriptor: FileHandle; temporary: string; target: string; expectedHash: string; hash: Hash; resolve: (result: { status: number; bytes: number }) => void };
};
type OwnerStream = {
  method: string;
  path: string;
  headers: Record<string, string>;
  chunks: Buffer[];
  bytes: number;
  maximumBytes: number;
  responseCredit: CreditGate;
  abort: AbortController;
  timeout?: NodeJS.Timeout;
};

export function createDeliveryTransportCapabilityAuthority(input: {
  now?: () => number;
  ttlMs?: number;
} = {}) {
  const now = input.now ?? Date.now;
  const ttlMs = Math.max(1_000, Math.min(60_000, Math.floor(input.ttlMs ?? 15_000)));
  const capabilities = new Map<string, {
    requesterNodeId: string;
    targetNodeId: string;
    requestId: string;
    expiresAt: number;
  }>();
  const prune = (): void => {
    const observedAt = now();
    for (const [token, capability] of capabilities) {
      if (capability.expiresAt <= observedAt) capabilities.delete(token);
    }
  };
  return {
    issue(requesterNodeId: string, targetNodeId: string, requestId: string): string {
      prune();
      if (![requesterNodeId, targetNodeId, requestId].every((entry) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(entry))) {
        throw new Error('delivery_transport_capability_identity_invalid');
      }
      const token = randomUUID();
      capabilities.set(token, { requesterNodeId, targetNodeId, requestId, expiresAt: now() + ttlMs });
      return token;
    },
    consume(token: string, targetNodeId: string): { requesterNodeId: string; requestId: string } | null {
      prune();
      const capability = capabilities.get(token);
      if (!capability) return null;
      capabilities.delete(token);
      if (capability.targetNodeId !== targetNodeId || capability.expiresAt <= now()) return null;
      return { requesterNodeId: capability.requesterNodeId, requestId: capability.requestId };
    },
    clear(): void {
      capabilities.clear();
    },
  };
}

export function createFederationNodeConnector(input: {
  settings: unknown;
  localProjects: () => DecisionOsProject[];
  localServerUrl: () => string;
  onRemoteContentChange?: (nodeId: string) => void;
  onRemoteCatalogChange?: () => void;
  onStateConnected?: () => void;
  onStateDisconnected?: () => void;
  onStateFrame?: (frame: FederationStateFrame) => void | Promise<void>;
  onExecutionObservation?: (frame: FederationExecutionObservationFrame) => void;
  onError?: (error: unknown, context: { operation: string; frameType?: string }) => void;
  catalogFile?: string;
  internalRequestTimeoutMs?: number;
  flowControlTimeoutMs?: number;
  ownerRequestTimeoutMs?: number;
}) {
  const internalRequestTimeoutMs = input.internalRequestTimeoutMs ?? defaultInternalRequestTimeoutMs;
  const flowControlTimeoutMs = Math.max(1, input.flowControlTimeoutMs ?? defaultFlowControlTimeoutMs);
  const ownerRequestTimeoutMs = Math.max(1, input.ownerRequestTimeoutMs ?? defaultOwnerRequestTimeoutMs);
  let settings = configuredSettings(input.settings);
  let localOwner = configuredLocalOwner(input.settings);
  const requesterStreams = new Map<string, RequesterStream>();
  const ownerStreams = new Map<string, OwnerStream>();
  const deliveryCapabilities = createDeliveryTransportCapabilityAuthority();
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

  const reportError = (error: unknown, operation: string, frameType = ''): void => {
    try { input.onError?.(error, { operation, ...(frameType ? { frameType } : {}) }); } catch { /* Error reporting cannot fail the connector. */ }
  };

  let catalogWritable = true;
  type RemoteCatalogNodes = Map<string, { nodeLabel: string; online: boolean; projects: ProjectManifest[] }>;
  const validateCatalogNodes = (
    nodes: Array<{ nodeId?: unknown; nodeLabel?: unknown; online?: unknown; projects?: unknown }>,
    retained: boolean,
  ): RemoteCatalogNodes => {
    const candidateNodes: RemoteCatalogNodes = new Map();
    for (const node of nodes) {
      const nodeId = String(node.nodeId ?? '').trim();
      // WHAT: Reject one invalid node without installing any sibling candidates.
      // WHY: Partial catalog installation would present an invalid snapshot as complete discovery state.
      if (!nodeId
        || nodeId === settings?.nodeId
        || !Array.isArray(node.projects)
        || node.projects.some((project) => {
          // WHAT: Reject a project that lacks the complete path-free manifest contract.
          // WHY: Remote discovery cannot safely route an incomplete or structurally ambiguous project.
          if (!project || typeof project !== 'object' || Array.isArray(project)) return true;
          const manifest = project as Record<string, unknown>;
          return !String(manifest.id ?? '').trim()
            || typeof manifest.name !== 'string'
            || typeof manifest.description !== 'string'
            || typeof manifest.color !== 'string'
            || !Array.isArray(manifest.ledgers)
            || typeof manifest.originFingerprint !== 'string';
        })) throw new Error(retained ? 'invalid_federation_project_catalog_node' : 'invalid_federation_relay_catalog_node');
      candidateNodes.set(nodeId, {
        nodeLabel: String(node.nodeLabel || nodeId),
        online: retained ? false : Boolean(node.online),
        projects: node.projects as ProjectManifest[],
      });
    }
    return candidateNodes;
  };
  const readRetainedCatalogCandidate = (): RemoteCatalogNodes => {
    // WHAT: Treat an absent retained catalog as a valid empty local cache.
    // WHY: First startup has no remote-catalog bytes to recover or preserve.
    if (!input.catalogFile || !existsSync(input.catalogFile)) {
      return new Map();
    }
    const retained = JSON.parse(readFileSync(input.catalogFile, 'utf8')) as {
        version?: unknown;
        federationId?: unknown;
        nodes?: Array<{ nodeId?: unknown; nodeLabel?: unknown; projects?: unknown }>;
    };
    // WHAT: Reject the complete retained document before constructing any candidate remote-node state.
    // WHY: Version, federation identity, and node collection must share one validated durable authority.
    if (retained.version !== 1
      || String(retained.federationId ?? '') !== String(settings?.federationId ?? '')
      || !Array.isArray(retained.nodes)) throw new Error('invalid_federation_project_catalog');
    return validateCatalogNodes(retained.nodes, true);
  };
  const installRemoteCatalog = (candidateNodes: RemoteCatalogNodes): void => {
    remoteNodes.clear();
    for (const [nodeId, node] of candidateNodes) remoteNodes.set(nodeId, node);
  };
  const loadRetainedCatalog = (): void => {
    const candidateNodes = readRetainedCatalogCandidate();
    installRemoteCatalog(candidateNodes);
    catalogWritable = true;
  };
  try { loadRetainedCatalog(); }
  catch (error) {
    catalogWritable = false;
    remoteNodes.clear();
    reportError(error, 'read-retained-project-catalog');
  }

  const persistRemoteCatalog = (
    candidateNodes: RemoteCatalogNodes = remoteNodes,
    propagateFailure = false,
    allowRecoveryWrite = false,
  ): boolean => {
    // WHAT: Skip catalog persistence when no durable catalog is configured or its current bytes failed validation.
    // WHY: Federation must preserve invalid retained state byte-identically until explicit recovery validates replacement bytes.
    // WHAT: Treat an unconfigured retained catalog as a successful memory-only transaction.
    // WHY: Connectors without durable catalog ownership must still install validated live discovery state.
    if (!input.catalogFile) return true;
    // WHAT: Permit writes over an invalid retained catalog only from the explicit recovery transaction.
    // WHY: Live relay frames must not bypass validation and operator-owned recovery while the durable scope is paused.
    if (!catalogWritable && !allowRecoveryWrite) return false;
    const temporary = `${input.catalogFile}.tmp`;
    try {
      mkdirSync(dirname(input.catalogFile), { recursive: true });
      writeFileSync(temporary, JSON.stringify({
        version: 1,
        federationId: settings?.federationId ?? '',
        nodes: [...candidateNodes].map(([nodeId, node]) => ({
          nodeId,
          nodeLabel: node.nodeLabel,
          projects: node.projects,
        })),
      }, null, 2) + '\n', 'utf8');
      renameSync(temporary, input.catalogFile);
      return true;
    } catch (error) {
      catalogWritable = false;
      reportError(error, 'persist-project-catalog');
      // WHAT: Propagate only an explicit recovery write failure to its recovery owner.
      // WHY: Normal connector callbacks remain contained while recovery must not resolve an unverified writable state.
      if (propagateFailure) throw error;
      return false;
    }
  };

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
    .map(({ id, name, description, color, ledgers, root }) => ({
      id,
      name,
      description,
      color,
      ledgers,
      originFingerprint: availableRepositoryOriginFingerprint(root),
    }));

  const settleInternal = (stream: RequesterStream, status: number, headers: Record<string, string>, body: Buffer): void => {
    stream.resolve?.({ status, headers, body });
  };

  const cleanupRequester = (stream: RequesterStream): void => {
    if (stream.timeout) clearTimeout(stream.timeout);
    if (stream.abortSignal && stream.abortListener) stream.abortSignal.removeEventListener('abort', stream.abortListener);
    stream.requestCredit.close(new Error('federation_request_settled'));
  };

  const failRequester = (requestId: string, status: number, code: string, message: string): void => {
    const stream = requesterStreams.get(requestId);
    if (!stream || stream.settled) return;
    stream.settled = true;
    cleanupRequester(stream);
    const body = Buffer.from(JSON.stringify({ ok: false, error: code, message }));
    if (stream.file) {
      void stream.file.descriptor.close()
        .catch((error: unknown) => reportError(error, 'close-failed-request-file'))
        .then(() => rm(stream.file!.temporary, { force: true }))
        .catch((error: unknown) => reportError(error, 'remove-failed-request-file'))
        .finally(() => stream.file!.resolve({ status, bytes: stream.bytes }));
    } else if (stream.response) {
      if (stream.response.destroyed || stream.response.writableEnded) {
        // The client already owns final settlement.
      } else if (stream.response.headersSent) stream.response.destroy();
      else {
        stream.response.statusCode = status;
        stream.response.setHeader('content-type', 'application/json');
        stream.response.end(body);
      }
    } else settleInternal(stream, status, { 'content-type': 'application/json' }, body);
    requesterStreams.delete(requestId);
  };

  const sendChunks = async (requestId: string, direction: 'request' | 'response', buffer: Uint8Array, gate: CreditGate, signal?: AbortSignal): Promise<void> => {
    for (let offset = 0; offset < buffer.byteLength; offset += chunkBytes) {
      const chunk = buffer.subarray(offset, Math.min(buffer.byteLength, offset + chunkBytes));
      await gate.consume(chunk.byteLength, signal);
      send({ version: 1, type: `${direction}-chunk`, requestId, data: Buffer.from(chunk).toString('base64') });
    }
  };

  const waitForResponseDrain = (response: ServerResponse): Promise<void> => new Promise((resolveDrain, rejectDrain) => {
    let timer: NodeJS.Timeout | null = null;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      response.off('drain', onDrain);
      response.off('close', onClose);
      response.off('error', onError);
    };
    const onDrain = (): void => { cleanup(); resolveDrain(); };
    const onClose = (): void => { cleanup(); rejectDrain(new Error('federation_response_closed')); };
    const onError = (error: Error): void => { cleanup(); rejectDrain(error); };
    if (response.destroyed || response.writableEnded) {
      rejectDrain(new Error('federation_response_closed'));
      return;
    }
    response.once('drain', onDrain);
    response.once('close', onClose);
    response.once('error', onError);
    timer = setTimeout(() => {
      cleanup();
      rejectDrain(new Error(`federation_response_drain_timeout:${flowControlTimeoutMs}`));
    }, flowControlTimeoutMs);
    timer.unref?.();
  });

  const abortOwnerStreams = (reason: string): void => {
    for (const stream of ownerStreams.values()) {
      if (stream.timeout) clearTimeout(stream.timeout);
      stream.abort.abort(new Error(reason));
      stream.responseCredit.close(new Error(reason));
    }
    ownerStreams.clear();
  };

  const handleOwnerRequest = async (requestId: string): Promise<void> => {
    const stream = ownerStreams.get(requestId);
    if (!stream) return;
    if (stream.timeout) clearTimeout(stream.timeout);
    const deadline = setTimeout(() => stream.abort.abort(new Error(`federation_owner_request_timeout:${ownerRequestTimeoutMs}`)), ownerRequestTimeoutMs);
    deadline.unref?.();
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
          await sendChunks(requestId, 'response', value, stream.responseCredit, stream.abort.signal);
        }
      }
      send({ version: 1, type: 'response-end', requestId });
    } catch (error) {
      if (!stream.abort.signal.aborted || String(stream.abort.signal.reason ?? '').includes('timeout')) reportError(error, 'owner-request');
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
      clearTimeout(deadline);
      stream.responseCredit.close(new Error('federation_owner_request_settled'));
      if (ownerStreams.get(requestId) === stream) ownerStreams.delete(requestId);
    }
  };

  const handleFrame = async (frame: RelayFrame): Promise<void> => {
    if (frame.type === 'catalog') {
      // WHAT: Ignore live relay catalogs while retained catalog durability is paused.
      // WHY: Network traffic cannot replace invalid durable authority before explicit validation and recovery succeeds.
      if (!catalogWritable) return;
      const candidateNodes = validateCatalogNodes(
        (frame.nodes ?? []).filter((node) => node.nodeId !== settings?.nodeId),
        false,
      );
      // WHAT: Install a live catalog only after its complete candidate has persisted successfully.
      // WHY: Runtime discovery and retained recovery must advance through one atomic authority transition.
      if (!persistRemoteCatalog(candidateNodes)) return;
      installRemoteCatalog(candidateNodes);
      input.onRemoteCatalogChange?.();
      return;
    }
    if (frame.type === 'content-change') {
      input.onRemoteContentChange?.(String(frame.from ?? ''));
      return;
    }
    if (frame.type === 'state-execution-observation') {
      input.onExecutionObservation?.({
        type: frame.type,
        from: String(frame.from ?? ''),
        projectId: String(frame.projectId ?? ''),
        payload: frame.payload as FederationExecutionObservationFrame['payload'],
      });
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
      const previous = ownerStreams.get(requestId);
      if (previous) {
        if (previous.timeout) clearTimeout(previous.timeout);
        previous.abort.abort(new Error('federation_request_replaced'));
        previous.responseCredit.close(new Error('federation_request_replaced'));
      }
      const headers = { ...(frame.headers ?? {}) };
      delete headers['x-decision-os-delivery-capability'];
      if (
        String(frame.method ?? 'GET').toUpperCase() === 'POST'
        && String(frame.path ?? '') === '/api/internal/delivery'
        && String(frame.from ?? '')
      ) {
        headers['x-decision-os-delivery-capability'] = deliveryCapabilities.issue(
          String(frame.from),
          localOwner.ownerNodeId,
          requestId,
        );
      }
      const stream: OwnerStream = {
        method: String(frame.method ?? 'GET').toUpperCase(),
        path: String(frame.path ?? '/'),
        headers,
        chunks: [],
        bytes: 0,
        maximumBytes: String(frame.path ?? '') === '/api/internal/delivery'
          ? maximumDeliveryRequestBytes
          : maximumBodyBytes,
        responseCredit: new CreditGate(flowControlTimeoutMs),
        abort: new AbortController(),
      };
      stream.timeout = setTimeout(() => {
        if (ownerStreams.get(requestId) !== stream) return;
        const error = new Error(`federation_owner_open_timeout:${ownerRequestTimeoutMs}`);
        stream.abort.abort(error);
        stream.responseCredit.close(error);
        ownerStreams.delete(requestId);
        reportError(error, 'owner-request-open');
        try { send({ version: 1, type: 'response-error', requestId, code: 'owner_request_timeout', message: error.message }); }
        catch { /* Relay settlement owns the disconnected stream. */ }
      }, ownerRequestTimeoutMs);
      stream.timeout.unref?.();
      ownerStreams.set(requestId, stream);
      return;
    }
    const owner = ownerStreams.get(requestId);
    if (frame.type === 'request-chunk' && owner) {
      const chunk = Buffer.from(String(frame.data ?? ''), 'base64');
      owner.bytes += chunk.byteLength;
      if (owner.bytes > owner.maximumBytes) {
        ownerStreams.delete(requestId);
        if (owner.timeout) clearTimeout(owner.timeout);
        owner.abort.abort(new Error('federation_body_limit'));
        owner.responseCredit.close(new Error('federation_body_limit'));
        send({
          version: 1,
          type: 'response-error',
          requestId,
          code: 'federation_body_limit',
          message: `Remote body exceeds ${owner.maximumBytes} bytes.`,
        });
        return;
      }
      owner.chunks.push(chunk);
      send({ version: 1, type: 'credit', requestId, direction: 'request', bytes: chunk.byteLength });
      return;
    }
    if (frame.type === 'request-end' && owner) {
      if (owner.timeout) clearTimeout(owner.timeout);
      owner.timeout = undefined;
      void handleOwnerRequest(requestId);
      return;
    }
    if (frame.type === 'cancel' && owner) {
      if (owner.timeout) clearTimeout(owner.timeout);
      owner.abort.abort(new Error('federation_request_cancelled'));
      owner.responseCredit.close(new Error('federation_request_cancelled'));
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
      if (requester.bytes > (requester.maximumBytes ?? (requester.file ? maximumContentBodyBytes : maximumBodyBytes))) {
        failRequester(requestId, 413, 'federation_body_limit', requester.file ? 'Remote content exceeds 1 GiB.' : 'Remote response exceeds 25 MiB.');
        return;
      }
      if (requester.file) {
        requester.file.hash.update(chunk);
        await requester.file.descriptor.write(chunk);
      } else if (requester.response) {
        if (!requester.response.write(chunk)) {
          try { await waitForResponseDrain(requester.response); }
          catch (error) {
            reportError(error, 'response-backpressure', frame.type);
            failRequester(requestId, 504, 'federation_response_backpressure', error instanceof Error ? error.message : 'Federation response stalled.');
            return;
          }
        }
      } else requester.chunks.push(chunk);
      send({ version: 1, type: 'credit', requestId, direction: 'response', bytes: chunk.byteLength });
      return;
    }
    if (frame.type === 'response-end') {
      requester.settled = true;
      cleanupRequester(requester);
      if (requester.file) {
        await requester.file.descriptor.sync();
        await requester.file.descriptor.close();
        if (requester.status === 200 && requester.file.hash.digest('hex') === requester.file.expectedHash) {
          await rename(requester.file.temporary, requester.file.target);
        } else {
          await rm(requester.file.temporary, { force: true });
        }
        requester.file.resolve({ status: requester.status, bytes: requester.bytes });
      } else if (requester.response) requester.response.end();
      else settleInternal(requester, requester.status, requester.headers, Buffer.concat(requester.chunks));
      requesterStreams.delete(requestId);
      return;
    }
    if (frame.type === 'response-error') {
      const status = frame.code === 'owner_offline' ? 503 : frame.code === 'federation_body_limit' ? 413 : 502;
      failRequester(requestId, status, String(frame.code ?? 'federation_error'), String(frame.message ?? 'Federation request failed.'));
    }
  };

  const openRequest = (ownerNodeId: string, path: string, options: {
    method?: string;
    body?: Buffer;
    headers?: Record<string, string>;
    timeoutMs?: number;
    signal?: AbortSignal;
    maximumResponseBytes?: number;
  } = {}): { requestId: string; response: Promise<InternalResponse> } => {
    if (options.signal?.aborted) {
      return { requestId: '', response: Promise.resolve({ status: 499, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":false,"error":"client_cancelled"}') }) };
    }
    if (!settings || !remoteNodes.get(ownerNodeId)?.online || socket?.readyState !== WebSocket.OPEN) {
      return { requestId: '', response: Promise.resolve({ status: 503, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":false,"error":"owner_offline"}') }) };
    }
    const requestId = randomUUID();
    const method = String(options.method ?? 'GET').toUpperCase();
    const body = options.body ?? Buffer.alloc(0);
    const maximumRequestBytes = path === '/api/internal/delivery' ? maximumDeliveryRequestBytes : maximumBodyBytes;
    if (body.byteLength > maximumRequestBytes) return { requestId: '', response: Promise.resolve({ status: 413, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":false,"error":"federation_body_limit"}') }) };
    let resolveResponse: (response: InternalResponse) => void = () => undefined;
    const response = new Promise<InternalResponse>((resolve) => { resolveResponse = resolve; });
    const stream: RequesterStream = {
      requestCredit: new CreditGate(flowControlTimeoutMs), settled: false, status: 502, headers: {}, chunks: [], bytes: 0,
      resolve: resolveResponse,
      maximumBytes: options.maximumResponseBytes,
    };
    const requestedTimeoutMs = Number(options.timeoutMs ?? internalRequestTimeoutMs);
    const requestTimeoutMs = Number.isFinite(requestedTimeoutMs)
      ? Math.min(maximumInternalRequestTimeoutMs, Math.max(1, Math.floor(requestedTimeoutMs)))
      : internalRequestTimeoutMs;
    stream.timeout = setTimeout(() => {
      if (!requesterStreams.has(requestId)) return;
      try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Connection settlement owns relay cleanup. */ }
      failRequester(requestId, 504, 'federation_request_timeout', `Federation request exceeded ${requestTimeoutMs}ms.`);
    }, requestTimeoutMs);
    stream.timeout.unref?.();
    requesterStreams.set(requestId, stream);
    if (options.signal) {
      stream.abortSignal = options.signal;
      stream.abortListener = () => {
        if (!requesterStreams.has(requestId)) return;
        try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Connection settlement owns relay cleanup. */ }
        failRequester(requestId, 499, 'client_cancelled', 'Federation request was cancelled by the caller.');
      };
      options.signal.addEventListener('abort', stream.abortListener, { once: true });
      if (options.signal.aborted) {
        stream.abortListener();
        return { requestId, response };
      }
    }
    try {
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
    } catch (error) {
      reportError(error, 'open-internal-request');
      failRequester(requestId, 502, 'federation_outcome_unknown', 'Relay disconnected while opening the request.');
    }
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
      try {
        send({ version: 1, type: 'manifest', nodeLabel: settings?.nodeLabel, stateProtocol: taskStateProtocol, stateSchema: taskCurrentStateVersion, baselineEpoch: taskCurrentBaselineEpoch, projects: manifest() });
      } catch (error) {
        reportError(error, 'publish-initial-manifest');
        active.terminate();
        return;
      }
      try { input.onStateConnected?.(); }
      catch (error) { reportError(error, 'state-connected-callback'); }
    });
    active.addEventListener('message', (event) => {
      messageQueue = messageQueue.then(async () => {
        const text = typeof event.data === 'string'
          ? event.data
          : Buffer.isBuffer(event.data)
            ? event.data.toString('utf8')
            : Buffer.from(event.data as ArrayBuffer).toString('utf8');
        const frame = JSON.parse(text) as RelayFrame;
        try { await handleFrame(frame); }
        catch (error) { reportError(error, 'handle-relay-frame', frame.type); }
      }).catch((error: unknown) => reportError(error, 'decode-relay-frame'));
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
      abortOwnerStreams('federation_relay_disconnected');
      for (const stream of remoteNodes.values()) stream.online = false;
      try { input.onStateDisconnected?.(); }
      catch (error) {
        // WHAT: Contain disconnect observer failure inside the connector scope.
        // WHY: Repair cleanup diagnostics cannot prevent bounded reconnect scheduling.
        reportError(error, 'state-disconnected-callback');
      }
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
        flowControlTimeoutMs,
        ownerRequestTimeoutMs,
        requesterStreamCount: requesterStreams.size,
        ownerStreamCount: ownerStreams.size,
        catalogWritable,
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
      abortOwnerStreams('federation_reconfigured');
      socket?.close(1000, 'server_stopped');
      socket = null;
      connectedAt = null;
      nextRetryAt = null;
      connectionStartedAt = null;
      for (const stream of remoteNodes.values()) stream.online = false;
      deliveryCapabilities.clear();
      try { input.onStateDisconnected?.(); }
      catch (error) {
        // WHAT: Contain disconnect observer failure during explicit connector shutdown.
        // WHY: Server close must settle even when repair cleanup diagnostics fail.
        reportError(error, 'state-disconnected-callback');
      }
      setPhase(settings ? 'disconnected' : 'not_configured');
    },
    reconfigure(value: unknown): void {
      this.stop();
      settings = configuredSettings(value);
      localOwner = configuredLocalOwner(value);
      stopped = false;
      reconnectAttempt = 0;
      lastError = '';
      lastCloseCode = null;
      lastCloseReason = '';
      setPhase(settings ? 'disconnected' : 'not_configured');
      connect();
    },
    publishManifest(): void {
      if (socket?.readyState !== WebSocket.OPEN) return;
      try { send({ version: 1, type: 'manifest', nodeLabel: settings?.nodeLabel, stateProtocol: taskStateProtocol, stateSchema: taskCurrentStateVersion, baselineEpoch: taskCurrentBaselineEpoch, projects: manifest() }); }
      catch (error) { reportError(error, 'publish-manifest'); }
    },
    recoverRetainedProjectCatalog(): void {
      const candidateNodes = readRetainedCatalogCandidate();
      // WHAT: Persist the fully validated recovery candidate before installing it in runtime discovery.
      // WHY: A failed recovery write must leave both the prior in-memory state and paused durable authority unchanged.
      persistRemoteCatalog(candidateNodes, true, true);
      installRemoteCatalog(candidateNodes);
      catalogWritable = true;
    },
    publishContentChange(): void {
      if (socket?.readyState !== WebSocket.OPEN) return;
      try { send({ version: 1, type: 'content-change' }); }
      catch (error) { reportError(error, 'publish-content-change'); }
    },
    publishStateFrame(ownerNodeId: string, frame: Omit<FederationStateFrame, 'from'>): boolean {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      try {
        send({ version: 1, type: frame.type, stateVersion: taskCurrentStateVersion, ...(ownerNodeId === 'relay' ? {} : { to: ownerNodeId }), projectId: frame.projectId, payload: frame.payload });
        return true;
      } catch (error) {
        reportError(error, 'publish-state-frame', frame.type);
        return false;
      }
    },
    publishExecutionObservation(projectId: string, payload: FederationExecutionObservationFrame['payload']): boolean {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      try {
        send({ version: 1, type: 'state-execution-observation', stateVersion: taskCurrentStateVersion, projectId, payload });
        return true;
      } catch (error) {
        reportError(error, 'publish-execution-observation', 'state-execution-observation');
        return false;
      }
    },
    localOwner(): { ownerNodeId: string; ownerNodeLabel: string; online: true } {
      return localOwner;
    },
    consumeDeliveryCapability(token: string): { requesterNodeId: string; requestId: string } | null {
      return deliveryCapabilities.consume(token, localOwner.ownerNodeId);
    },
    nodes(): Array<{ nodeId: string; nodeLabel: string; online: boolean; projectCount: number }> {
      return [...remoteNodes].map(([nodeId, node]) => ({ nodeId, nodeLabel: node.nodeLabel, online: node.online, projectCount: node.projects.length }));
    },
    topologyNodes(): Array<{ nodeId: string; nodeLabel: string; online: boolean; projects: Array<{ projectId: string; originFingerprint: string }> }> {
      return [...remoteNodes].map(([nodeId, node]) => ({
        nodeId,
        nodeLabel: node.nodeLabel,
        online: node.online,
        projects: node.projects.map((project) => ({
          projectId: project.id,
          originFingerprint: project.originFingerprint,
        })),
      }));
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
      const requestCredit = new CreditGate(flowControlTimeoutMs);
      const stream: RequesterStream = { response, requestCredit, settled: false, status: 502, headers: {}, chunks: [], bytes: 0 };
      stream.timeout = setTimeout(() => {
        if (!requesterStreams.has(requestId)) return;
        try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Connection settlement owns relay cleanup. */ }
        failRequester(requestId, 504, 'federation_request_timeout', `Federation proxy request exceeded ${internalRequestTimeoutMs}ms.`);
      }, internalRequestTimeoutMs);
      stream.timeout.unref?.();
      requesterStreams.set(requestId, stream);
      response.on('close', () => {
        const activeStream = requesterStreams.get(requestId);
        if (activeStream) {
          try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Relay already closed. */ }
          cleanupRequester(activeStream);
          requesterStreams.delete(requestId);
        }
      });
      const query = (request.url ?? '').includes('?') ? `?${(request.url ?? '').split('?').slice(1).join('?')}` : '';
      const ownerPath = `/p/${encodeURIComponent(localProjectId)}${scopedPath}${query}`;
      try {
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
      } catch (error) {
        reportError(error, 'proxy-request-flow');
        try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Relay already closed. */ }
        failRequester(requestId, 504, 'federation_request_flow_stalled', error instanceof Error ? error.message : 'Federation request flow stalled.');
      }
    },
    async request(ownerNodeId: string, path: string, options?: { method?: string; body?: Buffer; headers?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal }): Promise<FederationInternalResponse> {
      const opened = openRequest(ownerNodeId, path, options);
      return { ...await opened.response, requestId: opened.requestId };
    },
    async requestDelivery(ownerNodeId: string, commandInput: DeliveryNodeCommand, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<FederationInternalResponse> {
      const command = parseDeliveryNodeCommand(commandInput);
      const opened = openRequest(ownerNodeId, '/api/internal/delivery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify(command)),
        timeoutMs: options?.timeoutMs,
        signal: options?.signal,
        maximumResponseBytes: 64 * 1024,
      });
      return { ...await opened.response, requestId: opened.requestId };
    },
    async requestToFile(ownerNodeId: string, path: string, target: string, expectedHash: string): Promise<{ status: number; bytes: number }> {
      if (!settings || !remoteNodes.get(ownerNodeId)?.online || socket?.readyState !== WebSocket.OPEN) return { status: 503, bytes: 0 };
      await mkdir(dirname(target), { recursive: true });
      const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
      const descriptor = await open(temporary, 'wx');
      const requestId = randomUUID();
      let resolveResult: (result: { status: number; bytes: number }) => void = () => undefined;
      const result = new Promise<{ status: number; bytes: number }>((resolveResultPromise) => { resolveResult = resolveResultPromise; });
      const stream: RequesterStream = {
        requestCredit: new CreditGate(flowControlTimeoutMs), settled: false, status: 502, headers: {}, chunks: [], bytes: 0,
        file: { descriptor, temporary, target, expectedHash, hash: createHash('sha256'), resolve: resolveResult },
      };
      stream.timeout = setTimeout(() => {
        try { send({ version: 1, type: 'cancel', requestId }); } catch { /* Connection cleanup owns final settlement. */ }
        failRequester(requestId, 504, 'federation_request_timeout', 'Federation content request timed out.');
      }, Math.max(internalRequestTimeoutMs, 120_000));
      stream.timeout.unref?.();
      requesterStreams.set(requestId, stream);
      try {
        send({ version: 1, type: 'request-open', requestId, to: ownerNodeId, method: 'GET', path, headers: { 'x-decision-os-federation-node': settings.nodeId } });
        send({ version: 1, type: 'request-end', requestId });
      } catch (error) {
        reportError(error, 'open-content-request');
        failRequester(requestId, 502, 'federation_outcome_unknown', 'Relay disconnected while opening the content request.');
      }
      return result;
    },
  };
}

export type FederationNodeConnector = ReturnType<typeof createFederationNodeConnector>;
