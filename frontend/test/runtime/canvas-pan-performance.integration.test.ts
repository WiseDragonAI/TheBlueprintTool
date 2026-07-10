/**
 * WHAT: Runtime tests for transform-only canvas pan performance.
 * WHY: Canvas pan should not pay scale/detail-mode or unsampled telemetry costs on every pointermove.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePointerIntent, ctrlPanOnlySpec } from '../../src/runtime/gesture/helper/derive-pointer-intent.js';
import { state } from '../../src/runtime/state.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

type CanvasFakeStyle = Record<string, string> & {
  setProperty(name: string, value: string): void;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
};

type CanvasFakeElement = {
  tagName: string;
  id: string;
  className: string;
  dataset: Record<string, string>;
  style: CanvasFakeStyle;
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
  children: CanvasFakeElement[];
  parentElement: CanvasFakeElement | null;
  isConnected: boolean;
  childElementCount: number;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  classList: { toggle(name: string, force?: boolean): boolean; add(...names: string[]): void; remove(...names: string[]): void; contains(name: string): boolean };
  querySelector(selector: string): CanvasFakeElement | null;
  querySelectorAll(selector: string): CanvasFakeElement[];
  matches(selector: string): boolean;
  closest(selector: string): CanvasFakeElement | null;
  append(...nodes: CanvasFakeElement[]): void;
  appendChild(node: CanvasFakeElement): CanvasFakeElement;
  insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null): void;
  replaceChildren(...nodes: CanvasFakeElement[]): void;
  remove(): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  addEventListener(): void;
  removeEventListener(): void;
  scrollTo(options?: unknown): void;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
};

const canvasStorage = new Map<string, string>();
const canvasDom = createCanvasRuntimeDom();

function canvasElement(dataset: Record<string, string> = {}, tagName = 'div'): CanvasFakeElement {
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
    right: '',
    bottom: '',
    maxWidth: '',
    position: '',
    zIndex: '',
    boxSizing: '',
    setProperty(name: string, value: string) {
      customProperties.set(name, value);
      style[name] = value;
    },
    getPropertyValue(name: string) {
      return customProperties.get(name) ?? style[name] ?? '';
    },
    removeProperty(name: string) {
      customProperties.delete(name);
      delete style[name];
    }
  } as unknown as CanvasFakeStyle;
  const element: CanvasFakeElement = {
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
        const classes = canvasClassSet(element);
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
        return shouldAdd;
      },
      add(...names: string[]) {
        const classes = canvasClassSet(element);
        for (const name of names) classes.add(name);
        element.className = [...classes].join(' ');
      },
      remove(...names: string[]) {
        const classes = canvasClassSet(element);
        for (const name of names) classes.delete(name);
        element.className = [...classes].join(' ');
      },
      contains(name: string) {
        return canvasClassSet(element).has(name);
      }
    },
    querySelector(selector: string) {
      return element.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector: string) {
      return canvasQueryAll(element, selector);
    },
    matches(selector: string) {
      return canvasMatchesSelectorList(element, selector);
    },
    closest(selector: string) {
      let current: CanvasFakeElement | null = element;
      while (current) {
        if (canvasMatchesSelectorList(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    append(...nodes: CanvasFakeElement[]) {
      for (const node of nodes) canvasAppendChild(element, node);
    },
    appendChild(node: CanvasFakeElement) {
      canvasAppendChild(element, node);
      return node;
    },
    insertBefore(node: CanvasFakeElement, before: CanvasFakeElement | null) {
      canvasDetach(node);
      const index = before ? element.children.indexOf(before) : -1;
      if (index >= 0) element.children.splice(index, 0, node);
      else element.children.push(node);
      node.parentElement = element;
      canvasMarkConnected(node, true);
    },
    replaceChildren(...nodes: CanvasFakeElement[]) {
      for (const child of element.children) {
        child.parentElement = null;
        canvasMarkConnected(child, false);
      }
      element.children = [];
      element.append(...nodes);
    },
    remove() {
      canvasDetach(element);
      canvasMarkConnected(element, false);
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name.startsWith('data-')) element.dataset[canvasDataKey(name.slice(5))] = value;
    },
    getAttribute(name: string) {
      if (name === 'id') return element.id || null;
      if (name === 'class') return element.className || null;
      if (name.startsWith('data-')) return element.dataset[canvasDataKey(name.slice(5))] ?? null;
      return attributes.get(name) ?? null;
    },
    hasAttribute(name: string) {
      if (name === 'id') return Boolean(element.id);
      if (name === 'class') return Boolean(element.className);
      if (name.startsWith('data-')) return element.dataset[canvasDataKey(name.slice(5))] !== undefined;
      return attributes.has(name);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
      if (name === 'id') element.id = '';
      if (name === 'class') element.className = '';
      if (name.startsWith('data-')) delete element.dataset[canvasDataKey(name.slice(5))];
    },
    addEventListener() {},
    removeEventListener() {},
    scrollTo(options?: unknown) {
      const scroll = options as { left?: number; top?: number } | undefined;
      if (Number.isFinite(scroll?.left)) element.scrollLeft = Number(scroll?.left);
      if (Number.isFinite(scroll?.top)) element.scrollTop = Number(scroll?.top);
    },
    getBoundingClientRect() {
      return {
        left: element.offsetLeft,
        top: element.offsetTop,
        right: element.offsetLeft + element.offsetWidth,
        bottom: element.offsetTop + element.offsetHeight,
        width: element.offsetWidth,
        height: element.offsetHeight
      };
    }
  };
  return element;
}

function createCanvasRuntimeDom() {
  const root = canvasElement({}, 'document');
  const canvas = canvasElement({}, 'div');
  const content = canvasElement({}, 'div');
  const controlOverlay = canvasElement({}, 'div');
  const mediaOverlay = canvasElement({}, 'div');
  const telemetryList = canvasElement({}, 'ol');
  const marquee = canvasElement({}, 'div');
  const panel = canvasElement({}, 'aside');
  const threadPanel = canvasElement({}, 'aside');
  const shell = canvasElement({}, 'div');
  const threadTarget = canvasElement({}, 'div');
  const threadHeading = canvasElement({}, 'div');
  const tabs = canvasElement({}, 'nav');
  const topbarTitle = canvasElement({}, 'button');
  const kicker = canvasElement({}, 'span');
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

function installCanvasRuntimeDom(): void {
  canvasStorage.clear();
  for (const element of Object.values(canvasDom)) {
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
  canvasDom.canvas.className = 'canvas';
  canvasDom.canvas.style.width = '1000px';
  canvasDom.canvas.style.height = '800px';
  canvasDom.content.className = 'canvas-content';
  canvasDom.controlOverlay.className = 'canvas-control-overlay';
  canvasDom.mediaOverlay.className = 'canvas-media-overlay';
  canvasDom.telemetryList.className = 'telemetry-list';
  canvasDom.marquee.className = 'marquee';
  canvasDom.marquee.hidden = true;
  canvasDom.panel.className = 'panel';
  canvasDom.threadPanel.className = 'thread-panel';
  canvasDom.shell.className = 'shell';
  canvasDom.threadTarget.className = 'thread-target';
  canvasDom.threadHeading.className = 'thread-heading';
  canvasDom.tabs.className = 'tabs';
  canvasDom.topbarTitle.className = 'topbar-title-action';
  canvasDom.kicker.className = 'kicker';
  canvasDom.root.append(canvasDom.canvas, canvasDom.telemetryList, canvasDom.panel, canvasDom.threadPanel, canvasDom.shell, canvasDom.threadTarget, canvasDom.threadHeading, canvasDom.tabs, canvasDom.topbarTitle, canvasDom.kicker);
  canvasDom.canvas.append(canvasDom.content, canvasDom.controlOverlay, canvasDom.mediaOverlay);
  canvasDom.content.append(canvasDom.marquee);

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
  (globalThis as unknown as { document: unknown }).document = {
    title: '',
    fonts: { ready: Promise.resolve() },
    activeElement: canvasElement(),
    querySelector(selector: string) {
      return canvasDom.root.querySelector(selector);
    },
    querySelectorAll(selector: string) {
      return canvasDom.root.querySelectorAll(selector);
    },
    createElement(tagName: string) {
      return canvasElement({}, tagName);
    },
    createTextNode(text: string) {
      const node = canvasElement({}, '#text');
      node.textContent = text;
      return node;
    },
    createElementNS(_namespace: string, tagName: string) {
      return canvasElement({}, tagName);
    }
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (node: CanvasFakeElement) => ({
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
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value.replace(/"/g, '\\"') };
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem(key: string) {
      return canvasStorage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      canvasStorage.set(key, String(value));
    },
    removeItem(key: string) {
      canvasStorage.delete(key);
    }
  };
}

function canvasClassSet(element: CanvasFakeElement): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

function canvasAppendChild(parent: CanvasFakeElement, child: CanvasFakeElement): void {
  canvasDetach(child);
  parent.children.push(child);
  child.parentElement = parent;
  canvasMarkConnected(child, true);
}

function canvasDetach(element: CanvasFakeElement): void {
  const parent = element.parentElement;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== element);
  element.parentElement = null;
}

function canvasMarkConnected(element: CanvasFakeElement, connected: boolean): void {
  element.isConnected = connected;
  for (const child of element.children) canvasMarkConnected(child, connected);
}

function canvasDataKey(attribute: string): string {
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function canvasDescendants(element: CanvasFakeElement): CanvasFakeElement[] {
  return element.children.flatMap((child) => [child, ...canvasDescendants(child)]);
}

function canvasQueryAll(rootElement: CanvasFakeElement, selector: string): CanvasFakeElement[] {
  const matches: CanvasFakeElement[] = [];
  const seen = new Set<CanvasFakeElement>();
  for (const rawPart of selector.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const direct = part.startsWith(':scope > ');
    const normalized = part.replace(/^:scope\s*>\s*/, '').trim();
    const candidates = direct ? rootElement.children : canvasDescendants(rootElement);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      if (canvasMatchesSelector(candidate, normalized)) {
        seen.add(candidate);
        matches.push(candidate);
      }
    }
  }
  return matches;
}

