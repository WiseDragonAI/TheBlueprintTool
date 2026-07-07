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

test('target selection updates selection chrome without full canvas rerender', () => {
  const selectTarget = readFileSync(new URL('frontend/src/runtime/selection/controller/select-target.ts', root), 'utf8');
  assert.match(selectTarget, /renderSelectionState\(\)/);
  assert.doesNotMatch(selectTarget, /renderCanvasSurface/);
  assert.doesNotMatch(selectTarget, /renderLedgerSurface/);
});

test('card focus click does not enter the geometry commit or full canvas render path', () => {
  const pointerUp = readFileSync(new URL('frontend/src/runtime/gesture/controller/handle-pointer-up.ts', root), 'utf8');
  const pointerMove = readFileSync(new URL('frontend/src/runtime/gesture/controller/handle-pointer-move.ts', root), 'utf8');
  const clickReturnIndex = pointerUp.indexOf('isClickMovement(moved)');
  const geometryCommitIndex = pointerUp.indexOf('await commitSelectedLedgerGeometry()');
  assert.match(pointerUp, /pointerIntent === 'drag' \|\| pointerIntent === 'group' \|\| pointerIntent === 'resize'/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
  assert.match(pointerUp, /finishPointer\(event\);[\s\S]*persistState\(\);[\s\S]*return;/);
  assert.match(pointerUp, /await commitSelectedLedgerGeometry\(\)/);
  assert.ok(clickReturnIndex > -1);
  assert.ok(geometryCommitIndex > clickReturnIndex);
  assert.match(pointerMove, /isGeometryGesture && isClickMovement\(pointerDistancePx\(state\.pointer\.start, pointer\)\)/);
});
