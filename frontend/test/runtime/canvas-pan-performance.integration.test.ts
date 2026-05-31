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
    assert.match(pointerUp, /const pointerSession = state\.pointer/);
    assert.match(pointerUp, /const isCtrlPan = Boolean\(pointerSession\.ctrlPan\)/);
    assert.match(pointerUp, /!isCtrlPan && pointerIntent === 'pan'/);
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('direct canvas pointer down clears selection before pointer up', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /7d2c8b91/);
  assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !event\.ctrlKey/);
  assert.match(pointerDown, /canvas-background-pointer-down/);
  assert.match(pointerDown, /renderSelectionState\(\)/);
  assert.doesNotMatch(pointerUp, /canvas-background-click/);
  assert.doesNotMatch(pointerUp, /targetKind === 'canvas' && moved < 4[\s\S]*clear-transient-selection/);
});

test('plain pan pointer up does not force a full canvas rerender', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
  assert.match(pointerUp, /if \(pointerIntent !== 'pan'\) renderCanvasSurface\(\)/);
});
