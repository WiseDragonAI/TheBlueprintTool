import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../src/runtime/state.js';
import {
  applyVoiceServerNote,
  installVoiceTranscriptionRecoveryListeners,
  reconcileVoiceTranscription,
  resetVoiceTranscriptionReconciliationForTests,
  voiceTranscriptionWatcherCountForTests,
  watchVoiceTranscription
} from '../../src/runtime/voice/effect/reconcile-voice-transcription.js';
import { voicePhaseElapsedSeconds, voicePhaseLabel } from '../../src/runtime/voice/helper/voice-transcription-lifecycle.js';

function installRuntime(): () => void {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { document: unknown }).document = { querySelector: () => null, addEventListener() {}, visibilityState: 'visible' };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {}, addEventListener() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  state.activeLedgerId = 'specs';
  state.activeTab = 'specs';
  state.replicaNodeId = '';
  state.threadId = 'thread-card-a';
  state.activeLedger = { notes: { 'thread-card-a': [] } };
  return () => {
    resetVoiceTranscriptionReconciliationForTests();
    state.threadId = '';
    state.replicaNodeId = '';
    state.activeLedger = null;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  };
}

test('targeted reconciliation recovers a missed terminal SSE without reloading the ledger', async () => {
  const restore = installRuntime();
  const previousFetch = globalThis.fetch;
  state.activeLedger.notes['thread-card-a'] = [{ id: 'note-a', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.wav', status: 'transcribing', revision: 2 }];
  globalThis.fetch = (async (url: string) => {
    assert.match(url, /^\/api\/voice-transcription-status\?/);
    return { ok: true, status: 200, json: async () => ({ ok: true, note: { id: 'note-a', message: 'Recovered transcript.', voiceFileRef: '/tmp/voice.wav', status: 'transcribed', revision: 4, completedAt: '2026-07-13T00:00:04.000Z' } }) } as Response;
  }) as typeof fetch;
  try {
    const applied = await reconcileVoiceTranscription({ ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-a' });
    assert.equal(applied, true);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Recovered transcript.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'transcribed');
  } finally {
    globalThis.fetch = previousFetch;
    restore();
  }
});

test('targeted reconciliation scopes status reads to the canonical project URL', async () => {
  const restore = installRuntime();
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  let requested: { url: string; init?: RequestInit } = { url: '' };
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://decision-os.local/p/project-id/ledgers/specs')
  });
  state.activeLedger.notes['thread-card-a'] = [{ id: 'note-a', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.wav', status: 'transcribing', revision: 2 }];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requested = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true, note: { id: 'note-a', message: 'Recovered transcript.', voiceFileRef: '/tmp/voice.wav', status: 'transcribed', revision: 4 } }) } as Response;
  }) as typeof fetch;
  try {
    await reconcileVoiceTranscription({ ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-a' });
    assert.match(requested.url, /^\/p\/project-id\/api\/voice-transcription-status\?/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation === undefined) delete (globalThis as { location?: Location }).location;
    else Object.defineProperty(globalThis, 'location', { configurable: true, value: previousLocation });
    restore();
  }
});

test('targeted reconciliation preserves explicit project ownership outside project routes', async () => {
  const restore = installRuntime();
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  let requested: { url: string; init?: RequestInit } = { url: '' };
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://decision-os.local/control-room/exec')
  });
  state.activeLedger.notes['thread-card-a'] = [{ id: 'note-a', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.wav', status: 'transcribing', revision: 2 }];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requested = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true, note: { id: 'note-a', message: 'Recovered transcript.', voiceFileRef: '/tmp/voice.wav', status: 'transcribed', revision: 4 } }) } as Response;
  }) as typeof fetch;
  try {
    await reconcileVoiceTranscription({ projectId: 'project-id', replicaNodeId: 'mobile', ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-a' });
    assert.match(requested.url, /^\/p\/project-id\/api\/voice-transcription-status\?/);
    assert.equal(new Headers(requested.init?.headers).get('x-decision-os-replica-node'), 'mobile');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation === undefined) delete (globalThis as { location?: Location }).location;
    else Object.defineProperty(globalThis, 'location', { configurable: true, value: previousLocation });
    restore();
  }
});

test('older intermediate revisions cannot replace a terminal voice note', () => {
  const restore = installRuntime();
  state.activeLedger.notes['thread-card-a'] = [{ id: 'note-a', message: 'Final transcript.', voiceFileRef: '/tmp/voice.wav', status: 'transcribed', revision: 4 }];
  try {
    const applied = applyVoiceServerNote({
      ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-a',
      note: { id: 'note-a', message: 'Voice uploaded.', status: 'transcribing', revision: 2 }
    });
    assert.equal(applied, false);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Final transcript.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'transcribed');
  } finally {
    restore();
  }
});

test('terminal reconciliation stops the pending note watcher', async () => {
  const restore = installRuntime();
  const previousFetch = globalThis.fetch;
  state.activeLedger.notes['thread-card-a'] = [{ id: 'note-a', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.wav', status: 'queued', revision: 1, acceptedAt: new Date().toISOString() }];
  globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ ok: true, note: { id: 'note-a', message: 'Done.', voiceFileRef: '/tmp/voice.wav', status: 'transcribed', revision: 4 } }) })) as unknown as typeof fetch;
  try {
    watchVoiceTranscription({ ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-a' });
    assert.equal(voiceTranscriptionWatcherCountForTests(), 1);
    await reconcileVoiceTranscription({ ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-a' });
    assert.equal(voiceTranscriptionWatcherCountForTests(), 0);
  } finally {
    globalThis.fetch = previousFetch;
    restore();
  }
});

test('returning to a visible page immediately reconciles a completed voice note', async () => {
  const restore = installRuntime();
  const previousFetch = globalThis.fetch;
  let visibilityListener: (() => void) | undefined;
  let fetched: (() => void) | undefined;
  const fetchStarted = new Promise<void>((resolve) => { fetched = resolve; });
  (globalThis.document as unknown as { addEventListener: (type: string, listener: () => void) => void }).addEventListener = (type, listener) => {
    if (type === 'visibilitychange') visibilityListener = listener;
  };
  state.activeLedger.notes['thread-card-a'] = [{
    id: 'note-visible',
    message: 'Voice uploaded.',
    voiceFileRef: '/tmp/voice.wav',
    status: 'transcribing',
    revision: 2,
    acceptedAt: new Date().toISOString()
  }];
  globalThis.fetch = (async () => {
    fetched?.();
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, note: { id: 'note-visible', message: 'Visible transcript.', status: 'transcribed', revision: 4 } })
    } as Response;
  }) as typeof fetch;
  try {
    watchVoiceTranscription({ ledgerId: 'specs', threadId: 'thread-card-a', noteId: 'note-visible' });
    installVoiceTranscriptionRecoveryListeners();
    assert.equal(typeof visibilityListener, 'function');
    visibilityListener?.();
    await fetchStarted;
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'transcribed');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Visible transcript.');
    assert.equal(voiceTranscriptionWatcherCountForTests(), 0);
  } finally {
    globalThis.fetch = previousFetch;
    restore();
  }
});

test('voice progress labels expose exact phase and elapsed seconds', () => {
  assert.equal(voicePhaseLabel('queued'), 'Waiting for transcription');
  assert.equal(voicePhaseLabel('finalizing'), 'Finalizing transcript');
  assert.equal(voicePhaseElapsedSeconds({ status: 'transcribing', providerStartedAt: '2026-07-13T00:00:00.000Z' }, Date.parse('2026-07-13T00:00:12.900Z')), 12);
});
