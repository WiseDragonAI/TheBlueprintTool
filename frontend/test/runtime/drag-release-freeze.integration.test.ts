/**
 * WHAT: Regression coverage for card drag release while the geometry commit is still in flight.
 * WHY: Releasing the pointer must freeze the card at the release coordinate, not at a later cursor move.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type FakeElement = {
  tagName: string;
  id: string;
  className: string;
  dataset: Record<string, string>;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    minHeight: string;
    display: string;
    transition: string;
    transform: string;
    visibility: string;
    color: string;
    textShadow: string;
    setProperty(name: string, value: string): void;
    getPropertyValue(name: string): string;
    removeProperty(name: string): void;
  };
  hidden: boolean;
  textContent: string;
  innerHTML: string;
  type: string;
  title: string;
  ariaLabel: string;
  value: string;
  disabled: boolean;
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientWidth: number;
  clientHeight: number;
  childElementCount: number;
  children: FakeElement[];
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  parentElement: FakeElement | null;
  isConnected: boolean;
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
  addEventListener(): void;
  removeEventListener(): void;
  blur(): void;
  scrollTo(options?: unknown): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
};

type RuntimeDom = {
  root: FakeElement;
  canvas: FakeElement;
  content: FakeElement;
  controlOverlay: FakeElement;
  mediaOverlay: FakeElement;
  telemetryList: FakeElement;
  marquee: FakeElement;
  panel: FakeElement;
  threadPanel: FakeElement;
  shell: FakeElement;
  threadTarget: FakeElement;
  threadHeading: FakeElement;
  tabs: FakeElement;
  topbarTitle: FakeElement;
  kicker: FakeElement;
};

const runtimeDom = createRuntimeDom();

function fakeElement(dataset: Record<string, string> = {}, tagName = 'div'): FakeElement {
  const customProperties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const style = {
    left: '0px',
    top: '0px',
    width: '120px',
    height: '80px',
    minHeight: '',
    display: '',
    transition: '',
    transform: '',
    visibility: '',
    color: '',
    textShadow: '',
    setProperty(name: string, value: string) {
      customProperties.set(name, value);
    },
    getPropertyValue(name: string) {
      return customProperties.get(name) ?? '';
    },
    removeProperty(name: string) {
      customProperties.delete(name);
    }
  };
  const element: FakeElement = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    dataset,
    style,
    hidden: false,
    textContent: '',
    innerHTML: '',
    type: '',
    title: '',
    ariaLabel: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientWidth: 120,
    clientHeight: 80,
    children: [],
    parentElement: null,
    isConnected: true,
    get childElementCount() { return element.children.length; },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    classList: {
      toggle(name: string, force?: boolean) {
        const classes = classSet(element);
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
        return shouldAdd;
      },
      add(...names: string[]) {
        const classes = classSet(element);
        for (const name of names) classes.add(name);
        element.className = [...classes].join(' ');
      },
      remove(...names: string[]) {
        const classes = classSet(element);
        for (const name of names) classes.delete(name);
        element.className = [...classes].join(' ');
      },
      contains(name: string) {
        return classSet(element).has(name);
      }
    },
    querySelector(selector: string) {
      return element.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector: string) {
      return queryAll(element, selector);
    },
    matches(selector: string) {
      return matchesSelectorList(element, selector);
    },
    closest(selector: string) {
      let current: FakeElement | null = element;
      while (current) {
        if (matchesSelectorList(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    append(...nodes: FakeElement[]) {
      for (const node of nodes) appendChildElement(element, node);
    },
    appendChild(node: FakeElement) {
      appendChildElement(element, node);
      return node;
    },
    insertBefore(node: FakeElement, before: FakeElement | null) {
      detach(node);
      const index = before ? element.children.indexOf(before) : -1;
      if (index >= 0) element.children.splice(index, 0, node);
      else element.children.push(node);
      node.parentElement = element;
      markConnected(node, true);
    },
    replaceChildren(...nodes: FakeElement[]) {
      for (const child of element.children) {
        child.parentElement = null;
        markConnected(child, false);
      }
      element.children = [];
      element.append(...nodes);
    },
    remove() {
      detach(element);
      markConnected(element, false);
    },
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
    addEventListener() {},
    removeEventListener() {},
    blur() {},
    scrollTo(options?: unknown) {
      const scroll = options as { left?: number; top?: number } | undefined;
      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
    },
    getBoundingClientRect() {
      return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
    }
  };
  return element;
}

function createRuntimeDom(): RuntimeDom {
  const root = fakeElement({}, 'document');
  const canvas = fakeElement({}, 'div');
  const content = fakeElement({}, 'div');
  const controlOverlay = fakeElement({}, 'div');
  const mediaOverlay = fakeElement({}, 'div');
  const telemetryList = fakeElement({}, 'ol');
  const marquee = fakeElement({}, 'div');
  const panel = fakeElement({}, 'aside');
  const threadPanel = fakeElement({}, 'aside');
  const shell = fakeElement({}, 'div');
  const threadTarget = fakeElement({}, 'div');
  const threadHeading = fakeElement({}, 'div');
  const tabs = fakeElement({}, 'nav');
  const topbarTitle = fakeElement({}, 'button');
  const kicker = fakeElement({}, 'span');
  canvas.className = 'canvas';
  content.className = 'canvas-content';
  controlOverlay.className = 'canvas-control-overlay';
  mediaOverlay.className = 'canvas-media-overlay';
  telemetryList.className = 'telemetry-list';
  marquee.className = 'marquee';
  panel.className = 'panel';
  threadPanel.className = 'thread-panel';
  shell.className = 'shell';
  threadTarget.className = 'thread-target';
  threadHeading.className = 'thread-heading';
  tabs.className = 'tabs';
  topbarTitle.className = 'topbar-title-action';
  kicker.className = 'kicker';
  root.append(canvas, telemetryList, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker);
  canvas.append(content, controlOverlay, mediaOverlay);
  content.append(marquee);
  return { root, canvas, content, controlOverlay, mediaOverlay, telemetryList, marquee, panel, threadPanel, shell, threadTarget, threadHeading, tabs, topbarTitle, kicker };
}

function installRuntimeDom(): RuntimeDom {
  resetRuntimeDom();
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1000,
    innerHeight: 800,
    devicePixelRatio: 1,
    __coreTelemetry: [],
    location: { pathname: '/specs' },
    addEventListener() {},
    dispatchEvent() {},
    visualViewport: { addEventListener() {} }
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: FakeElement) => ({
    display: node.style.display || 'block',
    color: node.style.color || '',
    textShadow: node.style.textShadow || '',
    getPropertyValue: (name: string) => node.style.getPropertyValue(name)
  });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 0;
  };
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
  (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
  (globalThis as unknown as { SVGElement: unknown }).SVGElement = class SVGElement {};
  (globalThis as unknown as { SVGSVGElement: unknown }).SVGSVGElement = class SVGSVGElement {};
  (globalThis as unknown as { SVGPathElement: unknown }).SVGPathElement = class SVGPathElement {};
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
  const storage = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value));
    },
    removeItem(key: string) {
      storage.delete(key);
    }
  };
  (globalThis as unknown as { document: unknown }).document = {
    title: '',
    fonts: { ready: Promise.resolve() },
    activeElement: fakeElement(),
    querySelector(selector: string) {
      return runtimeDom.root.querySelector(selector);
    },
    querySelectorAll(selector: string) {
      return runtimeDom.root.querySelectorAll(selector);
    },
    createElement(tagName: string) {
      return fakeElement({}, tagName);
    },
    createTextNode(text: string) {
      const node = fakeElement({}, '#text');
      node.textContent = text;
      return node;
    },
    createElementNS(_namespace: string, tagName: string) {
      return fakeElement({}, tagName);
    }
  };
  return runtimeDom;
}

function resetRuntimeDom(): void {
  for (const element of Object.values(runtimeDom)) {
    element.children = [];
    element.parentElement = null;
    element.isConnected = true;
    element.hidden = false;
    element.textContent = '';
    element.innerHTML = '';
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.width = '120px';
    element.style.height = '80px';
    element.style.minHeight = '';
    element.style.display = '';
    element.style.transition = '';
    element.style.transform = '';
    element.style.visibility = '';
  }
  runtimeDom.canvas.className = 'canvas';
  runtimeDom.canvas.style.width = '1000px';
  runtimeDom.canvas.style.height = '800px';
  runtimeDom.content.className = 'canvas-content';
  runtimeDom.controlOverlay.className = 'canvas-control-overlay';
  runtimeDom.mediaOverlay.className = 'canvas-media-overlay';
  runtimeDom.telemetryList.className = 'telemetry-list';
  runtimeDom.marquee.className = 'marquee';
  runtimeDom.marquee.hidden = true;
  runtimeDom.panel.className = 'panel';
  runtimeDom.threadPanel.className = 'thread-panel';
  runtimeDom.shell.className = 'shell';
  runtimeDom.threadTarget.className = 'thread-target';
  runtimeDom.threadHeading.className = 'thread-heading';
  runtimeDom.tabs.className = 'tabs';
  runtimeDom.topbarTitle.className = 'topbar-title-action';
  runtimeDom.kicker.className = 'kicker';
  runtimeDom.root.append(runtimeDom.canvas, runtimeDom.telemetryList, runtimeDom.panel, runtimeDom.threadPanel, runtimeDom.shell, runtimeDom.threadTarget, runtimeDom.threadHeading, runtimeDom.tabs, runtimeDom.topbarTitle, runtimeDom.kicker);
  runtimeDom.canvas.append(runtimeDom.content, runtimeDom.controlOverlay, runtimeDom.mediaOverlay);
  runtimeDom.content.append(runtimeDom.marquee);
}

function classSet(element: FakeElement): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

function appendChildElement(parent: FakeElement, child: FakeElement): void {
  detach(child);
  parent.children.push(child);
  child.parentElement = parent;
  markConnected(child, true);
}

function detach(element: FakeElement): void {
  const parent = element.parentElement;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== element);
  element.parentElement = null;
}

function markConnected(element: FakeElement, connected: boolean): void {
  element.isConnected = connected;
  for (const child of element.children) markConnected(child, connected);
}

function dataKey(attribute: string): string {
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function descendants(element: FakeElement): FakeElement[] {
  return element.children.flatMap((child) => [child, ...descendants(child)]);
}

function queryAll(root: FakeElement, selector: string): FakeElement[] {
  const matches: FakeElement[] = [];
  const seen = new Set<FakeElement>();
  for (const rawPart of selector.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const direct = part.startsWith(':scope > ');
    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
    const candidates = direct ? root.children : descendants(root);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      if (matchesSelector(candidate, normalized)) {
        seen.add(candidate);
        matches.push(candidate);
      }
    }
  }
  return matches;
}

function matchesSelectorList(element: FakeElement, selector: string): boolean {
  return selector.split(',').some((part) => matchesSelector(element, part.trim()));
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  if (!selector) return false;
  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
  remaining = remaining.replace(/:not\([^)]+\)/g, '');
  if (notMatches.some((notSelector) => matchesSelector(element, notSelector))) return false;

  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;
  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');

  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  const classes = classSet(element);
  if (classMatches.some((className) => !classes.has(className))) return false;
  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');

  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
  for (const [, attribute, expected] of attributeMatches) {
    const actual = attribute.startsWith('data-') ? element.dataset[dataKey(attribute.slice(5))] : element.getAttribute(attribute);
    if (expected === undefined) {
      if (actual === undefined || actual === null) return false;
    } else if (actual !== expected) return false;
  }
  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();

  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
  return true;
}

function pointerEvent(input: { target?: FakeElement; clientX: number; clientY: number; pointerId?: number; shiftKey?: boolean; ctrlKey?: boolean; button?: number; buttons?: number }): PointerEvent {
  return {
    target: input.target ?? runtimeDom.canvas,
    clientX: input.clientX,
    clientY: input.clientY,
    pointerId: input.pointerId ?? 1,
    shiftKey: input.shiftKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    button: input.button ?? 0,
    buttons: input.buttons ?? 1,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as PointerEvent;
}

function appendLedgerCard(id: string, x: number, y: number, width = 240, height = 132): FakeElement {
  const card = fakeElement({ cardId: id }, 'article');
  card.className = 'card ledger-node';
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.style.width = `${width}px`;
  card.style.height = `${height}px`;
  runtimeDom.content.insertBefore(card, runtimeDom.marquee);
  return card;
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

function responseWithRevision(ledger: Record<string, unknown>, revision: number): Response {
  return new Response(JSON.stringify(ledger), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-decision-os-ledger-revision': String(revision)
    }
  });
}

function resetReconciliation(runtimeState: Record<string, any>): void {
  runtimeState.ledgerReconciliation = {
    routeEpoch: 1,
    routeLedgerStateId: 'specs',
    nextRequestSequence: 1,
    lastAppliedServerRevision: -1,
    lastAppliedSequence: 0,
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null
  };
}

test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
  const { canvas, content } = installRuntimeDom();
  const card = appendLedgerCard('card-a', 20, 20, 120, 80);
  card.style.left = '20px';
  card.style.top = '20px';
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });

  const calls: RequestInit[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Promise(() => {});
  };

  const { state } = await import('../../src/runtime/state.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');

  state.activeTab = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.activeLedger = { cards: [{ id: 'card-a', x: 20, y: 20, w: 120, h: 80 }], annotations: [], relationships: [], notes: {} };
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = {
    intent: 'drag',
    targetKind: 'card',
    targetId: 'card-a',
    target: card,
    resizeHandle: null,
    start: { x: 0, y: 0 },
    current: { x: 10, y: 0 },
    startCanvas: { x: 0, y: 0 },
    currentCanvas: { x: 10, y: 0 },
    startedAt: 0
  };

  void handlePointerUp({ clientX: 15, clientY: 0, pointerId: 7, preventDefault() {} } as unknown as PointerEvent);

  assert.equal(state.pointer, null);
  assert.equal(card.offsetLeft, 25);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);

  handlePointerMove({ clientX: 200, clientY: 0, preventDefault() {} } as unknown as PointerEvent);

  assert.equal(card.offsetLeft, 25);
  assert.equal(JSON.parse(String(calls[0].body)).geometry.cards['card-a'].x, 25);
  assert.ok(content.childElementCount >= 1);
});

test('active card drag keeps its private pointer snapshot while reconciliation preserves newer visible selection', async () => {
  installRuntimeDom();
  const cardA = appendLedgerCard('card-a', 20, 20);
  const cardB = appendLedgerCard('card-b', 200, 20);
  const patchBodies: Array<Record<string, any>> = [];

  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'A', x: 20, y: 20, w: 240, h: 132 },
      { id: 'card-b', title: 'B', x: 200, y: 20, w: 240, h: 132 }
    ],
    annotations: [],
    relationships: [],
    notes: {}
  };

  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    assert.equal(url, '/decision-os/specs');
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body ?? '{}'));
      patchBodies.push(body);
      return {
        ok: true,
        async json() {
          return structuredClone(state.activeLedger);
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          cards: [
            { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
            { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 }
          ],
          annotations: [],
          relationships: [],
          notes: {}
        };
      }
    };
  };

  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);

  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
  await loadActiveLedgerState();

  assert.deepEqual(state.selection.cardIds, ['card-b']);
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a']);
  assert.equal(cardA.classList.contains('selected'), false);
  assert.equal(cardB.classList.contains('selected'), true);

  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
  state.selection = { cardIds: ['card-b'], zoneIds: [], groupIds: [] };
  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));

  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 80);
  assert.equal(patchBodies[0].geometry.cards['card-b'], undefined);

  handlePointerDown(pointerEvent({ target: cardB, clientX: 210, clientY: 30 }));
  assert.equal(state.pointer.targetId, 'card-b');
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-b']);
  await handlePointerUp(pointerEvent({ target: cardB, clientX: 210, clientY: 30 }));
  assert.deepEqual(state.selection.cardIds, ['card-b']);
});

test('multi-selection drag commits its pointer snapshot without replacing newer visible selection', async () => {
  installRuntimeDom();
  const cardA = appendLedgerCard('card-a', 10, 10);
  appendLedgerCard('card-b', 100, 10);
  appendLedgerCard('card-c', 300, 10);
  const patchBodies: Array<Record<string, any>> = [];
  let resolveLoad!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const loadStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
      assert.equal(url, '/decision-os/specs');
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body ?? '{}'));
        patchBodies.push(body);
        return {
          ok: true,
          async json() {
            return structuredClone(state.activeLedger);
          }
        };
      }
      resolveStarted();
      return new Promise((resolve) => {
        resolveLoad = resolve;
      });
    };
  });

  const { state } = await import('../../src/runtime/state.js');
  const { requestLedgerContentRefresh } = await import('../../src/runtime/refresh/effect/subscribe-ledger-content-events.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: ['card-a', 'card-b'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [
      { id: 'card-a', title: 'A', x: 10, y: 10, w: 240, h: 132 },
      { id: 'card-b', title: 'B', x: 100, y: 10, w: 240, h: 132 },
      { id: 'card-c', title: 'C', x: 300, y: 10, w: 240, h: 132 }
    ],
    annotations: [],
    relationships: [],
    notes: {}
  };

  handlePointerDown(pointerEvent({ target: cardA, clientX: 0, clientY: 0 }));
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a', 'card-b']);

  handlePointerMove(pointerEvent({ target: cardA, clientX: 30, clientY: 0 }));
  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
  requestLedgerContentRefresh('card-content-change');
  await loadStarted;
  resolveLoad({
    ok: true,
    async json() {
      return {
        cards: [
          { id: 'card-a', title: 'Server A', x: 1, y: 2, w: 220, h: 132 },
          { id: 'card-b', title: 'Server B', x: 3, y: 4, w: 220, h: 132 },
          { id: 'card-c', title: 'Server C', x: 5, y: 6, w: 220, h: 132 }
        ],
        annotations: [],
        relationships: [],
        notes: {}
      };
    }
  });
  await flushAsync();

  assert.deepEqual(state.selection.cardIds, ['card-c']);
  assert.deepEqual(state.pointer.selectionSnapshot.cardIds, ['card-a', 'card-b']);
  handlePointerMove(pointerEvent({ target: cardA, clientX: 50, clientY: 0 }));
  state.selection = { cardIds: ['card-c'], zoneIds: [], groupIds: [] };
  await handlePointerUp(pointerEvent({ target: cardA, clientX: 60, clientY: 0 }));

  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a', 'card-b']);
  assert.equal(patchBodies[0].geometry.cards['card-a'].x, 70);
  assert.equal(patchBodies[0].geometry.cards['card-b'].x, 160);
  assert.equal(patchBodies[0].geometry.cards['card-c'], undefined);
});

test('card resize resolves the current remounted node and commits pointer target geometry', async () => {
  installRuntimeDom();
  const originalCard = appendLedgerCard('card-a', 40, 50, 240, 150);
  const resizeHandle = fakeElement({}, 'div');
  resizeHandle.className = 'resize-handle se';
  originalCard.append(resizeHandle);
  const patchBodies: Array<Record<string, any>> = [];

  const { state } = await import('../../src/runtime/state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'A', x: 40, y: 50, w: 240, h: 150 }],
    annotations: [],
    relationships: [],
    notes: {}
  };

  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    assert.equal(url, '/decision-os/specs');
    const body = JSON.parse(String(init?.body ?? '{}'));
    patchBodies.push(body);
    return {
      ok: true,
      async json() {
        return structuredClone(state.activeLedger);
      }
    };
  };

  handlePointerDown(pointerEvent({ target: resizeHandle, clientX: 0, clientY: 0 }));
  originalCard.remove();
  const remountedCard = appendLedgerCard('card-a', 40, 50, 240, 150);

  handlePointerMove(pointerEvent({ target: remountedCard, clientX: 40, clientY: 20 }));
  await handlePointerUp(pointerEvent({ target: remountedCard, clientX: 40, clientY: 20 }));

  assert.equal(originalCard.style.width, '240px');
  assert.equal(remountedCard.style.width, '280px');
  assert.equal(remountedCard.style.height, '170px');
  assert.deepEqual(Object.keys(patchBodies[0].geometry.cards), ['card-a']);
  assert.equal(patchBodies[0].geometry.cards['card-a'].width, 280);
  assert.equal(patchBodies[0].geometry.cards['card-a'].height, 170);
});

test('a drag PATCH wins when an older pre-drag GET resolves last', async () => {
  installRuntimeDom();
  const card = appendLedgerCard('card-a', 20, 30, 240, 150);
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 20, y: 30, w: 240, h: 150 }],
    annotations: [], relationships: [], notes: {}
  };
  resetReconciliation(state);

  const staleLedger = structuredClone(state.activeLedger);
  const durableLedger = structuredClone(state.activeLedger);
  const submitted: Array<Record<string, any>> = [];
  let resolveOldGet!: (response: Response) => void;
  let markGetStarted!: () => void;
  const getStarted = new Promise<void>((resolve) => { markGetStarted = resolve; });
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (!init?.method) {
      markGetStarted();
      return new Promise<Response>((resolve) => { resolveOldGet = resolve; });
    }
    const body = JSON.parse(String(init.body ?? '{}'));
    submitted.push(body);
    Object.assign(durableLedger.cards[0], {
      x: body.geometry.cards['card-a'].x,
      y: body.geometry.cards['card-a'].y,
      w: body.geometry.cards['card-a'].width,
      h: body.geometry.cards['card-a'].height
    });
    return responseWithRevision(durableLedger, 2);
  }) as typeof fetch;

  const oldLoad = loadActiveLedgerState();
  await getStarted;
  handlePointerDown(pointerEvent({ target: card, clientX: 0, clientY: 0 }));
  handlePointerMove(pointerEvent({ target: card, clientX: 35, clientY: 10 }));
  await handlePointerUp(pointerEvent({ target: card, clientX: 35, clientY: 10 }));

  const patch = submitted[0].geometry.cards['card-a'];
  assert.deepEqual(patch, { x: 55, y: 40, width: 240, height: 150 });
  assert.deepEqual(
    { x: state.activeLedger.cards[0].x, y: state.activeLedger.cards[0].y, width: state.activeLedger.cards[0].w, height: state.activeLedger.cards[0].h },
    patch
  );
  const renderedBeforeStaleGet = runtimeDom.content.querySelector('[data-card-id="card-a"]') as FakeElement;
  assert.deepEqual(
    { x: renderedBeforeStaleGet.offsetLeft, y: renderedBeforeStaleGet.offsetTop, width: renderedBeforeStaleGet.offsetWidth, height: renderedBeforeStaleGet.offsetHeight },
    patch
  );

  resolveOldGet(responseWithRevision(staleLedger, 1));
  assert.equal(await oldLoad, false);
  assert.deepEqual(
    { x: state.activeLedger.cards[0].x, y: state.activeLedger.cards[0].y, width: state.activeLedger.cards[0].w, height: state.activeLedger.cards[0].h },
    patch
  );
  assert.deepEqual(
    { x: durableLedger.cards[0].x, y: durableLedger.cards[0].y, width: durableLedger.cards[0].w, height: durableLedger.cards[0].h },
    patch
  );
  assert.equal(state.pointer, null);
  assert.equal(state.ledgerReconciliation.lastAppliedServerRevision, 2);
});

test('a resize PATCH wins when an older pre-resize GET resolves last', async () => {
  installRuntimeDom();
  const card = appendLedgerCard('card-a', 40, 50, 240, 150);
  const handle = fakeElement({}, 'div');
  handle.className = 'resize-handle se';
  card.append(handle);
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 40, y: 50, w: 240, h: 150 }],
    annotations: [], relationships: [], notes: {}
  };
  resetReconciliation(state);

  const staleLedger = structuredClone(state.activeLedger);
  const durableLedger = structuredClone(state.activeLedger);
  let submitted!: Record<string, any>;
  let resolveOldGet!: (response: Response) => void;
  let markGetStarted!: () => void;
  const getStarted = new Promise<void>((resolve) => { markGetStarted = resolve; });
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (!init?.method) {
      markGetStarted();
      return new Promise<Response>((resolve) => { resolveOldGet = resolve; });
    }
    submitted = JSON.parse(String(init.body ?? '{}'));
    const geometry = submitted.geometry.cards['card-a'];
    Object.assign(durableLedger.cards[0], { x: geometry.x, y: geometry.y, w: geometry.width, h: geometry.height });
    return responseWithRevision(durableLedger, 4);
  }) as typeof fetch;

  const oldLoad = loadActiveLedgerState();
  await getStarted;
  handlePointerDown(pointerEvent({ target: handle, clientX: 0, clientY: 0 }));
  handlePointerMove(pointerEvent({ target: card, clientX: 60, clientY: 35 }));
  await handlePointerUp(pointerEvent({ target: card, clientX: 60, clientY: 35 }));

  const patch = submitted.geometry.cards['card-a'];
  assert.deepEqual(patch, { x: 40, y: 50, width: 300, height: 185 });
  assert.deepEqual(
    { x: state.activeLedger.cards[0].x, y: state.activeLedger.cards[0].y, width: state.activeLedger.cards[0].w, height: state.activeLedger.cards[0].h },
    patch
  );
  const rendered = runtimeDom.content.querySelector('[data-card-id="card-a"]') as FakeElement;
  assert.equal(rendered.offsetWidth, 300);
  assert.equal(rendered.offsetHeight, 185);

  resolveOldGet(responseWithRevision(staleLedger, 3));
  assert.equal(await oldLoad, false);
  assert.equal(state.activeLedger.cards[0].w, 300);
  assert.equal(state.activeLedger.cards[0].h, 185);
  assert.equal(durableLedger.cards[0].w, 300);
  assert.equal(durableLedger.cards[0].h, 185);
  assert.equal(state.pointer, null);
  assert.equal(state.ledgerReconciliation.lastAppliedServerRevision, 4);
});

test('Ctrl+D patches runtime and rendered geometry before its request and rejects an older GET', async () => {
  installRuntimeDom();
  const card = appendLedgerCard('card-a', 70, 80, 240, 150);
  const detail = fakeElement({}, 'div');
  detail.className = 'ledger-card-detail-layer';
  detail.scrollHeight = 226;
  detail.style.height = '226px';
  card.append(detail);
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { resizeSelectedCardsController } = await import('../../src/runtime/card/controller/resize-selected-cards-controller.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 70, y: 80, w: 240, h: 150 }],
    annotations: [], relationships: [], notes: {}
  };
  resetReconciliation(state);

  const staleLedger = structuredClone(state.activeLedger);
  const durableLedger = structuredClone(state.activeLedger);
  let submitted!: Record<string, any>;
  let runtimeAtRequest!: Record<string, number>;
  let renderedAtRequest!: Record<string, number>;
  let resolveOldGet!: (response: Response) => void;
  let markGetStarted!: () => void;
  const getStarted = new Promise<void>((resolve) => { markGetStarted = resolve; });
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (!init?.method) {
      markGetStarted();
      return new Promise<Response>((resolve) => { resolveOldGet = resolve; });
    }
    submitted = JSON.parse(String(init.body ?? '{}'));
    const currentCard = runtimeDom.content.querySelector('[data-card-id="card-a"]') as FakeElement;
    runtimeAtRequest = {
      x: state.activeLedger.cards[0].x,
      y: state.activeLedger.cards[0].y,
      width: state.activeLedger.cards[0].w,
      height: state.activeLedger.cards[0].h
    };
    renderedAtRequest = {
      x: currentCard.offsetLeft,
      y: currentCard.offsetTop,
      width: currentCard.offsetWidth,
      height: currentCard.offsetHeight
    };
    const geometry = submitted.geometry.cards['card-a'];
    Object.assign(durableLedger.cards[0], { x: geometry.x, y: geometry.y, w: geometry.width, h: geometry.height });
    return responseWithRevision(durableLedger, 6);
  }) as typeof fetch;

  const oldLoad = loadActiveLedgerState();
  await getStarted;
  await resizeSelectedCardsController();
  const patch = submitted.geometry.cards['card-a'];
  assert.deepEqual(runtimeAtRequest, patch);
  assert.deepEqual(renderedAtRequest, patch);
  assert.equal(patch.height, 226);
  assert.ok(state.ledgerReconciliation.localGeometryRevisions['card:card-a'] > 0);

  resolveOldGet(responseWithRevision(staleLedger, 5));
  assert.equal(await oldLoad, false);
  assert.equal(state.activeLedger.cards[0].h, 226);
  assert.equal(durableLedger.cards[0].h, 226);
  assert.equal(state.ledgerReconciliation.lastAppliedServerRevision, 6);
});

test('a failed ledger load cannot interrupt an active drag or its later local commit', async () => {
  installRuntimeDom();
  const card = appendLedgerCard('card-a', 20, 30, 240, 150);
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 20, y: 30, w: 240, h: 150 }],
    annotations: [], relationships: [], notes: {}
  };
  resetReconciliation(state);
  globalThis.fetch = (async () => { throw new Error('network unavailable'); }) as typeof fetch;

  handlePointerDown(pointerEvent({ target: card, clientX: 0, clientY: 0 }));
  handlePointerMove(pointerEvent({ target: card, clientX: 20, clientY: 5 }));
  const pointerDuringFailure = state.pointer;
  const ledgerDuringFailure = state.activeLedger;
  assert.equal(await loadActiveLedgerState(), false);
  assert.equal(state.pointer, pointerDuringFailure);
  assert.equal(state.activeLedger, ledgerDuringFailure);
  assert.deepEqual(state.selection.cardIds, ['card-a']);

  handlePointerMove(pointerEvent({ target: card, clientX: 45, clientY: 15 }));
  await handlePointerUp(pointerEvent({ target: card, clientX: 45, clientY: 15 }));
  assert.equal(state.pointer, null);
  assert.equal(state.activeLedger.cards[0].x, 65);
  assert.equal(state.activeLedger.cards[0].y, 45);
  const rendered = runtimeDom.content.querySelector('[data-card-id="card-a"]') as FakeElement;
  assert.equal(rendered.offsetLeft, 65);
  assert.equal(rendered.offsetTop, 45);
  assert.ok(state.ledgerReconciliation.failedLoadCount >= 2);
});

test('a failed ledger load cannot interrupt an active resize or its later local commit', async () => {
  installRuntimeDom();
  const card = appendLedgerCard('card-a', 40, 50, 240, 150);
  const handle = fakeElement({}, 'div');
  handle.className = 'resize-handle se';
  card.append(handle);
  const { state } = await import('../../src/runtime/state.js');
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerDown } = await import('../../src/runtime/gesture/controller/handle-pointer-down.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTool = 'select';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = {
    cards: [{ id: 'card-a', title: 'Card A', x: 40, y: 50, w: 240, h: 150 }],
    annotations: [], relationships: [], notes: {}
  };
  resetReconciliation(state);
  globalThis.fetch = (async () => { throw new Error('network unavailable'); }) as typeof fetch;

  handlePointerDown(pointerEvent({ target: handle, clientX: 0, clientY: 0 }));
  handlePointerMove(pointerEvent({ target: card, clientX: 25, clientY: 15 }));
  const pointerDuringFailure = state.pointer;
  const ledgerDuringFailure = state.activeLedger;
  assert.equal(await loadActiveLedgerState(), false);
  assert.equal(state.pointer, pointerDuringFailure);
  assert.equal(state.activeLedger, ledgerDuringFailure);
  assert.deepEqual(state.selection.cardIds, ['card-a']);

  handlePointerMove(pointerEvent({ target: card, clientX: 55, clientY: 35 }));
  await handlePointerUp(pointerEvent({ target: card, clientX: 55, clientY: 35 }));
  assert.equal(state.pointer, null);
  assert.equal(state.activeLedger.cards[0].w, 295);
  assert.equal(state.activeLedger.cards[0].h, 185);
  const rendered = runtimeDom.content.querySelector('[data-card-id="card-a"]') as FakeElement;
  assert.equal(rendered.offsetWidth, 295);
  assert.equal(rendered.offsetHeight, 185);
  assert.ok(state.ledgerReconciliation.failedLoadCount >= 2);
});
