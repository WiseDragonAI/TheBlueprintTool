import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

test('canvas wheel zoom supports wide overview scale', () => {
  const wheel = readFileSync(new URL('frontend/src/runtime/gesture/controller/handle-wheel.ts', root), 'utf8');
  const specs = readFileSync(new URL('documentation/specs.json', root), 'utf8');
  assert.match(wheel, /minCanvasZoomScale = 0\.03/);
  assert.match(wheel, /Math\.max\(minCanvasZoomScale, nextScale\)/);
  assert.match(specs, /down to 0\.03 scale/);
});
