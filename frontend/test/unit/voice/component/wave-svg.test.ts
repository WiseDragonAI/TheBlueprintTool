import test from 'node:test';
import assert from 'node:assert/strict';
import { waveSvg } from '../../../../src/runtime/voice/component/wave-svg.js';

function resourceId(markup: string, suffix: string): string {
  return markup.match(new RegExp(`id="([^"]+${suffix})"`))?.[1] ?? '';
}

test('each waveform owns unique SVG paint resources', () => {
  const first = waveSvg();
  const second = waveSvg();
  const firstArea = resourceId(first, 'area-gradient');
  const firstCore = resourceId(first, 'core-gradient');
  const secondArea = resourceId(second, 'area-gradient');
  const secondCore = resourceId(second, 'core-gradient');

  assert.ok(firstArea);
  assert.ok(firstCore);
  assert.notEqual(firstArea, secondArea);
  assert.notEqual(firstCore, secondCore);
  assert.match(first, new RegExp(`fill="url\\(#${firstArea}\\)"`));
  assert.match(first, new RegExp(`fill="url\\(#${firstCore}\\)"`));
  assert.doesNotMatch(`${first}${second}`, /id="wave(?:Area|Core)Gradient"/);
});
