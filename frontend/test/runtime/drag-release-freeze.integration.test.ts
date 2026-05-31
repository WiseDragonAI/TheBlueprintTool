/**
 * WHAT: Regression coverage for card drag release while the geometry commit is still in flight.
 * WHY: Releasing the pointer must freeze the card at the release coordinate, not at a later cursor move.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type FakeElement = {
  dataset: Record<string, string>;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    display: string;
    setProperty(name: string, value: string): void;
    getPropertyValue(name: string): string;
  };
  hidden: boolean;
  childElementCount: number;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  parentElement: FakeElement | null;
  classList: { toggle(): void; add(): void; remove(): void; contains(): boolean };
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  append(node: FakeElement): void;
  appendChild(node: FakeElement): void;
  insertBefore(node: FakeElement, before: FakeElement | null): void;
  replaceChildren(): void;
  setAttribute(name: string, value: string): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
};

function fakeElement(dataset: Record<string, string> = {}): FakeElement {
  const customProperties = new Map<string, string>();
  const element: FakeElement = {
    dataset,
    style: {
      left: '0px',
      top: '0px',
      width: '120px',
      height: '80px',
      display: '',
      setProperty(name: string, value: string) {
        customProperties.set(name, value);
      },
      getPropertyValue(name: string) {
        return customProperties.get(name) ?? '';
      }
    },
    hidden: false,
    childElementCount: 0,
    parentElement: null,
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    get offsetLeft() { return Number.parseFloat(element.style.left) || 0; },
    get offsetTop() { return Number.parseFloat(element.style.top) || 0; },
    get offsetWidth() { return Number.parseFloat(element.style.width) || 0; },
    get offsetHeight() { return Number.parseFloat(element.style.height) || 0; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    append(node: FakeElement) {
      node.parentElement = element;
      element.childElementCount += 1;
    },
    appendChild(node: FakeElement) {
      element.append(node);
    },
    insertBefore(node: FakeElement) {
      element.append(node);
    },
    replaceChildren() {
      element.childElementCount = 0;
    },
    setAttribute() {},
    getBoundingClientRect() {
      return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
    }
  };
  return element;
}

test('card drag release clears pointer before slow geometry commit can accept later cursor movement', async () => {
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_type: string, init: { detail?: unknown } = {}) {
      this.detail = init.detail;
    }
  };
  const canvas = fakeElement();
  const content = fakeElement();
  const card = fakeElement({ cardId: 'card-a' });
  const created: FakeElement[] = [];
  card.style.left = '20px';
  card.style.top = '20px';
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
  content.querySelector = (selector: string) => selector === ':scope > .zone-label-overlay' ? null : null;
  content.querySelectorAll = () => [];

  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1000,
    innerHeight: 800,
    __coreTelemetry: [],
    location: { pathname: '/specs' },
    addEventListener() {},
    dispatchEvent() {},
    visualViewport: { addEventListener() {} }
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
  (globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };
  (globalThis as unknown as { document: unknown }).document = {
    querySelector(selector: string) {
      if (selector === '.canvas') return canvas;
      if (selector === '.canvas-content') return content;
      if (selector === '[data-card-id="card-a"]') return card;
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector === '[data-card-id]') return [card];
      return [];
    },
    createElement() {
      const element = fakeElement();
      created.push(element);
      return element;
    },
    createElementNS() {
      return fakeElement();
    }
  };

  const calls: RequestInit[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Promise(() => {});
  };

  const { state } = await import('../../src/runtime/state.js');
  const { handlePointerUp } = await import('../../src/runtime/gesture/controller/handle-pointer-up.js');
  const { handlePointerMove } = await import('../../src/runtime/gesture/controller/handle-pointer-move.js');

  state.activeTab = 'specs';
  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }];
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
  assert.ok(created.length >= 0);
});
