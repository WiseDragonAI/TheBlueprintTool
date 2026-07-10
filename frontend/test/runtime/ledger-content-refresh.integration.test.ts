/**
 * WHAT: Integration coverage for scoped SSE refreshes and the accumulating refresh drain.
 * WHY: External writes must update their owned slice without remounting live controls or dropping queued files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../src/runtime/state.js';

type Listener = (event: Event) => void;

type FakeStyle = Record<string, string> & {
  setProperty(name: string, value: string): void;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
};

type FakeElement = {
  tagName: string;
  id: string;
  className: string;
  dataset: Record<string, string>;
  style: FakeStyle;
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  type: string;
  title: string;
  value: string;
  disabled: boolean;
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientWidth: number;
  clientHeight: number;
  children: FakeElement[];
  parentElement: FakeElement | null;
  isConnected: boolean;
  readonly childElementCount: number;
  readonly offsetLeft: number;
  readonly offsetTop: number;
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  matches(selector: string): boolean;
  closest(selector: string): FakeElement | null;
  append(...nodes: FakeElement[]): void;
  appendChild(node: FakeElement): FakeElement;
  insertBefore(node: FakeElement, before: FakeElement | null): void;
  replaceChildren(...nodes: FakeElement[]): void;
  remove(): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  dispatchEvent(event: Event): boolean;
  focus(): void;
  blur(): void;
  scrollTo(options?: unknown): void;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
};

const elementListeners = new WeakMap<FakeElement, Map<string, Listener[]>>();
let activeElement: FakeElement | null = null;

function fakeElement(dataset: Record<string, string> = {}, tagName = 'div'): FakeElement {
  const customProperties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const style = {
    left: '0px', top: '0px', width: '120px', height: '80px', minHeight: '', display: '', transition: '', transform: '', visibility: '',
    color: '', textShadow: '', paddingTop: '0px', paddingBottom: '0px', right: '', bottom: '', maxWidth: '', position: '', zIndex: '', boxSizing: '',
    setProperty(name: string, value: string) { customProperties.set(name, value); style[name] = value; },
    getPropertyValue(name: string) { return customProperties.get(name) ?? style[name] ?? ''; },
    removeProperty(name: string) { customProperties.delete(name); delete style[name]; }
  } as unknown as FakeStyle;
  const element: FakeElement = {
    tagName: tagName.toUpperCase(), id: '', className: '', dataset, style, hidden: false, textContent: '', innerHTML: '', type: '', title: '', value: '', disabled: false,
    scrollTop: 0, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0, clientWidth: 120, clientHeight: 80, children: [], parentElement: null, isConnected: true,
    get childElementCount() { return element.children.length; },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    classList: {
      toggle(name: string, force?: boolean) {
        const next = classSet(element);
        const shouldAdd = force ?? !next.has(name);
        if (shouldAdd) next.add(name); else next.delete(name);
        element.className = [...next].join(' ');
        return shouldAdd;
      },
      add(...names: string[]) { const next = classSet(element); for (const name of names) next.add(name); element.className = [...next].join(' '); },
      remove(...names: string[]) { const next = classSet(element); for (const name of names) next.delete(name); element.className = [...next].join(' '); },
      contains(name: string) { return classSet(element).has(name); }
    },
    querySelector(selector: string) { return element.querySelectorAll(selector)[0] ?? null; },
    querySelectorAll(selector: string) { return queryAll(element, selector); },
    matches(selector: string) { return matchesSelectorList(element, selector); },
    closest(selector: string) {
      let current: FakeElement | null = element;
      while (current) { if (matchesSelectorList(current, selector)) return current; current = current.parentElement; }
      return null;
    },
    append(...nodes: FakeElement[]) { for (const node of nodes) appendChildElement(element, node); },
    appendChild(node: FakeElement) { appendChildElement(element, node); return node; },
    insertBefore(node: FakeElement, before: FakeElement | null) {
      detach(node);
      const index = before ? element.children.indexOf(before) : -1;
      if (index >= 0) element.children.splice(index, 0, node); else element.children.push(node);
      node.parentElement = element;
      markConnected(node, true);
    },
    replaceChildren(...nodes: FakeElement[]) {
      for (const child of element.children) { child.parentElement = null; markConnected(child, false); }
      element.children = [];
      element.append(...nodes);
    },
    remove() { detach(element); markConnected(element, false); },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name.startsWith('data-')) element.dataset[dataKey(name.slice(5))] = value;
    },
    getAttribute(name: string) {
      if (name === 'id') return element.id || null;
      if (name === 'class') return element.className || null;
      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] ?? null;
      return attributes.get(name) ?? null;
    },
    hasAttribute(name: string) {
      if (name === 'id') return Boolean(element.id);
      if (name === 'class') return Boolean(element.className);
      if (name.startsWith('data-')) return element.dataset[dataKey(name.slice(5))] !== undefined;
      return attributes.has(name);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
      if (name === 'id') element.id = '';
      if (name === 'class') element.className = '';
      if (name.startsWith('data-')) delete element.dataset[dataKey(name.slice(5))];
    },
    addEventListener(type: string, listener: Listener) {
      const byType = elementListeners.get(element) ?? new Map<string, Listener[]>();
      byType.set(type, [...(byType.get(type) ?? []), listener]);
      elementListeners.set(element, byType);
    },
    removeEventListener(type: string, listener: Listener) {
      const byType = elementListeners.get(element);
      if (byType) byType.set(type, (byType.get(type) ?? []).filter((entry) => entry !== listener));
    },
    dispatchEvent(event: Event) { for (const listener of elementListeners.get(element)?.get(event.type) ?? []) listener.call(element, event); return true; },
    focus() { activeElement = element; },
    blur() { if (activeElement === element) activeElement = null; },
    scrollTo(options?: unknown) {
      const scroll = options as { left?: number; top?: number } | undefined;
      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
    },
    getBoundingClientRect() {
      return { left: element.offsetLeft, top: element.offsetTop, right: element.offsetLeft + element.offsetWidth, bottom: element.offsetTop + element.offsetHeight, width: element.offsetWidth, height: element.offsetHeight };
    }
  };
  return element;
}

function classSet(element: FakeElement): Set<string> { return new Set(element.className.split(/\s+/).filter(Boolean)); }
function dataKey(attribute: string): string { return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()); }
function descendants(element: FakeElement): FakeElement[] { return element.children.flatMap((child) => [child, ...descendants(child)]); }
function appendChildElement(parent: FakeElement, child: FakeElement): void { detach(child); parent.children.push(child); child.parentElement = parent; markConnected(child, true); }
function detach(element: FakeElement): void { if (!element.parentElement) return; element.parentElement.children = element.parentElement.children.filter((child) => child !== element); element.parentElement = null; }
function markConnected(element: FakeElement, connected: boolean): void { element.isConnected = connected; for (const child of element.children) markConnected(child, connected); }

function queryAll(root: FakeElement, selector: string): FakeElement[] {
  const found: FakeElement[] = [];
  const seen = new Set<FakeElement>();
  for (const rawPart of selector.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const direct = part.startsWith(':scope > ');
    const normalized = part.replace(/^:scope\s*>\s*/, '').trim().split(/\s+>\s+|\s+/).at(-1) ?? '';
    const candidates = direct ? root.children : descendants(root);
    for (const candidate of candidates) {
      if (!seen.has(candidate) && matchesSelector(candidate, normalized)) { seen.add(candidate); found.push(candidate); }
    }
  }
  return found;
}

