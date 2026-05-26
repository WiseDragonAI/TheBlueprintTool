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

type TestElement = {
  tagName: string;
  className: string;
  textContent: string;
  type: string;
  title: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  children: TestElement[];
  classList: { add: (...names: string[]) => void };
  append: (...children: TestElement[]) => void;
  appendChild: (child: TestElement) => TestElement;
  setAttribute: (name: string, value: string) => void;
};

function createTestElement(textContent = '', tagName = ''): TestElement {
  const element = {} as TestElement;
  element.tagName = tagName;
  element.className = '';
  element.textContent = textContent;
  element.type = '';
  element.title = '';
  element.dataset = {};
  element.attributes = {};
  element.children = [];
  element.classList = {
    add: (...names: string[]) => {
      element.className = [element.className, ...names].filter(Boolean).join(' ');
    }
  };
  element.append = (...children: TestElement[]) => {
    element.children.push(...children);
  };
  element.appendChild = (child: TestElement) => {
    element.children.push(child);
    return child;
  };
  element.setAttribute = (name: string, value: string) => {
    element.attributes[name] = value;
  };
  return element;
}

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
  const rendered: TestElement[] = [];
  const list = {
    className: '',
    replaceChildren() {
      rendered.length = 0;
    },
    append(item: TestElement) {
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
    createElement(tagName: string) {
      return createTestElement('', tagName);
    },
    createTextNode(text: string) {
      return createTestElement(text);
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
  const rendered: TestElement[] = [];
  const list = {
    className: '',
    replaceChildren() {
      rendered.length = 0;
    },
    append(item: TestElement) {
      rendered.push(item);
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-note-list') return list;
      return null;
    },
    createElement(tagName: string) {
      return createTestElement('', tagName);
    },
    createTextNode(text: string) {
      return createTestElement(text);
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
    const deleteButton = rendered[0].children.find((child) => child.className?.includes('thread-note-delete'));
    assert.equal(deleteButton?.dataset?.action, 'confirm-delete-note');
    assert.equal(deleteButton?.dataset?.noteId, 'note-1');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes separates operator and agent speaker ownership', () => {
  const previousDocument = globalThis.document;
  const rendered: TestElement[] = [];
  const list = {
    className: '',
    replaceChildren() {
      rendered.length = 0;
    },
    append(item: TestElement) {
      rendered.push(item);
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-note-list') return list;
      return null;
    },
    createElement(tagName: string) {
      return createTestElement('', tagName);
    },
    createTextNode(text: string) {
      return createTestElement(text);
    }
  };
  try {
    state.threadId = 'thread-card-a';
    state.activeLedger = {
      notes: {
        'thread-card-a': [
          { id: 'note-operator', role: 'operator', message: 'Operator question.', status: 'transcribed' },
          { id: 'note-agent', role: 'assistant', message: '**Agent** answer.' }
        ]
      }
    };
    renderThreadNotes();
    assert.equal(rendered[0].className, 'thread-note is-operator');
    assert.equal(rendered[1].className, 'thread-note is-agent');
    assert.equal(rendered[0].children[0].className, 'ledger-card-body thread-note-message');
    assert.equal(rendered[0].children[1].textContent, 'transcribed');
    const agentParagraph = rendered[1].children[0].children[0];
    assert.equal(agentParagraph.children[0].tagName, 'strong');
    assert.equal(agentParagraph.children[0].textContent, 'Agent');
    assert.equal(agentParagraph.children[1].textContent, ' answer.');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});
