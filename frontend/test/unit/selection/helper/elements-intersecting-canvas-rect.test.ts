import test from 'node:test';
import assert from 'node:assert/strict';
import { elementsIntersectingCanvasRect } from '../../../../src/runtime/selection/helper/elements-intersecting-canvas-rect.js';

test('elements-intersecting-canvas-rect returns only nodes intersecting the canvas rect', () => {
  const nodes = [
    { dataset: { cardId: 'inside' }, offsetLeft: 10, offsetTop: 10, offsetWidth: 50, offsetHeight: 40 },
    { dataset: { cardId: 'outside' }, offsetLeft: 300, offsetTop: 300, offsetWidth: 50, offsetHeight: 40 },
    { dataset: {}, offsetLeft: 20, offsetTop: 20, offsetWidth: 10, offsetHeight: 10 }
  ];
  const previousDocument = globalThis.document;
  (globalThis as any).document = { querySelectorAll: () => nodes };

  assert.deepEqual(elementsIntersectingCanvasRect({ x: 0, y: 0, width: 100, height: 100 }, '[data-card-id]', 'cardId'), ['inside']);

  (globalThis as any).document = previousDocument;
});