function matchesSelectorList(element: FakeElement, selector: string): boolean { return selector.split(',').some((part) => matchesSelector(element, part.trim())); }

function matchesSelector(element: FakeElement, selector: string): boolean {
  if (!selector) return false;
  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
  remaining = remaining.replace(/:not\([^)]+\)/g, '');
  if (notMatches.some((notSelector) => matchesSelector(element, notSelector))) return false;
  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;
  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');
  const classNames = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  if (classNames.some((className) => !classSet(element).has(className))) return false;
  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');
  const attributes = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
  for (const [, attribute, expected] of attributes) {
    const actual = attribute.startsWith('data-') ? element.dataset[dataKey(attribute.slice(5))] : element.getAttribute(attribute);
    if (expected === undefined ? actual === undefined || actual === null : actual !== expected) return false;
  }
  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();
  return !remaining || remaining === '*' || element.tagName.toLowerCase() === remaining.toLowerCase();
}

const runtimeDom = (() => {
  const root = fakeElement({}, 'document');
  const canvas = fakeElement({}, 'div');
  const content = fakeElement({}, 'div');
  const controlOverlay = fakeElement({}, 'div');
  const mediaOverlay = fakeElement({}, 'div');
  const telemetryList = fakeElement({}, 'ol');
  const marquee = fakeElement({}, 'div');
  const panel = fakeElement({}, 'aside');
  const threadPanel = fakeElement({}, 'aside');
  const shell = fakeElement({}, 'main');
  const threadTarget = fakeElement({}, 'div');
  const threadHeading = fakeElement({}, 'div');
  const tabs = fakeElement({}, 'nav');
  const topbarTitle = fakeElement({}, 'button');
  const kicker = fakeElement({}, 'span');
  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
})();

