/**
 * WHAT: Exercises viewport card detail reconciliation against independently cached and rendered state.
 * WHY: Oversized visible cards must recover full detail without leaving and re-entering the viewport.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

type FakeElement = {
  className: string;
  dataset: Record<string, string>;
  children: FakeElement[];
  parentElement: FakeElement | null;
  classList: {
    add(...names: string[]): void;
    remove(...names: string[]): void;
    contains(name: string): boolean;
  };
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
  insertBefore(node: FakeElement, before: FakeElement | null): void;
  append(node: FakeElement): void;
  remove(): void;
};

function fakeElement(className: string, dataset: Record<string, string> = {}): FakeElement {
  const element = {
    className,
    dataset,
    children: [] as FakeElement[],
    parentElement: null as FakeElement | null,
    classList: {
      add(...names: string[]) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        for (const name of names) classes.add(name);
        element.className = Array.from(classes).join(' ');
      },
      remove(...names: string[]) {
        const removed = new Set(names);
        element.className = element.className.split(/\s+/).filter((name) => name && !removed.has(name)).join(' ');
      },
      contains(name: string) {
        return element.className.split(/\s+/).includes(name);
      }
    },
    querySelector(selector: string) {
      // WHAT: Resolve the one card selector used by viewport detail reconciliation.
      // WHY: The regression harness should expose only the DOM contract exercised by the effect.
      if (selector.includes('[data-card-id="card-a"]')) return element.children.find((child) => child.dataset.cardId === 'card-a') ?? null;
      return null;
    },
    querySelectorAll(selector: string) {
      // WHAT: Return clearable detail-state nodes for the selector owned by the effect.
      // WHY: Unrelated selector behavior would add fixture surface without increasing coverage.
      if (!selector.includes('ledger-card-detail-layer') && !selector.includes('detail-visible')) return [];
      return element.children.flatMap((child) => [
        ...(child.classList.contains('detail-visible') ? [child] : []),
        ...child.children.filter((nested) => nested.classList.contains('ledger-card-detail-layer'))
      ]);
    },
    insertBefore(node: FakeElement, before: FakeElement | null) {
      const index = before ? element.children.indexOf(before) : -1;
      // WHAT: Preserve the requested sibling order when the target exists.
      // WHY: Detail layers are inserted before the overview layer in production.
      if (index >= 0) element.children.splice(index, 0, node);
      else element.children.push(node);
      node.parentElement = element;
    },
    append(node: FakeElement) {
      element.children.push(node);
      node.parentElement = element;
    },
    remove() {
      // WHAT: Treat detached fixture nodes as an idempotent removal.
      // WHY: Production cleanup can remove a detail layer after its parent has already disappeared.
      if (!element.parentElement) return;
      element.parentElement.children = element.parentElement.children.filter((child) => child !== element);
      element.parentElement = null;
    }
  } satisfies FakeElement;
  return element;
}

test('visible oversized cards repair detail DOM when the detail cache is ahead of the reveal class', async () => {
  const canvas = fakeElement('canvas');
  const content = fakeElement('canvas-content');
  const card = fakeElement('card ledger-node', { cardId: 'card-a' });
  const detail = fakeElement('ledger-card-detail-layer');
  const overview = fakeElement('ledger-card-overview-layer');
  card.append(detail);
  card.append(overview);
  content.append(card);

  const frames: FrameRequestCallback[] = [];
  (globalThis as any).window = { innerWidth: 800, innerHeight: 600 };
  (globalThis as any).document = {
    documentElement: { clientWidth: 800, clientHeight: 600 },
    querySelector(selector: string) {
      // WHAT: Bind the runtime DOM module to the fixture canvas and world content.
      // WHY: The effect captures these nodes once when its module is imported.
      if (selector === '.canvas') return canvas;
      if (selector === '.canvas-content') return content;
      return null;
    }
  };
  (globalThis as any).CSS = { escape: (value: string) => value };
  (globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  };

  const { state } = await import('../../src/runtime/state.js');
  const { syncViewportCardDetails } = await import('../../src/runtime/canvas/effect/sync-viewport-card-details.js');
  state.canvasMode = 'ledger';
  state.viewport = { x: 100, y: 700, scale: 1 };
  state.activeLedger = {
    cards: [{ id: 'card-a', x: -100, y: -900, w: 1000, h: 2000 }]
  };

  syncViewportCardDetails();
  assert.equal(frames.length, 1);
  frames.shift();
  assert.equal(card.classList.contains('detail-visible'), false);

  syncViewportCardDetails();
  assert.equal(frames.length, 1);
  frames.shift()?.(0);
  assert.equal(card.classList.contains('detail-visible'), true);
});
