import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requestLedgerContentRefresh, requestThreadContentRefresh } from '../../src/runtime/refresh/effect/subscribe-ledger-content-events.js';
import { state } from '../../src/runtime/state.js';

function source(path: string): string {
  const file = resolve(process.cwd(), path);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}

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

test('thread content refresh is deferred separately from canvas refresh while voice recording is active', () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    detail: unknown;
    constructor(_name: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  state.pendingThreadContentRefresh = false;
  state.pendingLedgerContentRefresh = false;
  state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, transcriptionStatus: 'recording' };

  try {
    requestThreadContentRefresh('thread-content-change');

    assert.equal(state.pendingThreadContentRefresh, true);
    assert.equal(state.pendingLedgerContentRefresh, false);
    assert.equal(state.voice.recording, true);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    state.pendingThreadContentRefresh = false;
    state.pendingLedgerContentRefresh = false;
  }
});

test('thread content events rerender the thread panel without remounting the canvas', () => {
  const refresh = source('frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts');
  assert.match(refresh, /contentEventKind\(event\) === 'thread-content'/);
  assert.match(refresh, /requestThreadContentRefresh\('thread-content-change'\)/);
  assert.match(refresh, /renderThreadPanel\(\)/);
  assert.match(refresh, /state\.selection = selection/);
  assert.doesNotMatch(refresh, /thread-content-change'[\s\S]{0,260}renderCanvasSurface\(\)/);
});
