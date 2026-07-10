/**
 * WHAT: Integration coverage for ledger and thread content refresh routing.
 * WHY: Async content updates must preserve voice deferral, geometry work, and newer operator selection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state } from '../../src/runtime/state.js';

function source(path: string): string {
  const file = resolve(process.cwd(), path);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
}

type ThreadFakeElement = {
  dataset: Record<string, string>;
  className: string;
  hidden: boolean;
  textContent: string;
  value: string;
  children: ThreadFakeElement[];
  parentElement: ThreadFakeElement | null;
  style: { setProperty(name: string, value: string): void; getPropertyValue(name: string): string };
  classList: { toggle(name: string, force?: boolean): void; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  append(...nodes: ThreadFakeElement[]): void;
  replaceChildren(...nodes: ThreadFakeElement[]): void;
  querySelector(selector: string): ThreadFakeElement | null;
  querySelectorAll(selector: string): ThreadFakeElement[];
  setAttribute(name: string, value: string): void;
  addEventListener(): void;
};

const threadDom = {
  telemetryList: threadElement('telemetry-list'),
  threadPanel: threadElement('thread-panel'),
  panel: threadElement('panel'),
  shell: threadElement('shell'),
  threadTarget: threadElement('thread-target'),
  threadHeading: threadElement('thread-heading')
};

function threadElement(className = ''): ThreadFakeElement {
  const properties = new Map<string, string>();
  const element: ThreadFakeElement = {
    dataset: {},
    className,
    hidden: false,
    textContent: '',
    value: '',
    children: [],
    parentElement: null,
    style: {
      setProperty(name: string, value: string) {
        properties.set(name, value);
      },
      getPropertyValue(name: string) {
        return properties.get(name) ?? '';
      }
    },
    classList: {
      toggle(name: string, force?: boolean) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
      },
      add(...names: string[]) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        for (const name of names) classes.add(name);
        element.className = [...classes].join(' ');
      },
      remove(...names: string[]) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        for (const name of names) classes.delete(name);
        element.className = [...classes].join(' ');
      },
      contains(name: string) {
        return element.className.split(/\s+/).includes(name);
      }
    },
    append(...nodes: ThreadFakeElement[]) {
      for (const node of nodes) {
        node.parentElement = element;
        element.children.push(node);
      }
    },
    replaceChildren(...nodes: ThreadFakeElement[]) {
      for (const child of element.children) child.parentElement = null;
      element.children = [];
      element.append(...nodes);
    },
    querySelector(selector: string) {
      if (selector === '.thread-actions') return element.children.find((child) => child.className.split(/\s+/).includes('thread-actions')) ?? null;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    setAttribute(name: string, value: string) {
      if (name.startsWith('data-')) element.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = value;
    },
    addEventListener() {}
  };
  return element;
}

function installThreadRefreshDom(): void {
  for (const element of Object.values(threadDom)) {
    element.replaceChildren();
    element.hidden = false;
    element.textContent = '';
    element.value = '';
  }
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    detail: unknown;
    constructor(_name: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {}, location: { pathname: '/specs' } };
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 0;
  };
  const storage = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    }
  };
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.telemetry-list') return threadDom.telemetryList;
      if (selector === '.thread-panel') return threadDom.threadPanel;
      if (selector === '.panel') return threadDom.panel;
      if (selector === '.shell') return threadDom.shell;
      if (selector === '.thread-target') return threadDom.threadTarget;
      if (selector === '.thread-heading') return threadDom.threadHeading;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return threadElement();
    }
  };
}

async function flushThreadRefresh(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

test('ledger content refresh is deferred while voice recording is active', async () => {
  installThreadRefreshDom();
  const { requestLedgerContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    detail: unknown;
    constructor(_name: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  state.pendingLedgerContentRefresh = false;
  state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, transcriptionStatus: 'recording' };

  try {
    requestLedgerContentRefresh('card-content-change');

    assert.equal(state.pendingLedgerContentRefresh, true);
    assert.equal(state.voice.recording, true);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    state.pendingLedgerContentRefresh = false;
  }
});

test('thread content refresh is deferred separately from canvas refresh while voice recording is active', async () => {
  installThreadRefreshDom();
  const { requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    detail: unknown;
    constructor(_name: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  state.pendingThreadContentRefresh = false;
  state.pendingLedgerContentRefresh = false;
  state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, transcriptionStatus: 'recording' };

  try {
    requestThreadContentRefresh('thread-content-change');

    assert.equal(state.pendingThreadContentRefresh, true);
    assert.equal(state.pendingLedgerContentRefresh, false);
    assert.equal(state.voice.recording, true);
  } finally {
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
    state.pendingThreadContentRefresh = false;
    state.pendingLedgerContentRefresh = false;
  }
});

test('thread content refresh keeps newer selection made while same-ledger load is in flight', async () => {
  installThreadRefreshDom();
  const { requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.pointer = null;
  state.threadPanelOpen = false;
  state.activeTool = 'select';
  state.threadId = 'thread-card-a';
  state.renderedThreadId = '';
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'A', x: 10, y: 20, w: 240, h: 132 },
      { id: 'card-b', title: 'B', x: 100, y: 120, w: 240, h: 132 }
    ],
    annotations: [],
    relationships: [],
    notes: { 'thread-card-a': [{ id: 'note-a', role: 'operator', message: 'A' }] }
  };

  let resolveFetch!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const fetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    };
  });

  requestThreadContentRefresh('thread-content-change');
  await fetchStarted;
  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
  resolveFetch({
    ok: true,
    async json() {
      return {
        cards: [
          { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
          { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 }
        ],
        annotations: [],
        relationships: [],
        notes: { 'thread-card-a': [{ id: 'server-note', role: 'agent', message: 'Fresh' }] }
      };
    }
  });
  await flushThreadRefresh();

  assert.deepEqual(state.selection.cardIds, ['card-b']);
});

test('thread content events rerender the thread panel without remounting the canvas', () => {
  const refresh = source('frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts');
  assert.match(refresh, /const payload = contentEventPayload\(event\)/);
  assert.match(refresh, /payload\.kind === 'thread-content'/);
  assert.match(refresh, /requestThreadContentRefresh\('thread-content-change'\)/);
  assert.match(refresh, /renderThreadPanel\(\)/);
  assert.match(refresh, /const selectionAtRefreshStart = cloneSelectionState\(state\.selection\)/);
  assert.match(refresh, /selectionStatesEqual\(state\.selection, selectionAtRefreshStart\)/);
  assert.match(refresh, /state\.selection = cloneSelectionState\(selectionAtRefreshStart\)/);
  assert.doesNotMatch(refresh, /thread-content-change'[\s\S]{0,260}renderCanvasSurface\(\)/);
});

test('card content refresh resizes the changed card after the refreshed render', () => {
  const refresh = source('frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts');

  assert.match(refresh, /requestLedgerContentRefresh\('card-content-change', \{ contentFile: payload\.contentFile \}\)/);
  assert.match(refresh, /renderCanvasSurface\(\);\s*\n\s*if \(options\.contentFile\) await resizeChangedCardToContent\(options\.contentFile\);/);
  assert.match(refresh, /changedCardIdForContentFile\(contentFile\)/);
  assert.match(refresh, /resizeSelectedCardsToContent\(\{ cardIds: \[cardId\], zoneIds: \[\] \}\)/);
  assert.match(refresh, /commitActiveLedgerMutation\(\{ action: 'patch-geometry', geometry \}, \{ render: true \}\)/);
});

test('changedCardIdForContentFile resolves the hydrated ledger card that owns the changed markdown file', async () => {
  installThreadRefreshDom();
  const { changedCardIdForContentFile } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  const previousLedger = state.activeLedger;
  state.activeLedger = {
    cards: [
      { id: 'card-a', comment: { contentFile: '.decision-os/cards/specs/card-a.md' } },
      { id: 'card-b', comment: { contentFile: '.decision-os/cards/specs/card-b.md' } }
    ]
  };

  try {
    assert.equal(changedCardIdForContentFile('/.decision-os/cards/specs/card-b.md'), 'card-b');
    assert.equal(changedCardIdForContentFile('.decision-os/cards/specs/missing.md'), '');
  } finally {
    state.activeLedger = previousLedger;
  }
});