function resetRuntimeDom(): void {
  for (const element of Object.values(runtimeDom)) {
    element.children = [];
    element.parentElement = null;
    element.isConnected = true;
    element.hidden = false;
    element.textContent = '';
    element.innerHTML = '';
    element.className = '';
    element.style.left = '0px'; element.style.top = '0px'; element.style.width = '120px'; element.style.height = '80px'; element.style.minHeight = '';
  }
  runtimeDom.canvas.className = 'canvas'; runtimeDom.canvas.style.width = '1000px'; runtimeDom.canvas.style.height = '800px';
  runtimeDom.content.className = 'canvas-content';
  runtimeDom.controlOverlay.className = 'canvas-control-overlay';
  runtimeDom.mediaOverlay.className = 'canvas-media-overlay';
  runtimeDom.telemetryList.className = 'telemetry-list';
  runtimeDom.marquee.className = 'marquee'; runtimeDom.marquee.hidden = true;
  runtimeDom.panel.className = 'panel'; runtimeDom.threadPanel.className = 'thread-panel'; runtimeDom.shell.className = 'shell';
  runtimeDom.threadTarget.className = 'thread-target'; runtimeDom.threadHeading.className = 'thread-heading'; runtimeDom.tabs.className = 'tabs';
  runtimeDom.topbarTitle.className = 'topbar-title-action'; runtimeDom.kicker.className = 'kicker';
  runtimeDom.root.append(runtimeDom.canvas, runtimeDom.telemetryList, runtimeDom.panel, runtimeDom.threadPanel, runtimeDom.shell, runtimeDom.threadTarget, runtimeDom.threadHeading, runtimeDom.tabs, runtimeDom.topbarTitle, runtimeDom.kicker);
  runtimeDom.canvas.append(runtimeDom.content, runtimeDom.controlOverlay, runtimeDom.mediaOverlay);
  runtimeDom.content.append(runtimeDom.marquee);
  activeElement = null;
}

function installRuntimeDom(): void {
  resetRuntimeDom();
  const storage = new Map<string, string>();
  (globalThis as unknown as { document: unknown }).document = {
    title: '', fonts: { ready: Promise.resolve() }, documentElement: { clientWidth: 1000, clientHeight: 800 },
    get activeElement() { return activeElement; },
    querySelector(selector: string) { return runtimeDom.root.querySelector(selector); },
    querySelectorAll(selector: string) { return runtimeDom.root.querySelectorAll(selector); },
    createElement(tagName: string) { return fakeElement({}, tagName); },
    createTextNode(text: string) { const node = fakeElement({}, '#text'); node.textContent = text; return node; },
    createElementNS(_namespace: string, tagName: string) { return fakeElement({}, tagName); }
  };
  (globalThis as unknown as { window: unknown }).window = { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1, __coreTelemetry: [], location: { pathname: '/specs' }, addEventListener() {}, dispatchEvent() {}, visualViewport: { addEventListener() {} } };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent { detail: unknown; constructor(_type: string, init: { detail?: unknown } = {}) { this.detail = init.detail; } };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: FakeElement) => ({ display: node.style.display || 'block', color: node.style.color || '', textShadow: node.style.textShadow || '', paddingTop: node.style.paddingTop || '0px', paddingBottom: node.style.paddingBottom || '0px', borderTopColor: '', getPropertyValue: (name: string) => node.style.getPropertyValue(name) });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => { callback(performance.now()); return 0; };
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
  (globalThis as unknown as { SVGSVGElement: unknown }).SVGSVGElement = class SVGSVGElement {};
  (globalThis as unknown as { SVGPathElement: unknown }).SVGPathElement = class SVGPathElement {};
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem(key: string) { return storage.get(key) ?? null; }, setItem(key: string, value: string) { storage.set(key, String(value)); }, removeItem(key: string) { storage.delete(key); } };
}

