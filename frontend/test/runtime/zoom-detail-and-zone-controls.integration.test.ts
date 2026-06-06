import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('low-detail zoom hides card detail while keeping counter-scaled card titles', () => {
  const css = source('frontend/assets/canvas/canvas-layer.css');
  const objectsCss = source('frontend/assets/canvas/objects.css');
  const specs = source('documentation/specs.json');

  assert.match(specs, /84cf2a6b/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-detail-layer/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-detail-layer/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.card strong,\s*\n/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-title\s*{[^}]*transform:\s*scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.match(specs, /9d5e0b7a/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-title\s*{[^}]*white-space:\s*normal;/s);
  assert.doesNotMatch(css, /\.ledger-card-overview-title\s*{[^}]*width:\s*calc\(100% \* var\(--viewport-scale, 1\)\);/s);

  const viewportRuntime = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const detailRuntime = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  assert.match(viewportRuntime, /--inverse-viewport-scale/);
  assert.match(detailRuntime, /invalidateDetailModeCardSizeCache/);
  assert.doesNotMatch(detailRuntime, /offsetWidth|offsetHeight|getBoundingClientRect|scrollHeight/);
  assert.match(detailRuntime, /if \(hasLowDetail !== shouldUseLowDetail\) canvas\.classList\.toggle/);
  assert.match(detailRuntime, /if \(hasOverviewDetail !== shouldUseOverviewDetail\) canvas\.classList\.toggle/);
  assert.match(objectsCss, /\.card:not\(\.detail-visible\),\s*\.card\.connected:not\(\.detail-visible\)\s*{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(css, /\.canvas\.overview-detail \.regular-zone/);
  assert.match(css, /\.canvas\.overview-detail \.grid\s*{[^}]*display:\s*none;/s);
  assert.match(objectsCss, /\.canvas\.low-detail \.card\.selected \.resize-handle\s*{[^}]*display:\s*none;/s);
  assert.match(objectsCss, /\.canvas\.low-detail \.zone\.selected \.resize-handle\s*{[^}]*display:\s*block;[^}]*width:\s*22px;[^}]*height:\s*22px;[^}]*transform:\s*scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.match(objectsCss, /\.canvas\.low-detail \.zone\.selected \.resize-handle\.nw\s*{[^}]*left:\s*-11px;[^}]*top:\s*-11px;/s);
});

test('zone edit and color controls render in the viewport overlay instead of zone DOM', () => {
  const css = source('frontend/assets/canvas/objects.css');
  const overlayCss = source('frontend/assets/canvas/canvas-layer.css');
  const overlayRuntime = source('frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /2aa4f070/);
  assert.match(specs, /5d8f2a1b/);
  assert.doesNotMatch(css, /\.zone:hover \.zone-actions/);
  assert.doesNotMatch(css, /\.zone \.zone-actions \.icon-button/);
  assert.match(overlayCss, /\.canvas-control-overlay\s*{[^}]*z-index:\s*120;/s);
  assert.match(overlayCss, /\.canvas-control\s*{[^}]*transition:\s*opacity 140ms ease;/s);
  assert.match(overlayCss, /\.canvas-control \.terminal-button,[\s\S]*transition:\s*none;/);
  assert.match(overlayRuntime, /className = `canvas-control canvas-control--\$\{kind\}`/);
  assert.match(overlayRuntime, /placeControlGroup\(group, zone, kind === 'group' \? 'right' : 'left', 32\)/);
  assert.match(overlayRuntime, /color\.dataset\.action = 'edit-zone-color'/);
  assert.match(overlayRuntime, /canvas\.addEventListener\('mouseover'/);
});
