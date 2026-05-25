/**
 * WHAT: Integration tests for voice transcription upload and draft-fill behavior.
 * WHY: Voice input must prove captured text reaches the active thread draft.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fillThreadDraft } from '../../src/runtime/voice/effect/fill-thread-draft.js';
import { uploadVoiceAudio } from '../../src/runtime/voice/effect/upload-voice-audio.js';
import { requestTranscription } from '../../src/runtime/voice/effect/request-transcription.js';
import { appendVoiceNote } from '../../src/runtime/voice/effect/append-voice-note.js';
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
    return { ok: true, status: 200, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '', text: 'hello transcript' } }) };
  };

  try {
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }));
    assert.deepEqual(result, { ok: true, uploaded: true, configured: true, voiceFileRef: '', text: 'hello transcript', error: undefined, status: 200 });
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

test('upload-voice-audio reports accepted upload when transcription is unconfigured', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: true,
    status: 202,
    json: async () => ({ body: { ok: false, uploaded: true, configured: false, voiceFileRef: '/tmp/voice.webm', text: '', error: 'transcription not configured' } })
  });

  try {
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }));
    assert.equal(result.ok, false);
    assert.equal(result.uploaded, true);
    assert.equal(result.configured, false);
    assert.equal(result.voiceFileRef, '/tmp/voice.webm');
    assert.equal(result.status, 202);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('request-transcription keeps optimistic upload status separate from provider config', async () => {
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const status = { textContent: '' };
  const meter = { style: { transform: '' } };
  const panel = { classList: { toggle() {} } };
  const shell = { classList: { toggle() {} } };
  const threadTarget = { textContent: '' };
  const noteList = { className: '', replaceChildren() {}, append() {} };
  const draft = { before() {} };
  const telemetryList = { replaceChildren() {}, append() {} };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel') return panel;
      if (selector === '.panel') return panel;
      if (selector === '.shell') return shell;
      if (selector === '.thread-target') return threadTarget;
      if (selector === '.thread-note-list') return noteList;
      if (selector === '.thread-draft') return draft;
      if (selector === '.voice-status') return status;
      if (selector === '.voice-meter-value') return meter;
      if (selector === '.voice-panel') return panel;
      if (selector === '.telemetry-list') return telemetryList;
      return null;
    },
    createElement() {
      return { className: '', textContent: '', append() {}, replaceChildren() {} };
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => url === '/api/transcribe'
    ? {
        ok: true,
        status: 202,
        json: async () => ({ body: { ok: false, uploaded: true, configured: false, voiceFileRef: '/tmp/voice.webm', text: '', error: 'transcription not configured' } })
      }
    : {
        ok: true,
        status: 200,
        json: async () => ({ notes: { [state.threadId]: [{ role: 'voice', message: 'Voice uploaded; transcription not configured.', voiceFileRef: '/tmp/voice.webm', status: 'transcription not configured' }] } })
      };

  try {
    state.threadId = 'thread-card-a';
    await requestTranscription(new Blob(['abc'], { type: 'audio/webm' }));
    assert.equal(state.voice.transcriptionStatus, 'voice uploaded; transcription not configured');
    assert.equal(state.voice.voiceFileRef, '/tmp/voice.webm');
    assert.equal(status.textContent, 'voice uploaded; transcription not configured');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].role, 'voice');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    state.threadId = '';
  }
});

test('append-voice-note persists voice metadata to the active thread ledger', async () => {
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const panel = { hidden: false, classList: { toggle() {} } };
  const shell = { classList: { toggle() {} } };
  const threadTarget = { textContent: '' };
  const draft = { before() {} };
  const noteList = { className: '', replaceChildren() {}, append() {} };
  const voiceStatus = { textContent: '' };
  const meter = { style: { transform: '' } };
  const telemetryList = { replaceChildren() {}, append() {} };
  let mutation: Record<string, any> = {};
  state.threadId = 'thread-card-a';
  state.activeLedger = { notes: { 'thread-card-a': [] } };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel') return panel;
      if (selector === '.panel') return panel;
      if (selector === '.shell') return shell;
      if (selector === '.thread-target') return threadTarget;
      if (selector === '.thread-draft') return draft;
      if (selector === '.thread-note-list') return noteList;
      if (selector === '.voice-status') return voiceStatus;
      if (selector === '.voice-meter-value') return meter;
      if (selector === '.voice-panel') return panel;
      if (selector === '.telemetry-list') return telemetryList;
      return null;
    },
    createElement() {
      return { className: '', textContent: '', append() {}, replaceChildren() {} };
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init: RequestInit) => {
    mutation = JSON.parse(String(init.body ?? '{}'));
    return {
      ok: true,
      json: async () => ({ notes: { 'thread-card-a': [{ role: 'voice', message: mutation.note.body, voiceFileRef: mutation.note.voiceFileRef, status: mutation.note.status }] } })
    };
  };

  try {
    const ok = await appendVoiceNote({ body: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'pending' });
    assert.equal(ok, true);
    assert.equal(mutation.action, 'append-note');
    assert.equal(mutation.note.threadId, 'thread-card-a');
    assert.equal(mutation.note.source, 'voice');
    assert.equal(mutation.note.voiceFileRef, '/tmp/voice.webm');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'pending');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});
