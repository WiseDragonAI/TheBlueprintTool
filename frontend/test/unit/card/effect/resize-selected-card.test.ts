import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../../../src/runtime/state.js';

test('resize-selected-card mutates selected card geometry from the active handle', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousCustomEvent = globalThis.CustomEvent;
  const style = new Map<string, string>();
  const card = {
    dataset: { cardId: 'card-a' },
    offsetLeft: 100,
    offsetTop: 80,
    offsetWidth: 260,
    offsetHeight: 160,
    style: {
      left: '100px',
      top: '80px',
      width: '260px',
      height: '160px',
      setProperty(name: string, value: string) {
        style.set(name, value);
      }
    },
    getBoundingClientRect() {
      return { toJSON: () => ({ left: 100, top: 80, width: 260, height: 160 }) };
    }
  } as unknown as HTMLElement;
  const handle = { classList: { contains: (name: string) => Boolean(name === 'se') } } as unknown as HTMLElement;

  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent() {} };
  (globalThis as unknown as { document: unknown }).document = { querySelector: () => ({}), querySelectorAll: () => [] };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
    detail: unknown;
    constructor(_name: string, options: { detail?: unknown } = {}) {
      this.detail = options.detail;
    }
  };
  state.pointer = { target: card, resizeHandle: handle };

  try {
    const { resizeSelectedCard } = await import('../../../../src/runtime/card/effect/resize-selected-card.js');
    resizeSelectedCard(40, 30);
    assert.equal(card.style.left, '100px');
    assert.equal(card.style.top, '80px');
    assert.equal(card.style.width, '300px');
    assert.equal(card.style.height, '190px');
    assert.equal(card.dataset.sizeCacheWidth, '300');
    assert.equal(card.dataset.sizeCacheHeight, '190');
    assert.equal(style.get('--card-size-cache-width'), '300px');
    assert.equal(style.get('--card-size-cache-height'), '190px');
  } finally {
    state.pointer = null;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});
