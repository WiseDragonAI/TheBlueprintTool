import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('zone labels render through an overlay above cards instead of the zone stacking context', () => {
  const css = source('frontend/assets/canvas/objects.css');
  assert.match(css, /\.zone-label-overlay\s*{[^}]*z-index:\s*90;/s);
  assert.match(css, /\.card\s*{[^}]*z-index:\s*30;/s);
  assert.match(css, /\.zone-title\s*{[^}]*visibility:\s*hidden;/s);

  const renderSurface = source('frontend/src/runtime/canvas/effect/render-canvas-surface.ts');
  assert.match(renderSurface, /renderZoneLabelOverlay\(\)/);

  const moveSelected = source('frontend/src/runtime/selection/effect/move-selected.ts');
  assert.match(moveSelected, /renderZoneLabelOverlay\(\)/);

  const resizeZone = source('frontend/src/runtime/zone/effect/resize-selected-zone.ts');
  assert.match(resizeZone, /renderZoneLabelOverlay\(\)/);
});

test('regular zones keep only their inner line shadow', () => {
  const css = source('frontend/assets/canvas/objects.css');
  assert.match(css, /\.regular-zone\s*{[^}]*box-shadow:\s*inset 0 0 0 1px/s);
  assert.doesNotMatch(css, /\.regular-zone\s*{[^}]*0 18px 46px/s);
});
