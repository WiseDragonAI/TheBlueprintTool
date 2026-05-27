/**
 * WHAT: Runtime tests for direct card clicks after zone-expanded selection.
 * WHY: Card targeting must not stay stuck behind the previous zone selection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldPreservePointerSelection } from '../../src/runtime/selection/helper/should-preserve-pointer-selection.js';

const root = new URL('../../../', import.meta.url);

test('direct card clicks do not preserve expanded zone selection', () => {
  const selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: [] };
  assert.equal(shouldPreservePointerSelection(selection, 'card', 'card-a', false), false);
});

test('direct clicks still preserve ordinary selected cards for dragging', () => {
  const selection = { cardIds: ['card-a'], zoneIds: [], groupIds: [] };
  assert.equal(shouldPreservePointerSelection(selection, 'card', 'card-a', false), true);
});

test('shift click is the additive selection modifier', () => {
  const pointerDown = readFileSync(new URL('frontend/src/runtime/gesture/controller/handle-pointer-down.ts', root), 'utf8');
  assert.match(pointerDown, /shouldPreservePointerSelection\(state\.selection, targetKind, targetId, event\.shiftKey\)/);
  assert.match(pointerDown, /selectTarget\(targetKind, targetId, event\.shiftKey\)/);
  assert.doesNotMatch(pointerDown, /selectTarget\(targetKind, targetId, event\.ctrlKey\)/);
});
