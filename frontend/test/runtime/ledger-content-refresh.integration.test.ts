import test from 'node:test';
import assert from 'node:assert/strict';
import { requestLedgerContentRefresh } from '../../src/runtime/refresh/effect/subscribe-ledger-content-events.js';
import { state } from '../../src/runtime/state.js';

test('ledger content refresh is deferred while voice recording is active', () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    detail: unknown;
    constructor(_name: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  state.pendingLedgerContentRefresh = false;
  state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, transcriptionStatus: 'recording' };

  try {
    requestLedgerContentRefresh('card-content-change');

    assert.equal(state.pendingLedgerContentRefresh, true);
    assert.equal(state.voice.recording, true);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    state.pendingLedgerContentRefresh = false;
  }
});
