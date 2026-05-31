import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('low-detail zoom hides card detail while keeping counter-scaled card titles', () => {
  const css = source('frontend/assets/canvas/canvas-layer.css');
  const specs = source('documentation/specs.json');

  assert.match(specs, /84cf2a6b/);
  assert.match(css, /\.canvas\.low-detail \.ledger-card-detail-layer,/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.card strong,\s*\n/);
  assert.match(css, /\.canvas\.low-detail \.ledger-card-overview-title\s*{[^}]*transform:\s*scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.match(specs, /9d5e0b7a/);
  assert.match(css, /\.canvas\.low-detail \.ledger-card-overview-title\s*{[^}]*white-space:\s*normal;/s);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-overview-title\s*{[^}]*width:\s*calc\(100% \* var\(--viewport-scale, 1\)\);/s);

  const viewportRuntime = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const detailRuntime = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  assert.match(viewportRuntime, /--inverse-viewport-scale/);
  assert.match(detailRuntime, /invalidateDetailModeCardSizeCache/);
  assert.doesNotMatch(detailRuntime, /offsetWidth|offsetHeight|getBoundingClientRect|scrollHeight/);
  assert.match(detailRuntime, /if \(hasLowDetail !== shouldUseLowDetail\) canvas\.classList\.toggle/);
  assert.match(detailRuntime, /if \(hasOverviewDetail !== shouldUseOverviewDetail\) canvas\.classList\.toggle/);
  assert.doesNotMatch(css, /\.canvas\.overview-detail \.regular-zone/);
  assert.match(css, /\.canvas\.overview-detail \.grid\s*{[^}]*display:\s*none;/s);
});

test('zone edit and color controls are hidden until the owning zone is hovered or focused', () => {
  const css = source('frontend/assets/canvas/objects.css');
  const specs = source('documentation/specs.json');

  assert.match(specs, /2aa4f070/);
  assert.match(specs, /5d8f2a1b/);
  assert.match(css, /\.zone \.zone-actions \.icon-button,\s*\n\.zone \.zone-color-edit\s*{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;[^}]*transition:/s);
  assert.match(css, /\.zone:hover \.zone-actions \.icon-button,/);
  assert.match(css, /\.zone:hover \.zone-color-edit,/);
  assert.match(css, /\.zone:focus-within \.zone-color-edit\s*{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;[^}]*transform:\s*translateY\(0\) scale\(1\);/s);
});
