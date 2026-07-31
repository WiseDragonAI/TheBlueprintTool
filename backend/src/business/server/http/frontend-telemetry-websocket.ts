/**
 * WHAT: Accepts bounded same-origin browser telemetry over one dedicated WebSocket endpoint.
 * WHY: Operator-browser failures need server-readable evidence without entering federation transport or runtime incidents.
 */
import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Server } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

type TelemetryRecord = {
  name: string;
  at: string;
  browserSessionId: string;
  route: string;
  args: unknown;
};

const endpoint = '/api/diagnostics/frontend-telemetry';
const maxPayloadBytes = 64 * 1024;
const maxBatchRecords = 50;
const maxQueuedLines = 500;
const maxLogBytes = 5 * 1024 * 1024;

function sameOrigin(request: import('node:http').IncomingMessage): boolean {
  const origin = String(request.headers.origin ?? '');
  const host = String(request.headers.host ?? '');
  // WHAT: Admit only browser handshakes whose Origin matches the listener Host.
  // WHY: Telemetry ingestion has no cross-origin use case and must not become an unauthenticated remote write surface.
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function telemetryRecord(value: unknown): TelemetryRecord | null {
  // WHAT: Reject non-object telemetry entries before inspecting their bounded scalar identity.
  // WHY: The durable log accepts diagnostics records, not arbitrary browser-controlled JSON values.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = String(record.name ?? '').slice(0, 160);
  const at = String(record.at ?? '').slice(0, 64);
  const browserSessionId = String(record.browserSessionId ?? '').slice(0, 96);
  const route = String(record.route ?? '').slice(0, 2_048);
  // WHAT: Require stable diagnostic identity and a valid observation timestamp.
  // WHY: Anonymous or temporally invalid entries cannot support causal reproduction.
  if (!name || !browserSessionId || !Number.isFinite(Date.parse(at))) return null;
  return { name, at, browserSessionId, route, args: record.args ?? {} };
}

export function installFrontendTelemetryWebSocket(input: {
  decisionOsRoot: string;
  enabled: boolean;
  server: Server;
  recordFailure: (operation: string, error: unknown) => void;
}): { close: () => void; file: string } {
  const file = resolve(input.decisionOsRoot, 'frontend-telemetry.jsonl');
  const rotatedFile = `${file}.1`;
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: maxPayloadBytes });
  const clients = new Set<WebSocket>();
  const lines: string[] = [];
  let flushing = false;
  let closed = false;

  const flush = async (): Promise<void> => {
    // WHAT: Preserve the single writer and bounded queue while an append is already active.
    // WHY: Concurrent WebSocket messages must not create concurrent rotation and append races.
    if (flushing || closed) return;
    flushing = true;
    try {
      await mkdir(dirname(file), { recursive: true });
      const activeLog = await stat(file).catch(() => null);
      // WHAT: Rotate the active telemetry file before it exceeds its bounded retention budget.
      // WHY: Diagnostic enablement must never permit unbounded disk growth.
      if (activeLog && activeLog.size >= maxLogBytes) {
        await rename(file, rotatedFile).catch(() => undefined);
      }
      const batch = lines.splice(0, lines.length);
      // WHAT: Persist the admitted queue in one append when at least one record is pending.
      // WHY: Batching avoids one filesystem operation per telemetry record while preserving ordered JSON Lines.
      if (batch.length > 0) await appendFile(file, `${batch.join('\n')}\n`, 'utf8');
    } catch (error) {
      input.recordFailure('persist-frontend-telemetry', error);
    } finally {
      flushing = false;
      // WHAT: Resume flushing when records arrived during the preceding append cycle.
      // WHY: A settled writer must not strand accepted telemetry in memory.
      if (lines.length > 0 && !closed) void flush();
    }
  };

  webSockets.on('connection', (webSocket) => {
    clients.add(webSocket);
    let windowStartedAt = Date.now();
    let windowRecords = 0;
    webSocket.on('message', (data: RawData) => {
      const now = Date.now();
      // WHAT: Start a new per-client admission window after ten seconds.
      // WHY: A fixed window bounds one browser's ingestion pressure without global coupling.
      if (now - windowStartedAt >= 10_000) {
        windowStartedAt = now;
        windowRecords = 0;
      }
      let batch: unknown;
      try { batch = JSON.parse(data.toString()); } catch { webSocket.close(1007, 'invalid_json'); return; }
      // WHAT: Reject oversized record batches at the message boundary.
      // WHY: Batching reduces overhead but must not bypass per-message resource limits.
      if (!Array.isArray(batch) || batch.length > maxBatchRecords) { webSocket.close(1008, 'invalid_batch'); return; }
      windowRecords += batch.length;
      // WHAT: Close clients exceeding the bounded ten-second record budget.
      // WHY: Frontend loops must fail their own telemetry scope instead of saturating the server.
      if (windowRecords > 500) { webSocket.close(1008, 'rate_limited'); return; }
      for (const value of batch) {
        const record = telemetryRecord(value);
        if (!record) continue;
        lines.push(JSON.stringify({ source: 'frontend', receivedAt: new Date(now).toISOString(), ...record }));
        // WHAT: Evict the oldest pending record when the writer queue reaches capacity.
        // WHY: Recent failure evidence is more actionable than allowing memory to grow without bound.
        if (lines.length > maxQueuedLines) lines.shift();
      }
      void flush();
    });
    webSocket.on('close', () => clients.delete(webSocket));
    webSocket.on('error', (error) => input.recordFailure('frontend-telemetry-client', error));
  });

  input.server.on('upgrade', (request, socket, head) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    // WHAT: Leave upgrades for every unrelated path available to their owning transport.
    // WHY: This diagnostic socket must not intercept future application WebSockets.
    if (path !== endpoint) return;
    // WHAT: Reject the exact telemetry upgrade immediately while the feature is disabled.
    // WHY: Disabled diagnostics must not leave an unaffiliated socket waiting without a finite settlement.
    if (!input.enabled) { socket.destroy(); return; }
    // WHAT: Reject telemetry handshakes that do not originate from the current Decision OS listener.
    // WHY: Same-origin admission is the authentication boundary for this operator-facing diagnostic channel.
    if (!sameOrigin(request)) { socket.destroy(); return; }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => webSockets.emit('connection', webSocket, request));
  });

  return {
    file,
    close: () => {
      closed = true;
      for (const client of clients) client.close(1001, 'server_closed');
      webSockets.close();
    },
  };
}