function resetRuntimeState(): void {
  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 12, y: 24, scale: 0.9 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.threadId = 'thread-card-a';
  state.renderedThreadId = 'thread-card-a';
  state.threadPanelOpen = true;
  state.activeTool = 'select';
  state.telemetry = [];
  state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 10, y: 20, w: 240, h: 180, comment: { contentFile: '.decision-os/cards/specs/card-a.md' } }],
    annotations: [], relationships: [],
    notes: { 'thread-card-a': [{ id: 'note-1', role: 'operator', message: 'Initial' }] },
    deletedNoteIds: { 'thread-card-a': [] },
    threadFiles: { 'thread-card-a': '.decision-os/threads/specs/thread-card-a.md' }
  };
  state.ledgerReconciliation = { routeEpoch: 1, routeLedgerStateId: 'specs', nextRequestSequence: 1, lastAppliedServerRevision: -1, lastAppliedSequence: 0, localGeometryRevisions: {}, failedLoadCount: 0, lastFailedLoad: null };
  state.ledgerContentRefresh = { inFlight: false, ledgerReasons: [], changedContentFiles: [], threadReasons: [], threadScope: null };
  state.pendingLedgerContentRefresh = false;
  state.pendingThreadContentRefresh = false;
}

function revisionResponse(ledger: Record<string, unknown>, revision: number): Response {
  return new Response(JSON.stringify(ledger), { status: 200, headers: { 'content-type': 'application/json', 'x-decision-os-ledger-revision': String(revision) } });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 5)); }
  assert.fail('Timed out waiting for refresh state.');
}

class FakeEventSource {
  static latest: FakeEventSource | null = null;
  readonly listeners = new Map<string, Listener[]>();
  onerror: (() => void) | null = null;
  constructor(readonly url: string) { FakeEventSource.latest = this; }
  addEventListener(type: string, listener: Listener): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  emit(type: string, payload: Record<string, unknown>): void {
    const event = { data: JSON.stringify(payload) } as MessageEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event as unknown as Event);
  }
  close(): void {}
}

test('voice recording defers scoped thread and ledger refresh work in one queue', async () => {
  installRuntimeDom();
  resetRuntimeState();
  const { requestLedgerContentRefresh, requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  state.voice.recording = true;
  const scope = { ledgerId: 'specs', threadId: 'thread-card-a', contentFile: '.decision-os/threads/specs/thread-card-a.md' };

  requestLedgerContentRefresh('card-content-change', { contentFile: '.decision-os/cards/specs/card-a.md' });
  requestThreadContentRefresh('thread-content-change', scope);

  assert.equal(state.pendingLedgerContentRefresh, true);
  assert.equal(state.pendingThreadContentRefresh, true);
  assert.deepEqual(state.ledgerContentRefresh.ledgerReasons, ['card-content-change']);
  assert.deepEqual(state.ledgerContentRefresh.changedContentFiles, ['.decision-os/cards/specs/card-a.md']);
  assert.deepEqual(state.ledgerContentRefresh.threadReasons, ['thread-content-change']);
  assert.deepEqual(state.ledgerContentRefresh.threadScope, scope);
  assert.equal(state.ledgerContentRefresh.inFlight, false);
  state.voice.recording = false;
  state.ledgerContentRefresh = { inFlight: false, ledgerReasons: [], changedContentFiles: [], threadReasons: [], threadScope: null };
  state.pendingLedgerContentRefresh = false;
  state.pendingThreadContentRefresh = false;
});

test('scoped thread refresh mutates only notes while preserving canvas, selection, pointer, and actions', async () => {
  installRuntimeDom();
  resetRuntimeState();
  const canvasSentinel = fakeElement({ cardId: 'sentinel' }, 'article');
  const actions = fakeElement({}, 'div');
  actions.className = 'thread-actions';
  runtimeDom.content.insertBefore(canvasSentinel, runtimeDom.marquee);
  runtimeDom.threadHeading.append(actions);
  const ledgerIdentity = state.activeLedger;
  const pointerIdentity = { intent: 'drag', selectionSnapshot: { cardIds: ['card-a'], zoneIds: [], groupIds: [], targetKind: 'card', targetId: 'card-a', ledgerStateId: 'specs' } };
  state.pointer = pointerIdentity;
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return revisionResponse({
      ...structuredClone(state.activeLedger),
      notes: { 'thread-card-a': [{ id: 'note-2', role: 'agent', message: 'Lifecycle result' }] }
    }, 2);
  }) as typeof fetch;
  const { requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  requestThreadContentRefresh('thread-content-change', { ledgerId: 'specs', threadId: 'thread-card-a', contentFile: '.decision-os/threads/specs/thread-card-a.md' });
  await waitFor(() => fetchCount === 1 && !state.ledgerContentRefresh.inFlight);

  assert.equal(state.activeLedger, ledgerIdentity);
  assert.equal(state.pointer, pointerIdentity);
  assert.deepEqual(state.selection.cardIds, ['card-a']);
  assert.deepEqual(state.viewport, { x: 12, y: 24, scale: 0.9 });
  assert.equal(runtimeDom.content.querySelector('[data-card-id="sentinel"]'), canvasSentinel);
  assert.equal(runtimeDom.threadHeading.querySelector('.thread-actions'), actions);
  assert.deepEqual(state.activeLedger.notes['thread-card-a'], [{ id: 'note-2', role: 'agent', message: 'Lifecycle result' }]);
});

