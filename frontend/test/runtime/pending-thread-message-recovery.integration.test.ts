/**
 * WHAT: Verifies reload-safe text-message admission, exact failure reporting, and retry.
 * WHY: A failed thread mutation must preserve operator text before paint and converge with one stable note identity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoteController } from '../../src/runtime/thread/controller/create-note-controller.js';
import { restorePendingThreadMessages } from '../../src/runtime/thread/effect/restore-pending-thread-messages.js';
import { submitThreadDraft } from '../../src/runtime/thread/effect/submit-thread-draft.js';
import {
  pendingThreadMessages,
  resetPendingThreadMessageStoreForTest,
} from '../../src/runtime/thread/effect/persist-pending-thread-message.js';
import { state } from '../../src/runtime/state.js';

function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, String(value)); },
    removeItem(key: string) { values.delete(key); },
  };
}

function installScope(): void {
  state.projectId = 'project-a';
  state.replicaNodeId = '';
  state.activeTab = 'tasks';
  state.activeLedgerId = 'tasks';
  state.ledgerTabs = [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }];
  state.threadId = 'thread-card-a';
  state.activeLedger = { notes: { 'thread-card-a': [] } };
}

test('rejected text message survives local reload and retries with one stable note id', async () => {
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const storage = memoryStorage();
  let resolveRejected: (response: unknown) => void = () => undefined;
  (globalThis as unknown as { localStorage: unknown }).localStorage = storage;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], localStorage: storage, dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  resetPendingThreadMessageStoreForTest();
  installScope();
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Promise((resolve) => {
    resolveRejected = resolve;
  });

  try {
    const created = createNoteController({ threadId: 'thread-card-a', body: 'Keep this exact message.' });
    const admitted = pendingThreadMessages({
      projectId: 'project-a',
      ledgerId: 'tasks',
      threadId: 'thread-card-a',
    });
    assert.equal(admitted.length, 1);
    assert.equal(admitted[0].noteId, created.noteId);
    assert.equal(admitted[0].body, 'Keep this exact message.');
    assert.equal(state.activeLedger.notes['thread-card-a'][0].status, 'committing');

    resolveRejected({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: 'task_content_conflict', contentFile: '.decision-os/threads/tasks/thread-card-a.md' }),
    });
    assert.equal(await created.committed, false);
    const failed = pendingThreadMessages({
      projectId: 'project-a',
      ledgerId: 'tasks',
      threadId: 'thread-card-a',
    });
    assert.equal(failed[0].lastErrorCode, 'task_content_conflict');
    assert.match(state.activeLedger.notes['thread-card-a'][0].error, /task_content_conflict/);

    state.activeLedger = { notes: { 'thread-card-a': [] } };
    resetPendingThreadMessageStoreForTest();
    let retriedNoteId = '';
    (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init: RequestInit) => {
      retriedNoteId = JSON.parse(String(init.body)).note.id;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    assert.equal(await restorePendingThreadMessages('thread-card-a'), true);
    assert.equal(retriedNoteId, created.noteId);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].id, created.noteId);
    assert.equal(state.activeLedger.notes['thread-card-a'][0].optimistic, false);
    assert.equal(pendingThreadMessages({
      projectId: 'project-a',
      ledgerId: 'tasks',
      threadId: 'thread-card-a',
    }).length, 0);
  } finally {
    resetPendingThreadMessageStoreForTest();
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { localStorage: unknown }).localStorage = previousLocalStorage;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('local persistence failure keeps the original draft and does not send', async () => {
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const draft = { value: 'Do not lose this draft.' };
  let fetchCalls = 0;
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem() { return null; },
    setItem() { throw new Error('quota unavailable'); },
    removeItem() {},
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) { return selector === '.thread-draft' ? draft : null; },
  };
  (globalThis as unknown as { window: unknown }).window = {
    __coreTelemetry: [],
    localStorage: globalThis.localStorage,
    dispatchEvent() {},
  };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  resetPendingThreadMessageStoreForTest();
  installScope();

  try {
    await submitThreadDraft();
    assert.equal(draft.value, 'Do not lose this draft.');
    assert.equal(fetchCalls, 0);
    assert.equal(state.activeLedger.notes['thread-card-a'].length, 0);
  } finally {
    resetPendingThreadMessageStoreForTest();
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { localStorage: unknown }).localStorage = previousLocalStorage;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.activeLedger = null;
  }
});
