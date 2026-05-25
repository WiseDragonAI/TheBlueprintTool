import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('zone color input previews during drag and commits only on final change', () => {
  const inputController = source('frontend/src/runtime/input/controller/handle-region-color-input.ts');
  assert.match(inputController, /handleRegionColorInput/);
  assert.match(inputController, /previewRegionColorController\(zone, input\.value\)/);
  assert.match(inputController, /handleRegionColorChange/);
  assert.match(inputController, /editRegionColorController\(zone, input\.value\)/);

  const bindInputs = source('frontend/src/runtime/input/effect/bind-inputs.ts');
  assert.match(bindInputs, /addEventListener\('input', handleRegionColorInput\)/);
  assert.match(bindInputs, /addEventListener\('change', handleRegionColorChange\)/);

  const colorEffect = source('frontend/src/runtime/zone/effect/apply-zone-color-edit.ts');
  const previewBody = colorEffect.match(/export function previewZoneColorEdit[\s\S]*?\n}\n/)?.[0] ?? '';
  assert.match(previewBody, /setProperty\('--zone-color', color\)/);
  assert.match(previewBody, /renderCardZoneColors\(\)/);
  assert.match(previewBody, /renderZoneLabelOverlay\(\)/);
  assert.doesNotMatch(previewBody, /commitActiveLedgerMutation/);
  assert.doesNotMatch(previewBody, /renderCanvasSurface/);

  const commitBody = colorEffect.match(/export function applyZoneColorEdit[\s\S]*?^}/m)?.[0] ?? '';
  assert.match(commitBody, /previewZoneColorEdit\(zone, color\)/);
  assert.match(commitBody, /commitActiveLedgerMutation/);
  assert.match(commitBody, /render: true/);
});

test('interactive color controls are excluded from canvas pointer and drag capture', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  assert.match(pointerDown, /isGestureControlTarget\(rawTarget\)/);

  const dragStart = source('frontend/src/runtime/gesture/controller/handle-native-drag-start.ts');
  assert.match(dragStart, /isGestureControlTarget\(event\.target\)/);
  assert.match(dragStart, /event\.preventDefault\(\)/);

  const helper = source('frontend/src/runtime/gesture/helper/is-gesture-control-target.ts');
  assert.match(helper, /button,input,textarea,select,\[data-action\],\[contenteditable="true"\]/);
});