test('inactive SSE scopes are no-ops and a lifecycle thread event updates notes only', async () => {
  installRuntimeDom();
  resetRuntimeState();
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  const canvasSentinel = fakeElement({ cardId: 'sentinel' }, 'article');
  const actions = fakeElement({}, 'div');
  actions.className = 'thread-actions';
  runtimeDom.content.insertBefore(canvasSentinel, runtimeDom.marquee);
  runtimeDom.threadHeading.append(actions);
  const ledgerIdentity = state.activeLedger;
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return revisionResponse({
      ...structuredClone(state.activeLedger),
      notes: { 'thread-card-a': [{ id: 'codex-event', role: 'agent', message: 'Run started', codexKind: 'agent_message' }] }
    }, 3);
  }) as typeof fetch;
  const { subscribeLedgerContentEvents } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  subscribeLedgerContentEvents();
  const events = FakeEventSource.latest as FakeEventSource;
  assert.equal(events.url, '/api/ledger-content-events');

  events.emit('card-content-change', { kind: 'card-content', ledgerId: 'data', contentFile: '.decision-os/cards/data/card-a.md' });
  events.emit('card-content-change', { kind: 'thread-content', ledgerId: 'specs', threadId: 'thread-card-b', contentFile: '.decision-os/threads/specs/thread-card-b.md' });
  events.emit('card-content-change', { kind: 'thread-content', ledgerId: 'data', threadId: 'thread-card-a', contentFile: '.decision-os/threads/specs/thread-card-a.md' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchCount, 0);
  assert.equal(state.activeLedger, ledgerIdentity);
  assert.equal(runtimeDom.content.querySelector('[data-card-id="sentinel"]'), canvasSentinel);
  assert.equal(runtimeDom.threadHeading.querySelector('.thread-actions'), actions);

  events.emit('card-content-change', {
    kind: 'thread-content', reason: 'codex-thread-started', ledgerId: 'specs', threadId: 'thread-card-a',
    contentFile: '.decision-os/threads/specs/thread-card-a.md', runId: 'codex-skill-1-test'
  });
  await waitFor(() => fetchCount === 1 && !state.ledgerContentRefresh.inFlight);
  assert.equal(state.activeLedger, ledgerIdentity);
  assert.equal(runtimeDom.content.querySelector('[data-card-id="sentinel"]'), canvasSentinel);
  assert.equal(runtimeDom.threadHeading.querySelector('.thread-actions'), actions);
  assert.equal(state.activeLedger.notes['thread-card-a'][0].id, 'codex-event');
});

