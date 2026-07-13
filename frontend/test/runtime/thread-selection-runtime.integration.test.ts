/**
 * WHAT: Runtime tests for default thread selection and note rendering.
 * WHY: Clicking a canvas object should select its thread and show conversation entries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { threadIdForTarget } from '../../src/runtime/thread/helper/thread-id-for-target.js';
import { selectThread } from '../../src/runtime/thread/effect/select-thread.js';
import { closeThreadPanel } from '../../src/runtime/thread/effect/close-thread-panel.js';
import { restoreThreadDraft, saveThreadDraft } from '../../src/runtime/thread/effect/persist-thread-draft.js';
import { restoreThreadScrollPosition, saveThreadScrollPosition } from '../../src/runtime/thread/effect/persist-thread-scroll.js';
import { pinThreadFeedToLastMessage } from '../../src/runtime/thread/effect/pin-thread-feed-to-last-message.js';
import { isThreadFollowingBottom } from '../../src/runtime/thread/helper/thread-follow-bottom.js';
import { renderThreadJumpButton } from '../../src/runtime/thread/effect/render-thread-jump-button.js';
import { renderThreadNotes } from '../../src/runtime/thread/effect/render-thread-notes.js';
import { state } from '../../src/runtime/state.js';

type TestElement = {
  tagName: string;
  className: string;
  textContent: string;
  type: string;
  title: string;
  hidden: boolean;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  children: TestElement[];
  classList: { add: (...names: string[]) => void };
  append: (...children: TestElement[]) => void;
  appendChild: (child: TestElement) => TestElement;
  replaceChildren: (...children: TestElement[]) => void;
  setAttribute: (name: string, value: string) => void;
};

function createTestElement(textContent = '', tagName = ''): TestElement {
  const element = {} as TestElement;
  element.tagName = tagName;
  element.className = '';
  element.textContent = textContent;
  element.type = '';
  element.title = '';
  element.hidden = false;
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
  element.replaceChildren = (...children: TestElement[]) => {
    element.children = children;
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
    assert.equal(state.threadPinOnRender, true);
    assert.equal(state.voice.transcriptionStatus, 'idle');
    assert.equal(state.voice.voiceFileRef, undefined);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    delete state.threadPinOnRender;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});

test('select-thread restores saved thread scroll instead of pinning when returning to a thread', () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const previousDocument = globalThis.document;
  const chat = { scrollTop: 184 };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel .chat') return chat;
      return null;
    }
  };
  try {
    state.threadId = 'thread-card-a';
    state.threadScrollTopByThreadId = { 'thread-card-b': 42 };
    state.voice = { recording: false, startedAt: 0, durationMs: 12, level: 0, transcriptionStatus: 'idle' };
    selectThread('thread-card-b');
    assert.equal(state.threadScrollTopByThreadId['thread-card-a'], 184);
    assert.equal(state.threadId, 'thread-card-b');
    assert.equal(state.threadPinOnRender, false);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.threadScrollTopByThreadId = {};
    delete state.threadPinOnRender;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});

test('select-thread ignores thread changes while voice recording is active', () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  try {
    state.threadId = 'thread-card-a';
    state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, transcriptionStatus: 'recording', threadId: 'thread-card-a' };
    selectThread('thread-card-b');
    assert.equal(state.threadId, 'thread-card-a');
    assert.equal(state.voice.threadId, 'thread-card-a');
    assert.equal(state.voice.transcriptionStatus, 'recording');
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});

test('close-thread-panel ignores close requests while voice recording is active', () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  try {
    state.threadId = 'thread-card-a';
    state.threadPanelOpen = true;
    state.activeTool = 'select';
    state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, transcriptionStatus: 'recording', threadId: 'thread-card-a' };
    closeThreadPanel();
    assert.equal(state.threadPanelOpen, true);
    assert.equal(state.threadId, 'thread-card-a');
    assert.equal(state.voice.recording, true);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.threadPanelOpen = false;
    state.activeTool = 'select';
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});

test('thread drafts persist per thread through localStorage', () => {
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  const values = new Map<string, string>();
  const draft = { value: 'Draft A' };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector: (selector: string) => selector === '.thread-draft' ? draft : null
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };

  try {
    saveThreadDraft('thread-card-a');
    draft.value = 'Draft B';
    saveThreadDraft('thread-card-b');
    draft.value = '';
    restoreThreadDraft('thread-card-a');
    assert.equal(draft.value, 'Draft A');
    restoreThreadDraft('thread-card-b');
    assert.equal(draft.value, 'Draft B');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { localStorage: unknown }).localStorage = previousLocalStorage;
  }
});

test('thread scroll position persists per thread and restores after layout settles', () => {
  const previousDocument = globalThis.document;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  let deferredFrame: FrameRequestCallback | null = null;
  const chat = { scrollTop: 128, scrollHeight: 900, clientHeight: 300 };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel .chat') return chat;
      return null;
    }
  };
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    deferredFrame = callback;
    return 1;
  };
  try {
    saveThreadScrollPosition('thread-card-a');
    assert.equal(state.threadScrollTopByThreadId['thread-card-a'], 128);
    chat.scrollTop = 0;
    assert.equal(restoreThreadScrollPosition('thread-card-a'), true);
    assert.equal(chat.scrollTop, 128);
    chat.scrollTop = 0;
    deferredFrame?.(0);
    assert.equal(chat.scrollTop, 128);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = previousRequestAnimationFrame;
    state.threadScrollTopByThreadId = {};
  }
});

test('thread selection remembers tabs and keeps conversation and log scroll positions independent', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const conversation = { scrollTop: 120, scrollHeight: 900, clientHeight: 300 };
  const log = { scrollTop: 360, scrollHeight: 1200, clientHeight: 300 };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel .thread-conversation-scroll') return conversation;
      if (selector === '.thread-panel .thread-log-scroll') return log;
      return null;
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    constructor(_name: string, public options: Record<string, unknown> = {}) {}
  };
  try {
    state.threadId = 'thread-card-a';
    state.threadActiveTabByThreadId = { 'thread-card-a': 'codex-log' };
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    selectThread('thread-card-b');
    assert.equal(state.threadActiveTabByThreadId['thread-card-a'], 'codex-log');
    assert.equal(state.threadActiveTabByThreadId['thread-card-b'], 'thread');
    assert.equal(state.threadScrollTopByThreadId['thread-card-a'], 120);
    assert.equal(state.threadLogScrollTopByThreadId['thread-card-a'], 360);

    conversation.scrollTop = 42;
    log.scrollTop = 88;
    state.threadActiveTabByThreadId['thread-card-b'] = 'codex-log';
    selectThread('thread-card-a');
    assert.equal(state.threadActiveTabByThreadId['thread-card-a'], 'codex-log');
    assert.equal(state.threadScrollTopByThreadId['thread-card-b'], 42);
    assert.equal(state.threadLogScrollTopByThreadId['thread-card-b'], 88);

    conversation.scrollTop = 0;
    log.scrollTop = 0;
    assert.equal(restoreThreadScrollPosition('thread-card-b', 'thread'), true);
    assert.equal(restoreThreadScrollPosition('thread-card-b', 'codex-log'), true);
    assert.equal(conversation.scrollTop, 42);
    assert.equal(log.scrollTop, 88);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.threadId = '';
    state.threadActiveTabByThreadId = {};
    state.threadScrollTopByThreadId = {};
    state.threadLogScrollTopByThreadId = {};
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  }
});

test('pin-thread-feed-to-last-message scrolls the thread viewport to the newest note', () => {
  const previousDocument = globalThis.document;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  let deferredFrame: FrameRequestCallback | null = null;
  const chat = { scrollTop: 0, scrollHeight: 640 };
  const lastNote = {
    scrollIntoViewOptions: null as ScrollIntoViewOptions | null,
    scrollIntoView(options: ScrollIntoViewOptions) {
      this.scrollIntoViewOptions = options;
    }
  };
  const list = { lastElementChild: lastNote };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel .chat') return chat;
      if (selector === '.thread-note-list') return list;
      return null;
    }
  };
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    deferredFrame = callback;
    return 1;
  };
  try {
    pinThreadFeedToLastMessage();
    assert.equal(chat.scrollTop, 640);
    assert.deepEqual(lastNote.scrollIntoViewOptions, { block: 'end', inline: 'nearest' });
    chat.scrollTop = 0;
    deferredFrame?.(0);
    assert.equal(chat.scrollTop, 640);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = previousRequestAnimationFrame;
  }
});

test('pin-thread-feed-to-last-message activates follow-bottom on the primary mobile viewport', () => {
  const previousDocument = globalThis.document;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const chat = { scrollTop: 0, scrollHeight: 720 };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel .thread-conversation-scroll') return chat;
      return null;
    }
  };
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = undefined;
  state.threadId = 'thread-mobile';
  state.threadFollowBottomByThreadId = {};
  try {
    pinThreadFeedToLastMessage({ follow: true });
    assert.equal(chat.scrollTop, 720);
    assert.equal(isThreadFollowingBottom('thread-mobile'), true);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = previousRequestAnimationFrame;
    state.threadId = '';
    state.threadFollowBottomByThreadId = {};
  }
});

test('render-thread-jump-button shows only when the thread viewport is away from the bottom', () => {
  const previousDocument = globalThis.document;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  let frame: TestElement | null = null;
  let button: TestElement | null = null;
  let scrollHandler: EventListener | null = null;
  const shell = {
    children: [] as TestElement[],
    append(child: TestElement) {
      this.children.push(child);
      if (child.className === 'thread-jump-bottom-frame') frame = child;
    }
  };
  const chat = {
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 300,
    children: [] as TestElement[],
    append(child: TestElement) {
      this.children.push(child);
    },
    addEventListener(type: string, handler: EventListener) {
      if (type === 'scroll') scrollHandler = handler;
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.thread-panel .chat') return chat;
      if (selector === '.thread-panel .thread-chat-shell') return shell;
      if (selector === '.thread-panel .thread-jump-bottom-frame') return frame;
      if (selector === '.thread-panel .thread-jump-bottom') return button;
      return null;
    },
    createElement(tagName: string) {
      const element = createTestElement('', tagName);
      const append = element.append;
      element.append = (...children: TestElement[]) => {
        append(...children);
        for (const child of children) {
          if (child.className === 'thread-jump-bottom') button = child;
        }
      };
      return element;
    }
  };
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
  try {
    state.threadId = 'thread-jump';
    state.threadFollowBottomByThreadId = { 'thread-jump': true };
    renderThreadJumpButton();
    assert.equal(shell.children[0], frame);
    assert.equal(chat.children.length, 0);
    assert.equal(button?.dataset.action, 'jump-thread-bottom');
    assert.equal(button?.attributes['aria-label'], 'Jump to bottom');
    assert.equal(button?.children[0].className, 'thread-jump-bottom-chevron');
    assert.equal((button as TestElement & { hidden: boolean }).hidden, false);
    assert.equal(button?.attributes['aria-hidden'], 'false');

    button!.dataset.action = 'close-thread-text';
    chat.scrollTop = 600;
    scrollHandler?.(new Event('scroll'));
    assert.equal((button as TestElement & { hidden: boolean }).hidden, false);
    assert.equal(button?.attributes['aria-hidden'], 'false');

    button!.dataset.action = 'jump-thread-bottom';
    chat.scrollTop = 560;
    scrollHandler?.(new Event('scroll'));
    assert.equal((button as TestElement & { hidden: boolean }).hidden, true);
    assert.equal(button?.attributes['aria-hidden'], 'true');
    assert.equal(isThreadFollowingBottom('thread-jump'), false);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = previousRequestAnimationFrame;
    state.threadId = '';
    state.threadFollowBottomByThreadId = {};
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
        'thread-card-a': [{ role: 'operator', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'pending' }]
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
        'thread-card-a': [{ id: 'note-1', role: 'operator', message: 'Voice uploaded; transcription failed.', voiceFileRef: '/tmp/voice.webm', status: 'transcription failed' }]
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
    assert.equal(deleteButton?.textContent, 'X');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes keeps active voice transcription progress concise', () => {
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
        'thread-card-a': [{ id: 'note-busy', role: 'operator', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'transcribing', transcriptionStartedAt: new Date().toISOString() }]
      }
    };
    renderThreadNotes();
    assert.equal(rendered[0].className, 'thread-note voice-note is-busy is-operator');
    assert.equal(rendered[0].children.some((child) => child.className === 'thread-note-meta'), false);
    const spinner = rendered[0].children.find((child) => child.className === 'thread-note-spinner');
    assert.equal(spinner?.textContent, 'Transcribing · 0s');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes keeps pending voice state server-owned until reconciliation', () => {
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
        'thread-card-a': [{ id: 'note-stale', role: 'operator', message: 'Voice uploaded.', voiceFileRef: '/tmp/voice.webm', status: 'transcribing' }]
      }
    };
    renderThreadNotes();
    const note = state.activeLedger.notes['thread-card-a'][0];
    assert.equal(note.status, 'transcribing');
    assert.equal(rendered[0].className, 'thread-note voice-note is-busy is-operator');
    const retry = rendered[0].children.find((child) => child.className?.includes('thread-note-retry'));
    assert.equal(retry, undefined);
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
          { id: 'note-agent', role: 'assistant', message: '**Agent** answer.\n\n---\n\n`Tail` line.' }
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
    const sharedRule = rendered[1].children[0].children[1];
    assert.equal(sharedRule.tagName, 'hr');
    assert.equal(sharedRule.className, 'ledger-card-hr');
    const tailParagraph = rendered[1].children[0].children[2];
    assert.equal(tailParagraph.children[0].tagName, 'code');
    assert.equal(tailParagraph.children[0].textContent, 'Tail');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes projects direct conversation and excludes Codex lifecycle artifacts', () => {
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
          { id: 'note-operator', role: 'operator', message: 'Please inspect this card.' },
          { id: 'note-agent', role: 'agent', message: 'Direct agent answer mentioning Codex.' },
          { id: 'artifact-run', role: 'agent', message: 'Run artifact', codexRunId: 'codex-skill-1-run' },
          { id: 'artifact-kind', role: 'agent', message: 'Kind artifact', codexKind: 'tool_call' },
          { id: 'artifact-event', role: 'agent', message: 'Event artifact', codexEventType: 'item.completed' },
          { id: 'artifact-line', role: 'agent', message: 'Line artifact', codexLine: '4' },
          { id: 'artifact-tool', role: 'agent', message: 'Tool artifact', codexTool: 'rg TODO' },
          { id: 'artifact-exit', role: 'agent', message: 'Exit artifact', codexExitCode: '0' },
          { id: 'codex-skill-1-run-line-9', role: 'agent', message: 'Deterministic id artifact' },
        ]
      }
    };
    renderThreadNotes();
    assert.equal(rendered.length, 2);
    assert.deepEqual(rendered.map((item) => item.className), ['thread-note is-operator', 'thread-note is-agent']);
    assert.equal(rendered[0].children[0].children[0].children[0].textContent, 'Please inspect this card.');
    assert.equal(rendered[1].children[0].children[0].children[0].textContent, 'Direct agent answer mentioning Codex.');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});

test('render-thread-notes renders escaped newline agent answers as markdown blocks', () => {
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
          { id: 'note-agent', role: 'assistant', message: 'Treated.\\n\\nSave research report:\\n- `UDatabaseController::CreateTables`\\n- `FWorldCellDataInterface`' }
        ]
      }
    };
    renderThreadNotes();
    const body = rendered[0].children[0];
    assert.equal(rendered[0].className, 'thread-note is-agent');
    assert.equal(body.children.length, 3);
    assert.equal(body.children[0].tagName, 'p');
    assert.equal(body.children[0].children[0].textContent, 'Treated.');
    assert.equal(body.children[1].children[0].textContent, 'Save research report:');
    assert.equal(body.children[2].tagName, 'ul');
    assert.equal(body.children[2].children.length, 2);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.threadId = '';
    state.activeLedger = null;
  }
});
