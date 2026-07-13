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
import { loadActiveLedgerState } from '../../src/runtime/ledger/effect/load-active-ledger-state.js';
import { state } from '../../src/runtime/state.js';
import { retryVoiceTranscription } from '../../src/runtime/voice/effect/retry-voice-transcription.js';
import {
  clearPendingVoiceUploadMemoryForTest,
  persistPendingVoiceUpload,
  readPendingVoiceUpload
} from '../../src/runtime/voice/effect/persist-pending-voice-upload.js';
import { clearPendingVoiceUploadRestoreStateForTest, restorePendingVoiceUploads } from '../../src/runtime/voice/effect/restore-pending-voice-uploads.js';

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
    state.activeTab = 'specs';
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }), { ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a', noteId: 'note-voice-1', queueCodex: true });
    assert.deepEqual(result, { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '', error: undefined, status: 202 });
    assert.equal(requested.url, '/api/voice-upload');
    assert.equal(requested.init?.method, 'POST');
    assert.equal(requested.init?.headers, undefined);
    const body = requested.init?.body as FormData;
    assert.equal(body instanceof FormData, true);
    assert.equal(body.get('ledgerId'), 'specs');
    assert.equal(body.get('threadId'), 'thread-card-a');
    assert.equal(body.get('cardId'), 'card-a');
    assert.equal(body.get('noteId'), 'note-voice-1');
    assert.equal(body.get('queueCodex'), 'true');
    assert.equal(body.get('audio') instanceof Blob, true);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
  }
});

test('upload-voice-audio preserves wav content type for provider-safe transcription', async () => {
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
    return { ok: true, status: 202, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.wav', text: '' } }) };
  };

  try {
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/wav' }), { threadId: 'thread-card-a' });
    assert.equal(result.voiceFileRef, '/tmp/voice.wav');
    const audio = (requested.init?.body as FormData).get('audio') as Blob;
    assert.equal(audio.type, 'audio/wav');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
  }
});

test('upload-voice-audio falls back to the current route ledger and thread card id', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const previousActiveTab = state.activeTab;
  const previousLedgers = state.ledgers;
  const previousLedgerTabs = state.ledgerTabs;
  let requested: { url?: string; init?: RequestInit } = {};
  state.activeTab = 'specs';
  state.ledgers = [{ id: 'skills', title: 'Skills', ledgerFile: '.decision-os/skills.json' }, { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgerTabs = state.ledgers;
  (globalThis as unknown as { window: unknown }).window = { location: { pathname: '/skills' }, __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: RequestInit) => {
    requested = { url, init };
    return { ok: true, status: 202, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } }) };
  };

  try {
    await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }), { threadId: 'thread-card-a' });
    const body = requested.init?.body as FormData;
    assert.equal(requested.url, '/api/voice-upload');
    assert.equal(body.get('ledgerId'), 'skills');
    assert.equal(body.get('threadId'), 'thread-card-a');
    assert.equal(body.get('cardId'), 'card-a');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.activeTab = previousActiveTab;
    state.ledgers = previousLedgers;
    state.ledgerTabs = previousLedgerTabs;
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

test('request-transcription keeps preserved upload retryable when metadata commit fails', async () => {
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
  let uploadCount = 0;
  let persistedBeforeFetch = false;
  (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init?: RequestInit) => {
    uploadCount += 1;
    const noteId = String((init?.body as FormData).get('noteId') ?? '');
    persistedBeforeFetch = Boolean(await readPendingVoiceUpload(noteId));
    if (uploadCount === 1) return {
      ok: false,
      status: 500,
      json: async () => ({ body: { ok: false, uploaded: true, configured: true, noteId, voiceFileRef: '/tmp/preserved.webm', error: 'Voice note commit failed.' } })
    };
    return {
      ok: true,
      status: 202,
      json: async () => ({ body: { ok: true, uploaded: true, configured: true, noteId, voiceFileRef: '/tmp/retried.webm', status: 'queued', revision: 1 } })
    };
  };

  try {
    state.threadId = 'thread-card-a';
    state.activeTab = 'specs';
    state.activeLedger = { notes: { 'thread-card-a': [] } };
    await requestTranscription(new Blob(['abc'], { type: 'audio/webm' }));
    const note = state.activeLedger.notes['thread-card-a'][0];
    const noteId = String(note.id);
    assert.equal(persistedBeforeFetch, true);
    assert.equal(note.status, 'upload failed');
    assert.equal(note.voiceFileRef, '/tmp/preserved.webm');
    assert.equal(note.localVoiceUploadId, noteId);
    assert.equal(note.message, 'Voice uploaded; server acceptance failed. Audio is saved locally.');
    assert.ok(await readPendingVoiceUpload(noteId));
    assert.match(state.voice.transcriptionStatus, /^voice upload failed/);
    await retryVoiceTranscription({ threadId: 'thread-card-a', noteId, localVoiceUploadId: noteId });
    assert.equal(uploadCount, 2);
    assert.equal(note.voiceFileRef, '/tmp/retried.webm');
    assert.equal(note.status, 'queued');
    assert.equal(note.localVoiceUploadId, '');
    assert.equal(await readPendingVoiceUpload(noteId), null);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    clearPendingVoiceUploadMemoryForTest();
  }
});