test('events received during an in-flight ledger load drain the latest state and every changed card file', async () => {
  installRuntimeDom();
  resetRuntimeState();
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.activeLedger.cards.push({ id: 'card-b', title: 'Card B', x: 400, y: 20, w: 240, h: 190, comment: { contentFile: '.decision-os/cards/specs/card-b.md' } });
  const serverLedger = structuredClone(state.activeLedger);
  let revision = 0;
  let getCount = 0;
  let resolveFirstGet!: (response: Response) => void;
  let markFirstGetStarted!: () => void;
  const firstGetStarted = new Promise<void>((resolve) => { markFirstGetStarted = resolve; });
  const patchBodies: Array<Record<string, any>> = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body ?? '{}'));
      patchBodies.push(body);
      for (const [cardId, geometry] of Object.entries(body.geometry.cards ?? {}) as Array<[string, Record<string, number>]>) {
        const card = serverLedger.cards.find((entry: Record<string, unknown>) => entry.id === cardId) as Record<string, unknown>;
        Object.assign(card, { x: geometry.x, y: geometry.y, w: geometry.width, h: geometry.height });
      }
      revision += 1;
      return revisionResponse(serverLedger, revision);
    }
    getCount += 1;
    if (getCount === 1) {
      markFirstGetStarted();
      return new Promise<Response>((resolve) => { resolveFirstGet = resolve; });
    }
    if (getCount === 2) {
      serverLedger.cards[0].title = 'Latest Card A';
      serverLedger.cards[1].title = 'Latest Card B';
      serverLedger.notes['thread-card-a'] = [{ id: 'note-before-thread-drain', role: 'agent', message: 'Ledger pass' }];
    } else {
      serverLedger.notes['thread-card-a'] = [{ id: 'note-after-thread-drain', role: 'agent', message: 'Latest queued note' }];
    }
    revision += 1;
    return revisionResponse(serverLedger, revision);
  }) as typeof fetch;
  const { requestLedgerContentRefresh, requestThreadContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');

  requestLedgerContentRefresh('card-content-change-a', { contentFile: '.decision-os/cards/specs/card-a.md' });
  await firstGetStarted;
  requestLedgerContentRefresh('card-content-change-b', { contentFile: '/.decision-os/cards/specs/card-b.md' });
  requestLedgerContentRefresh('ledger-content-change');
  requestThreadContentRefresh('thread-content-change', {
    ledgerId: 'specs',
    threadId: 'thread-card-a',
    contentFile: '.decision-os/threads/specs/thread-card-a.md'
  });
  assert.deepEqual(state.ledgerContentRefresh.changedContentFiles, ['.decision-os/cards/specs/card-b.md']);
  revision = 1;
  resolveFirstGet(revisionResponse(serverLedger, revision));

  await waitFor(() => getCount === 3 && patchBodies.length === 2 && !state.ledgerContentRefresh.inFlight);
  assert.deepEqual(patchBodies.map((body) => Object.keys(body.geometry.cards)), [['card-a'], ['card-b']]);
  assert.equal(state.activeLedger.cards.find((card: Record<string, unknown>) => card.id === 'card-a').title, 'Latest Card A');
  assert.equal(state.activeLedger.cards.find((card: Record<string, unknown>) => card.id === 'card-b').title, 'Latest Card B');
  assert.deepEqual(state.activeLedger.notes['thread-card-a'], [{ id: 'note-after-thread-drain', role: 'agent', message: 'Latest queued note' }]);
  assert.deepEqual(state.ledgerContentRefresh.changedContentFiles, []);
  assert.deepEqual(state.ledgerContentRefresh.ledgerReasons, []);
  assert.deepEqual(state.ledgerContentRefresh.threadReasons, []);
  assert.equal(state.pendingLedgerContentRefresh, false);
  assert.equal(state.pendingThreadContentRefresh, false);
  const resizeTraces = state.telemetry.filter((trace: Record<string, unknown>) => trace.name === 'ledger-content-refresh-resize');
  assert.deepEqual(resizeTraces.map((trace: Record<string, any>) => trace.args.cardId), ['card-a', 'card-b']);
  assert.equal(state.telemetry.filter((trace: Record<string, unknown>) => trace.name === 'thread-content-refresh').length, 1);
});

test('changedCardIdForContentFile resolves only the hydrated card owner', async () => {
  installRuntimeDom();
  resetRuntimeState();
  const { changedCardIdForContentFile } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  state.activeLedger.cards.push({ id: 'card-b', comment: { contentFile: '.decision-os/cards/specs/card-b.md' } });
  assert.equal(changedCardIdForContentFile('/.decision-os/cards/specs/card-b.md'), 'card-b');
  assert.equal(changedCardIdForContentFile('.decision-os/cards/specs/missing.md'), '');
});
