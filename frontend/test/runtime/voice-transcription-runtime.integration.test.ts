/**
 * WHAT: Integration tests for voice transcription upload and draft-fill behavior.
 * WHY: Voice input must prove captured text reaches the active thread draft.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fillThreadDraft } from '../../src/runtime/voice/effect/fill-thread-draft.js';
import { uploadVoiceAudio } from '../../src/runtime/voice/effect/upload-voice-audio.js';
import { state } from '../../src/runtime/state.js';

test('fill-thread-draft appends transcribed text to the active draft', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const draft = {
    value: 'Existing note',
    dispatchCount: 0,
    dispatchEvent() {
      this.dispatchCount += 1;
      return true;
    }
  };
  (globalThis as unknown as { document: unknown }).document = { querySelector: () => draft };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };

  try {
    fillThreadDraft('Transcribed voice note.');
    assert.equal(draft.value, 'Existing note\nTranscribed voice note.');
    assert.equal(draft.dispatchCount, 1);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('upload-voice-audio posts transient audio to backend transcription route', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  let requested: { url?: string; init?: RequestInit } = {};
  state.threadId = 'thread-card-a';
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: RequestInit) => {
    requested = { url, init };
    return { ok: true, status: 200, json: async () => ({ body: { ok: true, text: 'hello transcript' } }) };
  };

  try {
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }));
    assert.deepEqual(result, { ok: true, text: 'hello transcript', error: undefined, status: 200 });
    assert.equal(requested.url, '/api/transcribe');
    assert.equal(requested.init?.method, 'POST');
    assert.equal((requested.init?.headers as Record<string, string>)['x-thread-id'], 'thread-card-a');
    assert.equal(requested.init?.body instanceof Blob, true);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
  }
});
