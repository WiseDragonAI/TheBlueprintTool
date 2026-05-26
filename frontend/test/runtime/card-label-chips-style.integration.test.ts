/**
 * WHAT: Guards card label chip styling in normal and low-detail canvas modes.
 * WHY: Labels are visual tags, while internal hash ids must stay hidden at overview zoom.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('card label chips are positioned top right and inherit the card color', () => {
  const objectsCss = source('frontend/assets/canvas/objects.css');
  const canvasLayerCss = source('frontend/assets/canvas/canvas-layer.css');

  assert.match(objectsCss, /\.ledger-card-labels\s*{[^}]*position:\s*absolute;[^}]*top:\s*8px;[^}]*right:\s*8px;/s);
  assert.match(objectsCss, /\.ledger-card-label\s*{[^}]*background:\s*color-mix\(in srgb,\s*var\(--card-zone-color\)/s);
  assert.match(objectsCss, /\.ledger-card-label\s*{[^}]*border:\s*1px solid color-mix\(in srgb,\s*var\(--card-zone-color\)/s);
  assert.match(canvasLayerCss, /\.canvas\.low-detail \.ledger-card-labels,[\s\S]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/);
  assert.match(canvasLayerCss, /\.canvas\.low-detail \.hash,[\s\S]{0,160}display:\s*none;/);
});
