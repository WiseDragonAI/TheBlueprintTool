import assert from 'node:assert/strict';
import test from 'node:test';

test('discovers opt-in telemetry and batches global traces over one same-origin WebSocket', async () => {
  const sent: string[] = [];
  const sockets: FakeWebSocket[] = [];
  class FakeWebSocket extends EventTarget {
    static readonly OPEN = 1;
    readyState = FakeWebSocket.OPEN;
    constructor(readonly url: URL) {
      super();
      sockets.push(this);
      queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    send(value: string): void { sent.push(value); }
    close(): void { this.readyState = 3; }
  }
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin: 'http://127.0.0.1:50150', pathname: '/p/project/ledgers/tasks', search: '?thread=open' },
  });
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeWebSocket });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => ({ ok: true, json: async () => ({ enabled: true, endpoint: '/api/diagnostics/frontend-telemetry' }) }),
  });
  const transport = await import('../../../src/runtime/telemetry/effect/frontend-telemetry-websocket.js');
  await transport.installFrontendTelemetryWebSocket();
  transport.enqueueFrontendTelemetry({ name: 'codex-log-refresh-started', at: '2026-07-31T15:00:00.000Z', args: { generation: 4 } });
  transport.enqueueFrontendTelemetry({ name: 'codex-log-refresh-failed', at: '2026-07-31T15:00:01.000Z', args: { error: 'projection failed' } });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(sockets.length, 1);
  assert.equal(String(sockets[0]?.url), 'ws://127.0.0.1:50150/api/diagnostics/frontend-telemetry');
  assert.equal(sent.length, 1);
  const batch = JSON.parse(sent[0] ?? '[]') as Array<Record<string, unknown>>;
  assert.equal(batch.length, 2);
  assert.equal(batch[0]?.route, '/p/project/ledgers/tasks?thread=open');
  assert.equal(batch[1]?.name, 'codex-log-refresh-failed');
  assert.equal(batch[0]?.browserSessionId, batch[1]?.browserSessionId);
  transport.closeFrontendTelemetryWebSocket();
});
