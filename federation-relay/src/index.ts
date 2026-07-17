import { DurableObject } from 'cloudflare:workers';
import {
  chunkBytes,
  creditWindowBytes,
  encodedByteLength,
  maximumStreamsPerNode,
  parseFrame,
  protocolVersion,
  type ProjectManifest,
  type RelayFrame,
} from './protocol';

type Env = {
  FEDERATIONS: DurableObjectNamespace<FederationRelay>;
  ADMIN_SECRET: string;
};

type SocketIdentity = { nodeId: string };
type Stream = { requester: string; owner: string; requestCredit: number; responseCredit: number };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

async function sameSecret(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let different = aa.length ^ bb.length;
  for (let index = 0; index < aa.length; index += 1) different |= aa[index] ^ bb[index];
  return different === 0;
}

function routeParts(url: URL): { federationId: string; nodeId?: string } | null {
  const connect = url.pathname.match(/^\/connect\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (connect) return { federationId: connect[1], nodeId: connect[2] };
  const admin = url.pathname.match(/^\/admin\/federations\/([a-zA-Z0-9_-]+)\/nodes\/([a-zA-Z0-9_-]+)$/);
  return admin ? { federationId: admin[1], nodeId: admin[2] } : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'decision-os-federation-relay', protocolVersion });
    const route = routeParts(url);
    if (!route) return json({ ok: false, error: 'not_found' }, 404);
    const stub = env.FEDERATIONS.getByName(route.federationId, { locationHint: 'apac' });

    if (url.pathname.startsWith('/admin/')) {
      if (!env.ADMIN_SECRET) return json({ ok: false, error: 'relay_not_configured' }, 503);
      const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!(await sameSecret(supplied, env.ADMIN_SECRET))) return json({ ok: false, error: 'federation_authentication' }, 401);
      if (request.method !== 'POST' || !route.nodeId) return json({ ok: false, error: 'method_not_allowed' }, 405);
      return stub.fetch(new Request(`https://relay.internal/admin/nodes/${route.nodeId}`, request));
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket' || !route.nodeId) {
      return json({ ok: false, error: 'websocket_required' }, 426);
    }
    return stub.fetch(new Request(`https://relay.internal/connect/${route.nodeId}`, request));
  },
} satisfies ExportedHandler<Env>;