test('pending voice upload restores the same retryable note after local state is lost', async () => {
  const previousDocument = globalThis.document;
  try {
    (globalThis as unknown as { document: unknown }).document = undefined;
    clearPendingVoiceUploadMemoryForTest();
    clearPendingVoiceUploadRestoreStateForTest();
    state.activeTab = 'specs';
    state.threadId = 'thread-card-a';
    state.activeLedger = { notes: { 'thread-card-a': [] } };
    await persistPendingVoiceUpload({
      noteId: 'note-local-reload',
      threadId: 'thread-card-a',
      ledgerId: 'specs',
      cardId: 'card-a',
      queueCodex: true,
      audio: new Blob(['saved audio'], { type: 'audio/webm' }),
      createdAt: '2026-07-13T15:49:00.000Z'
    });
    assert.equal(await restorePendingVoiceUploads('thread-card-a'), true);
    const note = state.activeLedger.notes['thread-card-a'][0];
    assert.equal(note.id, 'note-local-reload');
    assert.equal(note.status, 'upload failed');
    assert.equal(note.localVoiceUploadId, 'note-local-reload');
    assert.match(note.message, /saved locally/);
  } finally {
    clearPendingVoiceUploadMemoryForTest();
    clearPendingVoiceUploadRestoreStateForTest();
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
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
    const mutation = JSON.parse(String(init?.body ?? '{}'));
    const statusValue = mutation.action === 'append-note' ? 'uploading' : mutation.note.status;
    const message = mutation.action === 'append-note' ? mutation.note.body : mutation.note.body;
    return {
      ok: true,
      status: 200,
      json: async () => ({ notes: { [state.threadId]: [{ id: 'note-1', role: 'operator', message, voiceFileRef: mutation.note.voiceFileRef ?? '', status: statusValue, error: mutation.note.error ?? '' }] } })
    };
  };

  try {
    state.threadId = 'thread-card-a';
    await requestTranscription(new Blob(['abc'], { type: 'audio/webm' }));
    assert.equal(state.voice.transcriptionStatus, 'idle');
    assert.equal(state.voice.voiceFileRef, '/tmp/voice.webm');
    assert.equal(status.textContent, 'idle');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].role, 'operator');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    state.threadId = '';
  }
});

test('request-transcription updates the captured thread after selection changes', async () => {
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const status = { textContent: '' };
  const meter = { style: { transform: '' } };
  const panel = { hidden: false, classList: { toggle() {} }, style: { setProperty() {} } };
  const shell = { classList: { toggle() {} } };
  const threadTarget = { textContent: '', replaceChildren() {}, append() {} };
  const noteList = { className: '', replaceChildren() {}, append() {} };
  const draft = { before() {} };
  const telemetryList = { replaceChildren() {}, append() {} };
  const patchThreadIds: string[] = [];
  let uploadThreadId = '';
  let transcribeThreadId = '';
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
    querySelectorAll() {
      return [];
    },
    createElement(tagName: string) {
      return {
        tagName,
        className: '',
        textContent: '',
        type: '',
        dataset: {},
        style: { setProperty() {} },
        classList: { add() {}, toggle() {} },
        append() {},
        appendChild() {},
        replaceChildren() {},
        setAttribute() {}
      };
    },
    createTextNode(text: string) {
      return { textContent: text };
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    if (url === '/api/voice-upload') {
      uploadThreadId = String((init?.body as FormData).get('threadId') ?? '');
      state.threadId = 'thread-card-b';
      return {
        ok: true,
        status: 202,
        json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice-owned.webm', text: '' } })
      };
    }
    const mutation = JSON.parse(String(init?.body ?? '{}'));
    patchThreadIds.push(mutation.note.threadId);
    return { ok: true, status: 200, json: async () => ({}) };
  };

  try {
    state.threadId = 'thread-card-a';
    state.activeLedger = { notes: { 'thread-card-a': [], 'thread-card-b': [] } };
    await requestTranscription(new Blob(['abc'], { type: 'audio/webm' }));
    assert.equal(uploadThreadId, 'thread-card-a');
    assert.equal(transcribeThreadId, '');
    assert.deepEqual([...new Set(patchThreadIds)], []);
    assert.equal(state.threadId, 'thread-card-b');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Voice uploaded.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].voiceFileRef, '/tmp/voice-owned.webm');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'queued');
    assert.equal(state.activeLedger.notes['thread-card-b'].length, 0);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
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
      json: async () => ({ notes: { 'thread-card-a': [{ id: 'note-voice-1', role: 'operator', message: mutation.note.body, voiceFileRef: mutation.note.voiceFileRef, status: mutation.note.status }] } })
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

test('active ledger reload keeps optimistic thread notes missing from stale server state', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  state.activeTab = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.activeLedger = {
    notes: {
      'thread-card-a': [{
        id: 'note-local-voice',
        role: 'operator',
        message: 'Voice uploaded; transcription failed.',
        voiceFileRef: '/tmp/voice.webm',
        status: 'transcription failed',
        optimistic: true
      }]
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: true,
    json: async () => ({ cards: [], annotations: [], notes: { 'thread-card-a': [{ id: 'note-local-voice', role: 'operator', message: 'Voice note captured. Uploading audio...', status: 'uploading' }] } })
  });

  try {
    await loadActiveLedgerState();
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Voice uploaded; transcription failed.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'transcription failed');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].voiceFileRef, '/tmp/voice.webm');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.activeLedger = null;
    state.activeTab = 'specs';
  }
});

test('append-voice-note converts legacy notes array into durable thread map', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  let mutation: Record<string, any> = {};
  state.activeTab = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.threadId = 'thread-card-a';
  state.activeLedger = { notes: [] };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init: RequestInit) => {
    mutation = JSON.parse(String(init.body ?? '{}'));
    return { ok: true };
  };

  try {
    const result = appendVoiceNote({ body: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'uploading' });
    assert.equal(Array.isArray(state.activeLedger.notes), false);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].id, result.noteId);
    assert.equal(mutation.note.id, result.noteId);
    assert.equal(await result.committed, true);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});