function canvasMatchesSelectorList(element: CanvasFakeElement, selector: string): boolean {
  return selector.split(',').some((part) => canvasMatchesSelector(element, part.trim()));
}

function canvasMatchesSelector(element: CanvasFakeElement, selector: string): boolean {
  if (!selector) return false;
  let remaining = selector.replace(/^:scope\s*>\s*/, '').replace(/:first-child/g, '').trim();
  const notMatches = [...remaining.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
  remaining = remaining.replace(/:not\([^)]+\)/g, '');
  if (notMatches.some((notSelector) => canvasMatchesSelector(element, notSelector))) return false;

  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;
  remaining = remaining.replace(/#[a-zA-Z0-9_-]+/g, '');

  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  const classes = canvasClassSet(element);
  if (classMatches.some((className) => !classes.has(className))) return false;
  remaining = remaining.replace(/\.[a-zA-Z0-9_-]+/g, '');

  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
  for (const [, attribute, expected] of attributeMatches) {
    const actual = attribute.startsWith('data-') ? element.dataset[canvasDataKey(attribute.slice(5))] : element.getAttribute(attribute);
    if (expected === undefined) {
      if (actual === undefined || actual === null) return false;
    } else if (actual !== expected) return false;
  }
  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();

  if (remaining && remaining !== '*' && element.tagName.toLowerCase() !== remaining.toLowerCase()) return false;
  return true;
}

function canvasPointerEvent(clientX: number, clientY: number, pointerId = 1): PointerEvent {
  return {
    target: canvasDom.canvas,
    clientX,
    clientY,
    pointerId,
    button: 0,
    buttons: 1,
    shiftKey: false,
    ctrlKey: false,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as PointerEvent;
}

function canvasWheelEvent(input: { clientX: number; clientY: number; deltaX?: number; deltaY: number; ctrlKey?: boolean }): WheelEvent {
  return {
    target: canvasDom.canvas,
    clientX: input.clientX,
    clientY: input.clientY,
    deltaX: input.deltaX ?? 0,
    deltaY: input.deltaY,
    ctrlKey: input.ctrlKey ?? false,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as WheelEvent;
}

async function waitForTimer(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function resetCanvasReconciliation(): void {
  state.ledgerReconciliation = {
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

test('canvas pan uses a transform-only path with sampled performance telemetry', () => {
  const pointerMove = source('frontend/src/runtime/gesture/controller/handle-pointer-move.ts');
  const panTransform = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const panTelemetry = source('frontend/src/runtime/gesture/effect/emit-pan-performance-telemetry.ts');
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const panningEffects = source('frontend/src/runtime/gesture/effect/schedule-panning-effects.ts');
  const finishPointer = source('frontend/src/runtime/gesture/effect/finish-pointer.ts');
  const pointHelper = source('frontend/src/runtime/gesture/helper/point.ts');
  const canvasCss = source('frontend/assets/canvas/canvas-layer.css');
  assert.match(pointerMove, /applyPanViewportTransform/);
  assert.match(pointerMove, /emitPanPerformanceTelemetry/);
  assert.match(pointerMove, /if \(isPan\)[\s\S]*return;/);
  assert.match(pointerMove, /const canvasPointer = isPan \? state\.pointer\.currentCanvas : canvasPoint\(pointer\)/);
  assert.match(panTransform, /content\.style\.transform/);
  assert.doesNotMatch(panTransform, /updateDetailMode/);
  assert.match(panTelemetry, /pan-frame-performance/);
  assert.match(panTelemetry, /frame === 1 \|\| input\.durationMs >= 8 \|\| frame % 12 === 0/);
  assert.match(pointerDown, /startedAt: now/);
  assert.match(pointHelper, /cachedCanvasBounds/);
  assert.match(pointHelper, /invalidateCanvasPointBounds/);
  assert.doesNotMatch(pointerDown, /classList\.(?:add|toggle)\('is-panning'/);
  assert.match(pointerMove, /schedulePanningEffects\(\)/);
  assert.match(finishPointer, /clearPanningEffects\(\)/);
  assert.match(panningEffects, /requestAnimationFrame/);
  assert.match(panningEffects, /canvas\.classList\.add\('is-panning'\)/);
  assert.match(panningEffects, /canvas\.classList\.remove\('is-panning'\)/);
  assert.match(canvasCss, /\.canvas-content\s*{[\s\S]*will-change:\s*transform;/);
  assert.match(canvasCss, /\.canvas\.is-panning \.ledger-card-title,[\s\S]*text-shadow:\s*none;/);
  assert.match(canvasCss, /\.canvas\.is-panning \.card-status-indicator,[\s\S]*box-shadow:\s*none;/);
});

test('ctrl and middle-button drag always derive pan intent without selection side effects', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.activeTool = 'select';
  state.selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: ['group-a'] };

  try {
    const event = { shiftKey: false, ctrlKey: true, button: 0, buttons: 1, target: { closest: () => null } } as unknown as PointerEvent;
    const middleEvent = { shiftKey: false, ctrlKey: false, button: 1, buttons: 4, target: { closest: () => null } } as unknown as PointerEvent;
    const shiftEvent = { shiftKey: true, ctrlKey: false, target: { closest: () => null } } as unknown as PointerEvent;
    const resizeHandle = { className: 'resize-handle se' } as HTMLElement;
    assert.equal(ctrlPanOnlySpec, '9f04b1c2');
    assert.equal(derivePointerIntent(event, 'card', null), 'pan');
    assert.equal(derivePointerIntent(event, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(event, 'group', null), 'pan');
    assert.equal(derivePointerIntent(event, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(event, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'card', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'group', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(shiftEvent, 'canvas', null), 'marquee');

    const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
    const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
    assert.match(pointerDown, /const forcedPan = isForcedPanPointer\(event\)/);
    assert.match(pointerDown, /ctrlPan:\s*event\.ctrlKey,\s*forcedPan/);
    assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
    assert.match(pointerUp, /const pointerSession = state\.pointer/);
    assert.match(pointerUp, /const isForcedPan = Boolean\(pointerSession\.forcedPan \|\| pointerSession\.ctrlPan\)/);
    assert.match(pointerUp, /!isForcedPan && pointerIntent === 'pan'/);
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card tool draws over zone and group backgrounds while select mode keeps zone pan precedence', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };

  try {
    const zoneEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-zone-id]' ? { dataset: { zoneId: 'zone-a' } } : null } } as unknown as PointerEvent;
    const groupEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-group-id]' ? { dataset: { groupId: 'group-a' } } : null } } as unknown as PointerEvent;
    const ctrlZoneEvent = { shiftKey: false, ctrlKey: true, target: zoneEvent.target } as unknown as PointerEvent;

    state.activeTool = 'card';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'draw-card');
    assert.equal(derivePointerIntent(groupEvent, 'group', null), 'draw-card');
    assert.equal(derivePointerIntent(ctrlZoneEvent, 'zone', null), 'pan');

    state.activeTool = 'select';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'pan');
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card creation preserves canvas x and y instead of clamping to positive space', () => {
  const createCard = source('frontend/src/runtime/card/effect/create-card-from-rect.ts');
  assert.match(createCard, /x:\s*rect\.x/);
  assert.match(createCard, /y:\s*rect\.y/);
  assert.doesNotMatch(createCard, /x:\s*Math\.max\(0,\s*rect\.x\)/);
  assert.doesNotMatch(createCard, /y:\s*Math\.max\(0,\s*rect\.y\)/);
});

test('created cards prepare their thread while the panel stays closed for A and X shortcuts', async () => {
  installCanvasRuntimeDom();
  const { createCardFromRect } = await import('../../src/runtime/card/effect/create-card-from-rect.js');
  const previousFetch = globalThis.fetch;
  const previousState = {
    activeLedger: state.activeLedger,
    activeLedgerId: state.activeLedgerId,
    activeTab: state.activeTab,
    activeTool: state.activeTool,
    canvasMode: state.canvasMode,
    ledgerReconciliation: state.ledgerReconciliation,
    ledgerTabs: state.ledgerTabs,
    ledgers: state.ledgers,
    selection: state.selection,
    threadId: state.threadId,
    threadPanelOpen: state.threadPanelOpen
  };
  const activeLedgerRect = { x: -180, y: -95, width: 320, height: 170 };
  const standaloneRect = { x: -75, y: -40, width: 280, height: 150 };

  try {
    state.canvasMode = 'ledger';
    state.activeTab = 'specs';
    state.activeLedgerId = 'specs';
    state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
    state.ledgers = state.ledgerTabs;
    state.activeTool = 'select';
    state.threadPanelOpen = false;
    state.threadId = 'thread-previous';
    state.selection = { cardIds: ['card-previous'], zoneIds: ['zone-previous'], groupIds: ['group-previous'] };
    state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
    resetCanvasReconciliation();
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: { body?: string } = {}) => {
      assert.equal(url, '/decision-os/specs');
      const mutation = JSON.parse(String(init.body ?? '{}')) as { action?: string; card?: Record<string, unknown> };
      assert.equal(mutation.action, 'create-card');
      assert.ok(mutation.card);
      return {
        ok: true,
        async json() {
          return { cards: [mutation.card], annotations: [], relationships: [], notes: {} };
        }
      };
    };

    await createCardFromRect(activeLedgerRect);

    const activeLedgerCard = state.activeLedger.cards[0] as Record<string, unknown>;
    const activeLedgerCardId = String(activeLedgerCard.id);
    assert.equal(activeLedgerCard.x, activeLedgerRect.x);
    assert.equal(activeLedgerCard.y, activeLedgerRect.y);
    assert.deepEqual(state.selection, { cardIds: [activeLedgerCardId], zoneIds: [], groupIds: [] });
    assert.equal(state.threadId, `thread-${activeLedgerCardId}`);
    assert.equal(state.threadPanelOpen, false);

    installCanvasRuntimeDom();
    state.activeLedger = null;
    state.threadPanelOpen = false;
    state.threadId = 'thread-previous';
    state.selection = { cardIds: ['card-previous'], zoneIds: ['zone-previous'], groupIds: ['group-previous'] };

    await createCardFromRect(standaloneRect);

    const standaloneCard = canvasDom.content.querySelector('.card[data-card-id]');
    assert.ok(standaloneCard);
    const standaloneCardId = String(standaloneCard.dataset.cardId);
    assert.equal(standaloneCard.style.left, `${standaloneRect.x}px`);
    assert.equal(standaloneCard.style.top, `${standaloneRect.y}px`);
    assert.deepEqual(state.selection, { cardIds: [standaloneCardId], zoneIds: [], groupIds: [] });
    assert.equal(state.threadId, `thread-${standaloneCardId}`);
    assert.equal(state.threadPanelOpen, false);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = previousFetch;
    Object.assign(state, previousState);
  }
});

test('direct canvas pointer down clears selection before pointer up', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /7d2c8b91/);
  assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
  assert.match(pointerDown, /canvas-background-pointer-down/);
  assert.match(pointerDown, /renderSelectionState\(\)/);
  assert.doesNotMatch(pointerUp, /canvas-background-click/);
  assert.doesNotMatch(pointerUp, /targetKind === 'canvas' && moved < 4[\s\S]*clear-transient-selection/);
});

test('plain pan pointer up does not force a full canvas rerender', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
  assert.match(pointerUp, /let releaseRendered = false/);
  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(gestureSelection\)/);
  assert.match(pointerUp, /if \(pointerIntent !== 'pan' && !releaseRendered\) renderCanvasSurface\(\)/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
});

test('manual runtime refresh preserves an active pan pointer and allows pan to continue', async () => {
  installCanvasRuntimeDom();
  const { refreshRuntimeState } = await import('../../src/runtime/refresh/controller/refresh-runtime-state.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 10, y: 20, scale: 1 };
  state.viewports = { specs: { x: 10, y: 20, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
  state.pointer = {
    intent: 'pan',
    targetKind: 'canvas',
    targetId: '',
    target: canvasDom.canvas,
    resizeHandle: null,
    start: { x: 100, y: 100 },
    current: { x: 100, y: 100 },
    startCanvas: { x: 100, y: 100 },
    currentCanvas: { x: 100, y: 100 },
    startedAt: 0
  };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      if (url === '/decision-os/data') return { ok: true, async json() { return {}; } };
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const refresh = refreshRuntimeState();
  await ledgerFetchStarted;
  resolveLedger({
    ok: true,
    async json() {
      return { cards: [], annotations: [], relationships: [], notes: {} };
    }
  });
  await refresh;

  assert.equal(state.pointer.intent, 'pan');
  handlePointerMove(canvasPointerEvent(130, 90));

  assert.deepEqual(state.viewport, { x: 40, y: 10, scale: 1 });
  assert.equal(canvasDom.content.style.transform, 'translate(40px, 10px) scale(1)');

  await handlePointerUp(canvasPointerEvent(130, 90));

  assert.equal(state.pointer, null);
  assert.deepEqual(JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}').viewport, { x: 40, y: 10, scale: 1 });
});

test('wheel zoom racing same-ledger load keeps latest viewport in memory and delayed persistence', async () => {
  installCanvasRuntimeDom();
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handleWheel } = await import('../../src/runtime/gesture/controller/handle-wheel.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.ledgers = state.ledgerTabs;
  state.activeTool = 'select';
  state.threadPanelOpen = false;
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };

  let resolveLedger!: (response: { ok: boolean; json(): Promise<Record<string, unknown>> }) => void;
  const ledgerFetchStarted = new Promise<void>((resolveStarted) => {
    (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
      assert.equal(url, '/decision-os/specs');
      resolveStarted();
      return new Promise((resolve) => {
        resolveLedger = resolve;
      });
    };
  });

  const load = loadActiveLedgerState();
  await ledgerFetchStarted;

  handleWheel(canvasWheelEvent({ clientX: 100, clientY: 80, deltaY: -120 }));
  const latestViewport = { ...state.viewport };
  assert.ok(latestViewport.scale > 1);

  resolveLedger({
    ok: true,
    async json() {
      return {
        viewport: { x: 999, y: 999, scale: 0.25 },
        cards: [],
        annotations: [],
        relationships: [],
        notes: {}
      };
    }
  });
  await load;

  assert.deepEqual(state.viewport, latestViewport);
  assert.deepEqual(state.viewports.specs, latestViewport);

  await waitForTimer(170);
  const persisted = JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}');
  assert.deepEqual(persisted.viewport, latestViewport);
  assert.deepEqual(persisted.viewports.specs, latestViewport);
});

test('a failed ledger load preserves an active pan pointer and the pan remains usable', async () => {
  installCanvasRuntimeDom();
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 10, y: 20, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
  const ledgerBeforeFailure = state.activeLedger;
  state.pointer = {
    intent: 'pan',
    targetKind: 'canvas',
    targetId: '',
    target: canvasDom.canvas,
    resizeHandle: null,
    start: { x: 100, y: 100 },
    current: { x: 100, y: 100 },
    startCanvas: { x: 100, y: 100 },
    currentCanvas: { x: 100, y: 100 },
    startedAt: 0
  };
  resetCanvasReconciliation();
  globalThis.fetch = (async () => { throw new Error('network unavailable'); }) as typeof fetch;

  const pointerBeforeFailure = state.pointer;
  assert.equal(await loadActiveLedgerState(), false);
  assert.equal(state.activeLedger, ledgerBeforeFailure);
  assert.equal(state.pointer, pointerBeforeFailure);
  assert.deepEqual(state.viewport, { x: 10, y: 20, scale: 1 });

  handlePointerMove(canvasPointerEvent(135, 88));
  assert.deepEqual(state.viewport, { x: 45, y: 8, scale: 1 });
  assert.equal(canvasDom.content.style.transform, 'translate(45px, 8px) scale(1)');
  await handlePointerUp(canvasPointerEvent(135, 88));
  assert.equal(state.pointer, null);
  assert.deepEqual(JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}').viewport, { x: 45, y: 8, scale: 1 });
  assert.equal(state.ledgerReconciliation.failedLoadCount, 1);
});

test('a failed in-flight ledger load preserves wheel zoom state and delayed persistence', async () => {
  installCanvasRuntimeDom();
  const { loadActiveLedgerState } = await import('../../src/runtime/ledger/effect/load-active-ledger-state.js');
  const { handleWheel } = await import('../../src/runtime/gesture/controller/handle-wheel.js');

  state.canvasMode = 'ledger';
  state.activeTab = 'specs';
  state.activeLedgerId = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
  state.viewport = { x: 0, y: 0, scale: 1 };
  state.viewports = { specs: { ...state.viewport } };
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  state.pointer = null;
  state.activeLedger = { cards: [], annotations: [], relationships: [], notes: {} };
  const ledgerBeforeFailure = state.activeLedger;
  resetCanvasReconciliation();

  let rejectLoad!: (reason: Error) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  globalThis.fetch = (() => {
    markStarted();
    return new Promise<Response>((_resolve, reject) => { rejectLoad = reject; });
  }) as typeof fetch;

  const load = loadActiveLedgerState();
  await started;
  handleWheel(canvasWheelEvent({ clientX: 120, clientY: 90, deltaY: -120 }));
  const viewportAfterWheel = { ...state.viewport };
  assert.ok(viewportAfterWheel.scale > 1);
  rejectLoad(new Error('network unavailable'));

  assert.equal(await load, false);
  assert.equal(state.activeLedger, ledgerBeforeFailure);
  assert.deepEqual(state.viewport, viewportAfterWheel);
  assert.deepEqual(state.viewports.specs, viewportAfterWheel);
  await waitForTimer(170);
  const persisted = JSON.parse(canvasStorage.get('decision-os.canvas.state') ?? '{}');
  assert.deepEqual(persisted.viewport, viewportAfterWheel);
  assert.deepEqual(persisted.viewports.specs, viewportAfterWheel);
  assert.equal(state.ledgerReconciliation.failedLoadCount, 1);
});

test('wheel zoom stays transform-only and does not reroute relationships', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const scheduler = source('frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const density = source('frontend/src/runtime/canvas/helper/render-density.ts');
  const ledgerRenderer = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const canvasPoint = source('frontend/src/runtime/canvas/helper/canvas-point.ts');
  const visibleCards = source('frontend/src/runtime/card/helper/visible-ledger-cards.ts');
  assert.match(wheel, /scheduleViewportTransform\(!event\.ctrlKey\)/);
  assert.match(density, /lowZoomRenderDensityThreshold = 0\.2/);
  assert.match(density, /lowZoomRenderDensity = 4/);
  assert.match(density, /state\.activeLedger && scale < lowZoomRenderDensityThreshold/);
  assert.match(density, /currentRenderDensity\(\): number \{[\s\S]*state\.activeLedger \? activeRenderDensity : 1/);
  assert.match(density, /effectiveViewportScale\(scale = Number\(state\.viewport\.scale\)\): number \{[\s\S]*scale \* currentRenderDensity\(\)/);
  assert.match(scheduler, /const animated = frameAnimated/);
  assert.match(scheduler, /const densityChanged = syncRenderDensity\(\)/);
  assert.match(scheduler, /if \(densityChanged\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*renderLedgerSurface\(\);[\s\S]*renderSelectionState\(\);[\s\S]*renderZoneLabelOverlay\(\);[\s\S]*renderRelationshipOverlay\(\);[\s\S]*\}/);
  assert.match(scheduler, /const detailModeChanged = updateDetailMode\(\)/);
  assert.match(scheduler, /if \(densityChanged \|\| detailModeChanged\) syncViewportCardDetails\(\)/);
  assert.match(scheduler, /const animated = frameAnimated && !densityChanged/);
  assert.match(scheduler, /applyViewportTransform\(settled, animated\)/);
  assert.match(scheduler, /import \{ hideCanvasControlOverlay \} from '\.\/render-canvas-control-overlay\.js'/);
  assert.match(scheduler, /import \{ resumeCanvasMediaOverlay, suspendCanvasMediaOverlay \} from '\.\/render-canvas-media-overlay\.js'/);
  assert.match(scheduler, /if \(zooming\) \{\s*suspendCanvasMediaOverlay\(\);[\s\S]*hideCanvasControlOverlay\(\);[\s\S]*settleTimer = setTimeout\(finishZoomSettle, 120\)/);
  assert.match(scheduler, /settleTimer = setTimeout\(finishZoomSettle, 120\)/);
  assert.match(scheduler, /applyViewportSettledEffects\(\);[\s\S]*resumeCanvasMediaOverlay\(\)/);
  assert.doesNotMatch(scheduler, /syncScaleCssVars|applyViewportScaleCssVars/);
  assert.doesNotMatch(scheduler, /is-zooming|state\.viewport\.scale < 0\.35|classList\.add|classList\.remove/);
  assert.match(viewport, /export function applyViewportSettledEffects\(\)/);
  assert.match(viewport, /viewportTransformTransition = 'transform 90ms cubic-bezier/);
  assert.match(viewport, /export function applyViewportTransform\(settled = true, animated = false\)/);
  assert.match(viewport, /applyViewportTransformTransition\(animated\)/);
  assert.match(viewport, /content\.style\.transform = `translate\(\$\{x\}px, \$\{y\}px\) scale\(\$\{effectiveViewportScale\(\)\}\)`/);
  assert.match(ledgerRenderer, /syncRenderDensity\(\)/);
  assert.match(canvasPoint, /state\.viewport\.scale/);
  assert.doesNotMatch(canvasPoint, /effectiveViewportScale|currentRenderDensity|renderDensity/);
  assert.match(visibleCards, /const scale = Math\.max\(0\.0001, finiteNumber\(viewport\.scale, 1\)\)/);
  assert.doesNotMatch(visibleCards, /effectiveViewportScale|currentRenderDensity|renderDensity/);
  assert.doesNotMatch(wheel, /renderRelationshipOverlay/);
});

test('canvas debug overlay is URL-param gated and reports zoom density state', () => {
  const debugRuntime = source('frontend/src/runtime/debug/effect/render-canvas-debug-overlay.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const pan = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const surface = source('frontend/src/runtime/canvas/effect/render-canvas-surface.ts');
  const canvasCss = source('frontend/assets/canvas.css');
  const debugCss = source('frontend/assets/canvas/debug.css');

  assert.match(canvasCss, /@import url\('\.\/canvas\/debug\.css'\)/);
  assert.match(debugRuntime, /params\.has\('canvasDebug'\)/);
  assert.match(debugRuntime, /params\.get\('debug'\) === 'canvas'/);
  assert.match(debugRuntime, /params\.get\('debugCanvas'\) === '1'/);
  assert.match(debugRuntime, /if \(!canvasDebugEnabled\(\)\) return/);
  assert.match(debugRuntime, /className = 'canvas-debug-overlay'/);
  assert.match(debugRuntime, /row\('raw zoom', formatNumber\(state\.viewport\.scale, 4\)\)/);
  assert.match(debugRuntime, /row\('effective zoom', formatNumber\(effectiveViewportScale\(\), 4\)\)/);
  assert.match(debugRuntime, /row\('render density', String\(currentRenderDensity\(\)\)\)/);
  assert.match(debugRuntime, /row\('detail mode', detailMode\(\)\)/);
  assert.match(debugRuntime, /row\('detail DOM', String\(count\(':scope > \.card \.ledger-card-detail-layer'\)\)\)/);
  assert.match(debugRuntime, /row\('transform', content\?\.style\.transform \|\| 'none'\)/);
  assert.doesNotMatch(debugRuntime, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(viewport, /renderCanvasDebugOverlay\(settled \? 'viewport-settled' : 'viewport-frame'\)/);
  assert.match(pan, /renderCanvasDebugOverlay\('pan'\)/);
  assert.match(surface, /renderCanvasDebugOverlay\('surface'\)/);
  assert.match(surface, /options: \{ renderThreadPanel\?: boolean \} = \{\}/);
  assert.match(surface, /if \(options\.renderThreadPanel !== false\) renderThreadPanel\(\)/);
  assert.match(debugCss, /\.canvas-debug-overlay\s*{[^}]*position:\s*fixed;[^}]*z-index:\s*10000;/s);
  assert.match(debugCss, /\.canvas-debug-overlay table\s*{[^}]*border-collapse:\s*collapse;/s);
});

test('normal detail reveal is viewport-local and layout-free', () => {
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const pan = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const sync = source('frontend/src/runtime/canvas/effect/sync-viewport-card-details.ts');
  const cardRenderer = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const detailRenderer = source('frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts');
  const detailMode = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  const cardPatch = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const zonePatch = source('frontend/src/runtime/ledger/component/patch-ledger-zone.ts');
  const relationships = source('frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts');
  const css = source('frontend/assets/canvas/canvas-layer.css');
  const objects = source('frontend/assets/canvas/objects.css');

  assert.match(viewport, /syncViewportCardDetails\(\)/);
  assert.match(pan, /syncViewportCardDetails\(\)/);
  assert.match(pan, /content\.style\.transition !== 'none'/);
  assert.match(pan, /scale\(\$\{effectiveViewportScale\(\)\}\)/);
  assert.match(cardPatch, /const renderedGeometry = renderGeometry\(geometry\)/);
  assert.match(cardPatch, /element\.style\.left = `\$\{renderedGeometry\.x\}px`/);
  assert.match(cardPatch, /element\.style\.minHeight = `\$\{renderedGeometry\.height\}px`/);
  assert.match(zonePatch, /const renderedGeometry = renderGeometry\(geometry\)/);
  assert.match(zonePatch, /element\.style\.minHeight = `\$\{renderedGeometry\.height\}px`/);
  assert.match(relationships, /overlay\.setAttribute\('viewBox', `0 0 \$\{bounds\.width\} \$\{bounds\.height\}`\)/);
  assert.match(relationships, /overlay\.style\.width = `\$\{renderLength\(bounds\.width\)\}px`/);
  assert.match(sync, /const detailedCardIds = new Set<string>\(\)/);
  assert.match(sync, /activeLedgerCardMap\(\)/);
  assert.match(sync, /viewportWorldBounds\(state\.viewport, viewportCanvasSize\(\)\)/);
  assert.match(sync, /canvasBoundsIntersect\(ledgerCardBounds\(ledgerCard\), bounds\)/);
  assert.match(sync, /renderLedgerCardDetailLayer\(ledgerCard\)/);
  assert.match(sync, /directChildByClass\(card, 'ledger-card-detail-layer'\)/);
  assert.match(sync, /directChildByClass\(card, 'ledger-card-detail-layer'\)\?\.remove\(\)/);
  assert.match(sync, /export function clearViewportCardDetails\(\)/);
  assert.match(sync, /content\.querySelectorAll\(':scope > \.card\.detail-visible, :scope > \.card > \.ledger-card-detail-layer'\)/);
  assert.match(sync, /detailedCardIds\.clear\(\)/);
  assert.match(sync, /if \(canvas\.classList\.contains\('low-detail'\)\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*return;/);
  assert.match(detailMode, /export function updateDetailMode\(\): boolean/);
  assert.match(detailMode, /return hasLowDetail !== shouldUseLowDetail \|\| hasOverviewDetail !== shouldUseOverviewDetail/);
  assert.doesNotMatch(detailMode, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(sync, /classList\.add\('detail-visible'\)/);
  assert.match(sync, /classList\.remove\('detail-visible'\)/);
  assert.doesNotMatch(sync, /querySelectorAll<HTMLElement>\(':scope > \.card\[data-card-id\]'\)/);
  assert.doesNotMatch(sync, /classList\.toggle\('detail-visible'/);
  assert.match(cardRenderer, /const detailVisible = element\.className\.split\(\/\\s\+\/\)\.includes\('detail-visible'\)/);
  assert.match(cardRenderer, /card ledger-node\$\{detailVisible \? ' detail-visible' : ''\}/);
  assert.match(cardRenderer, /mountedDetail \? renderLedgerCardDetailLayer\(card, mountedDetail\) : null/);
  assert.doesNotMatch(cardRenderer, /renderLedgerCardMarkdown\(ledgerCardBody\(card\)/);
  assert.match(detailRenderer, /renderLedgerCardMarkdown\(ledgerCardBody\(card\)/);
  assert.match(detailRenderer, /renderLedgerCardTabFrame\(card, fields, activeTab\)/);
  assert.doesNotMatch(sync, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-detail-layer/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-layer/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-detail-layer/);
  assert.match(objects, /\.ledger-card-detail-layer\s*{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s);
  assert.match(objects, /\.card\.detail-visible \.ledger-card-detail-layer\s*{[^}]*opacity:\s*1;[^}]*transition:\s*opacity 160ms ease-out;/s);
  assert.match(objects, /\.card:not\(\.detail-visible\),\s*\.card\.connected:not\(\.detail-visible\)\s*{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(cardRenderer, /const body = hasFieldTabs/);
});