export class FederationRelay extends DurableObject<Env> {
  private readonly streams = new Map<string, Stream>();
  private manifests = new Map<string, ProjectManifest[]>();
  private nodeLabels = new Map<string, string>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    state.blockConcurrencyWhile(async () => {
      this.manifests = new Map((await state.storage.get<Array<[string, ProjectManifest[]]>>('manifests')) ?? []);
      this.nodeLabels = new Map((await state.storage.get<Array<[string, string]>>('nodeLabels')) ?? []);
    });
  }

  private socket(nodeId: string): WebSocket | undefined {
    return this.ctx.getWebSockets().find((candidate) => (candidate.deserializeAttachment() as SocketIdentity | null)?.nodeId === nodeId);
  }

  private send(nodeId: string, frame: RelayFrame): void {
    this.socket(nodeId)?.send(JSON.stringify(frame));
  }

  private async publishCatalog(): Promise<void> {
    const online = new Set(this.ctx.getWebSockets().map((socket) => (socket.deserializeAttachment() as SocketIdentity).nodeId));
    const nodes = [...this.manifests].map(([nodeId, projects]) => ({ nodeId, nodeLabel: this.nodeLabels.get(nodeId) || nodeId, projects, online: online.has(nodeId) }));
    const frame: RelayFrame = { version: 1, type: 'catalog', nodes };
    for (const socket of this.ctx.getWebSockets()) socket.send(JSON.stringify(frame));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const admin = url.pathname.match(/^\/admin\/nodes\/([a-zA-Z0-9_-]+)$/);
    if (admin && request.method === 'POST') {
      const credential = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential));
      await this.ctx.storage.put(`credential:${admin[1]}`, Array.from(new Uint8Array(digest)));
      return json({ ok: true, nodeId: admin[1], credential }, 201);
    }

    const connect = url.pathname.match(/^\/connect\/([a-zA-Z0-9_-]+)$/);
    if (!connect) return json({ ok: false, error: 'not_found' }, 404);
    const credential = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const expected = await this.ctx.storage.get<number[]>(`credential:${connect[1]}`);
    const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential))));
    if (!expected || expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
      return json({ ok: false, error: 'federation_authentication' }, 401);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const previous = this.socket(connect[1]);
    previous?.close(4001, 'replaced');
    server.serializeAttachment({ nodeId: connect[1] } satisfies SocketIdentity);
    this.ctx.acceptWebSocket(server);
    await this.publishCatalog();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const sender = (socket.deserializeAttachment() as SocketIdentity).nodeId;
    let frame: RelayFrame | undefined;
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      if (new TextEncoder().encode(text).byteLength > creditWindowBytes) throw new Error('federation_body_limit');
      frame = parseFrame(text);
      if (frame.type === 'manifest') {
        this.manifests.set(sender, Array.isArray(frame.projects) ? frame.projects : []);
        this.nodeLabels.set(sender, String(frame.nodeLabel || sender).slice(0, 120));
        await this.ctx.storage.put({ manifests: [...this.manifests], nodeLabels: [...this.nodeLabels] });
        await this.publishCatalog();
        return;
      }
      if (frame.type === 'content-change') {
        for (const target of this.ctx.getWebSockets()) {
          if (target !== socket) target.send(JSON.stringify({ version: 1, type: 'content-change' } satisfies RelayFrame));
        }
        return;
      }
      if (frame.type === 'request-open') {
        if (!frame.requestId || !frame.to || !this.socket(frame.to)) throw new Error('owner_offline');
        const active = [...this.streams.values()].filter((stream) => stream.requester === sender || stream.owner === sender).length;
        if (active >= maximumStreamsPerNode || this.streams.has(frame.requestId)) throw new Error('federation_capacity');
        this.streams.set(frame.requestId, { requester: sender, owner: frame.to, requestCredit: creditWindowBytes, responseCredit: creditWindowBytes });
        this.send(frame.to, { ...frame, to: undefined, headers: frame.headers ?? {} });
        return;
      }
      if (!frame.requestId) throw new Error('invalid_frame');
      const stream = this.streams.get(frame.requestId);
      if (!stream) throw new Error('unknown_request');
      if (frame.type === 'credit') {
        const direction = frame.direction;
        const bytes = Number(frame.bytes ?? 0);
        if ((direction !== 'request' && direction !== 'response') || bytes <= 0 || bytes > creditWindowBytes) throw new Error('invalid_credit');
        const receiver = direction === 'request' ? stream.owner : stream.requester;
        const creditDestination = direction === 'request' ? stream.requester : stream.owner;
        if (sender !== receiver) throw new Error('federation_forbidden');
        const creditKey = direction === 'request' ? 'requestCredit' : 'responseCredit';
        stream[creditKey] = Math.min(creditWindowBytes, stream[creditKey] + bytes);
        this.send(creditDestination, frame);
        return;
      }
      if (frame.type === 'cancel') {
        if (sender === stream.requester) this.send(stream.owner, frame);
        else if (sender === stream.owner) this.send(stream.requester, frame);
        else throw new Error('federation_forbidden');
        this.streams.delete(frame.requestId);
        return;
      }
      const requestDirection = frame.type.startsWith('request-');
      const source = requestDirection ? stream.requester : stream.owner;
      const destination = requestDirection ? stream.owner : stream.requester;
      if (sender !== source) throw new Error('federation_forbidden');
      if (frame.type === 'request-chunk' || frame.type === 'response-chunk') {
        const bytes = encodedByteLength(frame.data ?? '');
        if (bytes <= 0 || bytes > chunkBytes) throw new Error('federation_body_limit');
        const creditKey = requestDirection ? 'requestCredit' : 'responseCredit';
        if (stream[creditKey] < bytes) throw new Error('federation_credit');
        stream[creditKey] -= bytes;
        this.send(destination, frame);
        return;
      }
      this.send(destination, frame);
      if (frame.type === 'response-end' || frame.type === 'response-error') this.streams.delete(frame.requestId);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid_frame';
      socket.send(JSON.stringify({ version: 1, type: 'response-error', requestId: frame?.requestId, code, message: code } satisfies RelayFrame));
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const nodeId = (socket.deserializeAttachment() as SocketIdentity).nodeId;
    for (const [requestId, stream] of this.streams) {
      if (stream.owner === nodeId) this.send(stream.requester, { version: 1, type: 'response-error', requestId, code: 'owner_offline', message: 'Owner offline.' });
      if (stream.requester === nodeId) this.send(stream.owner, { version: 1, type: 'cancel', requestId });
      if (stream.owner === nodeId || stream.requester === nodeId) this.streams.delete(requestId);
    }
    await this.publishCatalog();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    socket.close(1011, 'socket_error');
  }
}
