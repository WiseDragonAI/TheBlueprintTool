import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionIncludesTarget } from '../../../../src/runtime/selection/helper/selection-includes-target.js';

test('selection-includes-target returns whether a target is already selected', () => {
  const selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: ['group-a'] };
  assert.equal(selectionIncludesTarget(selection, 'card', 'card-a'), true);
  assert.equal(selectionIncludesTarget(selection, 'zone', 'zone-a'), true);
  assert.equal(selectionIncludesTarget(selection, 'group', 'group-a'), true);
  assert.equal(selectionIncludesTarget(selection, 'card', 'card-b'), false);
  assert.equal(selectionIncludesTarget(selection, 'canvas', ''), false);
});
