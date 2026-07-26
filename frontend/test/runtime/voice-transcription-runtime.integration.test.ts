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
import { submitThreadDraft } from '../../src/runtime/thread/effect/submit-thread-draft.js';
import { loadActiveLedgerState } from '../../src/runtime/ledger/effect/load-active-ledger-state.js';
import { state } from '../../src/runtime/state.js';
import { retryVoiceTranscription } from '../../src/runtime/voice/effect/retry-voice-transcription.js';
import { transcribeUploadedVoiceAudio } from '../../src/runtime/voice/effect/transcribe-uploaded-voice-audio.js';
import {
  clearPendingVoiceUploadMemoryForTest,
  persistPendingVoiceUpload,
  readPendingVoiceUpload
} from '../../src/runtime/voice/effect/persist-pending-voice-upload.js';
import { clearPendingVoiceUploadRestoreStateForTest, restorePendingVoiceUploads } from '../../src/runtime/voice/effect/restore-pending-voice-uploads.js';
import { resetPendingThreadMessageStoreForTest } from '../../src/runtime/thread/effect/persist-pending-thread-message.js';

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
    const result = await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }), { projectId: 'project-a', replicaNodeId: 'workstation', ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a', noteId: 'note-voice-1', launchMode: 'run' });
    assert.deepEqual(result, { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '', error: undefined, status: 202 });
    assert.equal(requested.url, '/p/project-a/api/voice-upload');
    assert.equal(requested.init?.method, 'POST');
    assert.equal(new Headers(requested.init?.headers).get('x-decision-os-replica-node'), 'workstation');
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

test('upload-voice-audio scopes the backend route to the canonical project URL', async () => {
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  let requestedUrl = '';
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://decision-os.local/p/project-id/ledgers/specs/zones/zone-a/cards/card-a')
  });
  (globalThis as unknown as { window: unknown }).window = { location: globalThis.location, __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  globalThis.fetch = (async (url: string) => {
    requestedUrl = url;
    return { ok: true, status: 202, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } }) } as Response;
  }) as typeof fetch;

  try {
    await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }), { ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a' });
    assert.equal(requestedUrl, '/p/project-id/api/voice-upload');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation === undefined) delete (globalThis as { location?: Location }).location;
    else Object.defineProperty(globalThis, 'location', { configurable: true, value: previousLocation });
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('upload-voice-audio scopes Control Room card uploads from runtime project ownership', async () => {
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const previousProjectId = state.projectId;
  const previousReplicaNodeId = state.replicaNodeId;
  let requested: { url: string; init?: RequestInit } = { url: '' };
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://decision-os.local/control-room/exec')
  });
  (globalThis as unknown as { window: unknown }).window = { location: globalThis.location, __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  state.projectId = 'project-id';
  state.replicaNodeId = 'mobile';
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requested = { url, init };
    return { ok: true, status: 202, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } }) } as Response;
  }) as typeof fetch;

  try {
    await uploadVoiceAudio(new Blob(['abc'], { type: 'audio/webm' }), { ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a' });
    assert.equal(requested.url, '/p/project-id/api/voice-upload');
    assert.equal(new Headers(requested.init?.headers).get('x-decision-os-replica-node'), 'mobile');
  } finally {
    globalThis.fetch = previousFetch;
    state.projectId = previousProjectId;
    state.replicaNodeId = previousReplicaNodeId;
    if (previousLocation === undefined) delete (globalThis as { location?: Location }).location;
    else Object.defineProperty(globalThis, 'location', { configurable: true, value: previousLocation });
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});

test('transcription retry scopes the backend route to the canonical project URL', async () => {
  const previousFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  let requestedUrl = '';
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://decision-os.local/p/project-id/ledgers/specs')
  });
  globalThis.fetch = (async (url: string) => {
    requestedUrl = url;
    return { ok: true, status: 202, json: async () => ({ body: { ok: true, uploaded: true, configured: true, voiceFileRef: '/tmp/voice.webm', text: '' } }) } as Response;
  }) as typeof fetch;

  try {
    await transcribeUploadedVoiceAudio('/tmp/voice.webm', 'thread-card-a', 'note-a', 'specs');
    assert.equal(requestedUrl, '/p/project-id/api/transcribe/retry');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation === undefined) delete (globalThis as { location?: Location }).location;
    else Object.defineProperty(globalThis, 'location', { configurable: true, value: previousLocation });
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

test('request-transcription signals durable persistence before delayed upload settlement and keeps failures retryable', async () => {
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const status = { textContent: '' };
  const meter = { style: { transform: '' } };
  const panel = {
    classList: { toggle() {} },
    querySelector(selector: string) {
      if (selector === '.voice-status') return status;
      if (selector === '.voice-meter-value') return meter;
      return null;
    },
    querySelectorAll() { return []; }
  };
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
  const requestedUrls: string[] = [];
  const requestedReplicaNodeIds: Array<string | null> = [];
  const lifecycle: string[] = [];
  let settleFirstUpload: (response: unknown) => void = () => {};
  const firstUpload = new Promise((resolve) => {
    settleFirstUpload = resolve;
  });
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    uploadCount += 1;
    requestedUrls.push(url);
    requestedReplicaNodeIds.push(new Headers(init?.headers).get('x-decision-os-replica-node'));
    lifecycle.push('upload-started');
    const noteId = String((init?.body as FormData).get('noteId') ?? '');
    persistedBeforeFetch = Boolean(await readPendingVoiceUpload(noteId));
    if (uploadCount === 1) return firstUpload;
    return {
      ok: true,
      status: 202,
      json: async () => ({ body: { ok: true, uploaded: true, configured: true, noteId, voiceFileRef: '/tmp/retried.webm', status: 'queued', revision: 1 } })
    };
  };

  try {
    state.projectId = 'project-id';
    state.replicaNodeId = 'mobile';
    state.threadId = 'thread-card-a';
    state.activeTab = 'specs';
    state.activeLedger = { notes: { 'thread-card-a': [] } };
    let submissionSettled = false;
    const submission = requestTranscription(new Blob(['abc'], { type: 'audio/webm' }), {
      onPersisted: () => lifecycle.push('persisted')
    });
    void submission.finally(() => {
      submissionSettled = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    const note = state.activeLedger.notes['thread-card-a'][0];
    const noteId = String(note.id);
    assert.equal(persistedBeforeFetch, true);
    assert.equal((await readPendingVoiceUpload(noteId))?.projectId, 'project-id');
    assert.equal((await readPendingVoiceUpload(noteId))?.replicaNodeId, 'mobile');
    assert.equal(requestedUrls[0], '/p/project-id/api/voice-upload');
    assert.equal(requestedReplicaNodeIds[0], 'mobile');
    assert.deepEqual(lifecycle.slice(0, 2), ['persisted', 'upload-started']);
    assert.equal(submissionSettled, false);
    assert.ok(await readPendingVoiceUpload(noteId));
    settleFirstUpload({
      ok: false,
      status: 500,
      json: async () => ({ body: { ok: false, uploaded: true, configured: true, noteId, voiceFileRef: '/tmp/preserved.webm', error: 'Voice note commit failed.' } })
    });
    await submission;
    assert.equal(note.status, 'upload failed');
    assert.equal(note.voiceFileRef, '/tmp/preserved.webm');
    assert.equal(note.localVoiceUploadId, noteId);
    assert.equal(note.message, 'Voice uploaded; server acceptance failed. Audio is saved locally.');
    const pending = await readPendingVoiceUpload(noteId);
    assert.ok(pending);
    assert.equal(pending.projectId, String(state.projectId ?? ''));
    assert.match(state.voice.transcriptionStatus, /^voice upload failed/);
    state.replicaNodeId = '';
    await retryVoiceTranscription({ threadId: 'thread-card-a', noteId, localVoiceUploadId: noteId });
    assert.equal(uploadCount, 2);
    assert.equal(requestedUrls[1], '/p/project-id/api/voice-upload');
    assert.equal(requestedReplicaNodeIds[1], 'mobile');
    assert.deepEqual(requestedUrls, [
      '/p/project-id/api/voice-upload',
      '/p/project-id/api/voice-upload',
    ]);
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
    state.projectId = '';
    state.replicaNodeId = '';
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
      launchMode: 'run',
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

test('pending voice restoration excludes the same thread identity from another project', async () => {
  const previousDocument = globalThis.document;
  try {
    (globalThis as unknown as { document: unknown }).document = undefined;
    clearPendingVoiceUploadMemoryForTest();
    clearPendingVoiceUploadRestoreStateForTest();
    state.projectId = 'project-a';
    state.replicaNodeId = 'workstation';
    state.activeTab = 'specs';
    state.threadId = 'thread-card-a';
    state.activeLedger = { notes: { 'thread-card-a': [] } };
    await persistPendingVoiceUpload({
      noteId: 'note-other-project', projectId: 'project-a', replicaNodeId: 'phone', threadId: 'thread-card-a', ledgerId: 'specs', cardId: 'card-a',
      launchMode: 'send',
      audio: new Blob(['other audio'], { type: 'audio/webm' }), createdAt: '2026-07-13T15:49:00.000Z'
    });
    assert.equal(await restorePendingVoiceUploads('thread-card-a'), false);
    assert.deepEqual(state.activeLedger.notes['thread-card-a'], []);
  } finally {
    clearPendingVoiceUploadMemoryForTest();
    clearPendingVoiceUploadRestoreStateForTest();
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.projectId = '';
    state.replicaNodeId = '';
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
  const panel = {
    classList: { toggle() {} },
    querySelector(selector: string) {
      if (selector === '.voice-status') return status;
      if (selector === '.voice-meter-value') return meter;
      return null;
    },
    querySelectorAll() { return []; }
  };
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
    const accepted = await requestTranscription(new Blob(['abc'], { type: 'audio/webm' }));
    assert.equal(accepted, true);
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
  const panel = {
    hidden: false,
    classList: { toggle() {} },
    style: { setProperty() {} },
    querySelector(selector: string) {
      if (selector === '.voice-status') return status;
      if (selector === '.voice-meter-value') return meter;
      return null;
    },
    querySelectorAll() { return []; }
  };
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
  resetPendingThreadMessageStoreForTest();

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
    resetPendingThreadMessageStoreForTest();
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('thread submission clears the composer before backend reconciliation settles', async () => {
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const draft = { value: 'Persist me without blocking the input.' };
  let settleFetch: () => void = () => undefined;
  state.threadId = 'thread-card-a';
  state.activeTab = 'tasks';
  state.ledgerTabs = [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }];
  state.activeLedger = { notes: { 'thread-card-a': [] } };
  (globalThis as unknown as { document: unknown }).document = { querySelector: () => draft };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async () => {
    await new Promise<void>((resolve) => { settleFetch = resolve; });
    return { ok: true };
  };
  resetPendingThreadMessageStoreForTest();

  try {
    await submitThreadDraft();
    assert.equal(draft.value, '');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].message, 'Persist me without blocking the input.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'committing');
    settleFetch();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.activeLedger.notes['thread-card-a'][0].optimistic, false);
  } finally {
    resetPendingThreadMessageStoreForTest();
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
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
