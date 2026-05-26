/**
 * WHAT: Runtime tests for default thread selection and note rendering.
 * WHY: Clicking a canvas object should select its thread and show conversation entries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { threadIdForTarget } from '../../src/runtime/thread/helper/thread-id-for-target.js';
import { selectThread } from '../../src/runtime/thread/effect/select-thread.js';
import { renderThreadNotes } from '../../src/runtime/thread/effect/render-thread-notes.js';
import { state } from '../../src/runtime/state.js';

test('thread-id-for-target maps selected canvas objects to canonical thread ids', () => {
  assert.equal(threadIdForTarget('card', 'abc123'), 'thread-abc123');
  assert.equal(threadIdForTarget('zone', 'zone-a'), 'thread-zone-a');
  assert.equal(threadIdForTarget('group', 'group-a'), 'thread-group-a');
  assert.equal(threadIdForTarget('canvas', ''), '');
});

test('select-thread clears stale idle voice status when card context changes', () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  try {
    state.threadId = 'thread-card-a';
    state.voice = { recording: false, startedAt: 0, durationMs: 12, level: 0, transcriptionStatus: 'voice uploaded; transcription not configured', voiceFileRef: '/tmp/voice.webm' };
    selectThread('thread-card-b');
    assert.equal(state.threadId, 'thread-card-b');
    assert.equal(state.voice.transcriptionStatus, 'idle');
    assert.equal(state.voice.voiceFileRef, undefined);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});

test('render-thread-notes shows active thread conversation entries', () => {
  const previousDocument = globalThis.document;
  const rendered: Array<{ className: string; children: unknown[] }> = [];
  const list = {
    className: '',
    replaceChildren() {
      rendered.length = 0;
    },
    append(item: { className: string; children: unknown[] }) {
      rendered.push(item);
    }
  };
  const draft = { before() {} };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-note-list') return list;
      if (selector === '.thread-draft') return draft;
      return null;
    },
    createElement() {
      return {
        className: '',
        textContent: '',
        type: '',
        dataset: {} as Record<string, string>,
        children: [] as unknown[],
        append(...children: unknown[]) {
          this.children.push(...children);
        }
      };
    }
  };
  try {
    state.threadId = 'thread-card-a';
    state.activeLedger = {
      notes: {
        'thread-card-a': [{ role: 'voice', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'pending' }]
      }
    };
    renderThreadNotes();
    assert.equal(rendered.length, 1);
    assert.equal(rendered[0].className, 'thread-note voice-note is-operator');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes keeps failed voice audio retryable', () => {
  const previousDocument = globalThis.document;
  const rendered: Array<{ className: string; children: Array<{ className?: string; dataset?: Record<string, string>; textContent?: string }> }> = [];
  const list = {
    className: '',
    replaceChildren() {
      rendered.length = 0;
    },
    append(item: { className: string; children: Array<{ className?: string; dataset?: Record<string, string>; textContent?: string }> }) {
      rendered.push(item);
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-note-list') return list;
      return null;
    },
    createElement() {
      return {
        className: '',
        textContent: '',
        type: '',
        dataset: {} as Record<string, string>,
        children: [] as Array<{ className?: string; dataset?: Record<string, string>; textContent?: string }>,
        append(...children: Array<{ className?: string; dataset?: Record<string, string>; textContent?: string }>) {
          this.children.push(...children);
        }
      };
    }
  };
  try {
    state.threadId = 'thread-card-a';
    state.activeLedger = {
      notes: {
        'thread-card-a': [{ id: 'note-1', role: 'voice', message: 'Voice uploaded; transcription failed.', voiceFileRef: '/tmp/voice.webm', status: 'transcription failed' }]
      }
    };
    renderThreadNotes();
    assert.equal(rendered[0].className, 'thread-note voice-note is-retryable is-operator');
    const retry = rendered[0].children.find((child) => child.className?.includes('thread-note-retry'));
    assert.equal(retry?.dataset?.action, 'voice-retry');
    assert.equal(retry?.dataset?.noteId, 'note-1');
    assert.equal(retry?.dataset?.voiceFileRef, '/tmp/voice.webm');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes separates operator and agent speaker ownership', () => {
  const previousDocument = globalThis.document;
  const rendered: Array<{ className: string; children: Array<{ className?: string; textContent?: string }> }> = [];
  const list = {
    className: '',
    replaceChildren() {
      rendered.length = 0;
    },
    append(item: { className: string; children: Array<{ className?: string; textContent?: string }> }) {
      rendered.push(item);
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-note-list') return list;
      return null;
    },
    createElement() {
      return {
        className: '',
        textContent: '',
        type: '',
        dataset: {} as Record<string, string>,
        children: [] as Array<{ className?: string; textContent?: string }>,
        append(...children: Array<{ className?: string; textContent?: string }>) {
          this.children.push(...children);
        }
      };
    }
  };
  try {
    state.threadId = 'thread-card-a';
    state.activeLedger = {
      notes: {
        'thread-card-a': [
          { role: 'operator', message: 'Operator question.' },
          { role: 'assistant', message: 'Agent answer.' }
        ]
      }
    };
    renderThreadNotes();
    assert.equal(rendered[0].className, 'thread-note is-operator');
    assert.equal(rendered[1].className, 'thread-note is-agent');
    assert.equal(rendered[0].children[1].textContent, 'operator');
    assert.equal(rendered[1].children[1].textContent, 'agent');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});
