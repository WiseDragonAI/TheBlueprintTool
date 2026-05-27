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

test('canvas pan uses a transform-only path with sampled performance telemetry', () => {
  const pointerMove = source('frontend/src/runtime/gesture/controller/handle-pointer-move.ts');
  const panTransform = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const panTelemetry = source('frontend/src/runtime/gesture/effect/emit-pan-performance-telemetry.ts');
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  assert.match(pointerMove, /applyPanViewportTransform/);
  assert.match(pointerMove, /emitPanPerformanceTelemetry/);
  assert.match(pointerMove, /if \(isPan\)[\s\S]*return;/);
  assert.match(pointerMove, /const canvasPointer = isPan \? state\.pointer\.currentCanvas : canvasPoint\(pointer\)/);
  assert.match(panTransform, /content\.style\.transform/);
  assert.doesNotMatch(panTransform, /updateDetailMode/);
  assert.match(panTelemetry, /pan-frame-performance/);
  assert.match(panTelemetry, /frame === 1 \|\| input\.durationMs >= 8 \|\| frame % 12 === 0/);
  assert.match(pointerDown, /startedAt: now/);
});

test('ctrl drag always derives pan intent without selection side effects and shift canvas drag derives marquee', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.activeTool = 'select';
  state.selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: ['group-a'] };

  try {
    const event = { shiftKey: false, ctrlKey: true, target: { closest: () => null } } as unknown as PointerEvent;
    const shiftEvent = { shiftKey: true, ctrlKey: false, target: { closest: () => null } } as unknown as PointerEvent;
    const resizeHandle = { className: 'resize-handle se' } as HTMLElement;
    assert.equal(ctrlPanOnlySpec, '9f04b1c2');
    assert.equal(derivePointerIntent(event, 'card', null), 'pan');
    assert.equal(derivePointerIntent(event, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(event, 'group', null), 'pan');
    assert.equal(derivePointerIntent(event, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(event, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(shiftEvent, 'canvas', null), 'marquee');

    const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
    const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
    assert.match(pointerDown, /ctrlPan:\s*event\.ctrlKey/);
    assert.match(pointerUp, /const isCtrlPan = Boolean\(state\.pointer\.ctrlPan\)/);
    assert.match(pointerUp, /!isCtrlPan && state\.pointer\.intent === 'pan'/);
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});
