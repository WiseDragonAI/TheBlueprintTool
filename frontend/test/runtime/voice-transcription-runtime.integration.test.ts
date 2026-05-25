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
import { createNoteController } from '../../src/runtime/thread/controller/create-note-controller.js';
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

test('upload-voice-audio posts captured audio to backend upload route', async () => {
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
    return { ok: true, status: 202, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } }) };
  };

  try {
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }));
    assert.deepEqual(result, { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '', error: undefined, status: 202 });
    assert.equal(requested.url, '/api/voice-upload');
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

test('upload-voice-audio reports accepted upload before transcription provider runs', async () => {
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
    json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } })
  });

  try {
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }));
    assert.equal(result.ok, true);
    assert.equal(result.uploaded, true);
    assert.equal(result.configured, true);
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
      return { className: '', textContent: '', type: '', dataset: {}, append() {}, replaceChildren() {} };
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    if (url === '/api/voice-upload') {
      return {
        ok: true,
        status: 202,
        json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } })
      };
    }
    if (url === '/api/transcribe/retry') {
      return {
        ok: true,
        status: 202,
        json: async () => ({ body: { ok: false, uploaded: true, configured: false, voiceFileRef: '/tmp/voice.webm', text: '', error: 'transcription not configured' } })
      };
    }
    const mutation = JSON.parse(String(init?.body ?? '{}'));
    const statusValue = mutation.action === 'append-note' ? 'uploading' : mutation.note.status;
    const message = mutation.action === 'append-note' ? mutation.note.body : mutation.note.body;
    return {
      ok: true,
      status: 200,
      json: async () => ({ notes: { [state.threadId]: [{ id: 'note-1', role: 'voice', message, voiceFileRef: mutation.note.voiceFileRef ?? '', status: statusValue, error: mutation.note.error ?? '' }] } })
    };
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
      return { className: '', textContent: '', type: '', dataset: {}, append() {}, replaceChildren() {} };
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
      json: async () => ({ notes: { 'thread-card-a': [{ id: 'note-voice-1', role: 'voice', message: mutation.note.body, voiceFileRef: mutation.note.voiceFileRef, status: mutation.note.status }] } })
    };
  };

  try {
    const result = appendVoiceNote({ body: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'pending' });
    assert.equal(result.ok, true);
    assert.match(result.noteId, /^note-\d+-[a-f0-9]+$/);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].id, result.noteId);
    assert.equal(mutation.action, 'append-note');
    assert.equal(mutation.note.id, result.noteId);
    assert.equal(mutation.note.threadId, 'thread-card-a');
    assert.equal(mutation.note.source, 'voice');
    assert.equal(mutation.note.voiceFileRef, '/tmp/voice.webm');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'pending');
    assert.equal(await result.committed, true);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('create-note-controller renders a text note before backend reconciliation', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  let mutation: Record<string, any> = {};
  let resolveFetch: () => void = () => undefined;
  state.threadId = 'thread-card-a';
  state.activeLedger = { notes: { 'thread-card-a': [] } };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init: RequestInit) => {
    mutation = JSON.parse(String(init.body ?? '{}'));
    await new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    return { ok: false };
  };

  try {
    const result = createNoteController({ threadId: 'thread-card-a', body: 'Keep this local note.' });
    assert.match(result.noteId, /^note-\d+-[a-f0-9]+$/);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].id, result.noteId);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Keep this local note.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'committing');
    assert.equal(mutation.action, 'append-note');
    assert.equal(mutation.note.id, result.noteId);
    resolveFetch();
    assert.equal(await result.committed, false);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'commit failed');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});
