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
  assert.match(css, /\.canvas\.low-detail \.ledger-card-detail-layer,/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.card strong,\s*\n/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-overview-title/);
  assert.match(objectsCss, /\.ledger-card-overview-title\s*{[^}]*transform:\s*scale\(var\(--inverse-viewport-scale, 1\)\);/s);
  assert.match(specs, /9d5e0b7a/);
  assert.match(objectsCss, /\.ledger-card-overview-title\s*{[^}]*white-space:\s*normal;/s);
  assert.match(objectsCss, /\.ledger-card-overview-title\s*{[^}]*max-width:\s*calc\(100% \* var\(--viewport-scale, 1\)\);/s);
  assert.doesNotMatch(objectsCss, /\.ledger-card-overview-title\s*{[^}]*(?<!-)width:\s*calc\(100% \* var\(--viewport-scale, 1\)\);/s);

  const viewportRuntime = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const viewportCssScaleRuntime = source('frontend/src/runtime/canvas/helper/resolve-detail-mode-css-scale.ts');
  const detailRuntime = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  const panRuntime = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const invalidationRuntime = source('frontend/src/runtime/canvas/effect/invalidate-detail-mode-card-size-cache.ts');
  const detailMountConstants = source('frontend/src/runtime/card/detail-mount/constants.ts');
  const zoomDebugQuery = source('frontend/src/runtime/debug/zoom-debug/helper/query-enables-zoom-debug.ts');
  const worldResetDebugQuery = source('frontend/src/runtime/debug/zoom-debug/helper/query-enables-world-reset-debug.ts');
  const zoomDebugRuntime = source('frontend/src/runtime/debug/zoom-debug/effect/render-zoom-debug-overlay.ts');
  const zoomDebugCounts = source('frontend/src/runtime/debug/zoom-debug/helper/count-ledger-card-detail-states.ts');
  const zoomDebugSurvivors = source('frontend/src/runtime/debug/zoom-debug/helper/count-zoom-debug-survivor-states.ts');
  const zoomDebugMarkDetail = source('frontend/src/runtime/debug/zoom-debug/helper/mark-zoom-debug-detail-exposure.ts');
  const detailMountFiles = [
    'frontend/src/runtime/card/detail-mount/collect-detail-mounted-card-ids.ts',
    'frontend/src/runtime/card/detail-mount/mount-ledger-card-detail.ts',
    'frontend/src/runtime/card/detail-mount/begin-unmount-ledger-card-detail.ts',
    'frontend/src/runtime/card/detail-mount/clear-mounted-ledger-card-details.ts',
    'frontend/src/runtime/card/detail-mount/constants.ts',
    'frontend/src/runtime/card/detail-mount/resolve-detail-mount-bounds.ts',
    'frontend/src/runtime/card/detail-mount/resolve-detail-mount-canvas-size.ts',
    'frontend/src/runtime/card/detail-mount/schedule-mounted-ledger-card-details-sync.ts',
    'frontend/src/runtime/card/detail-mount/sync-mounted-ledger-card-details.ts',
    'frontend/src/runtime/card/detail-mount/mark-ledger-card-detail-mounted.ts',
    'frontend/src/runtime/card/detail-mount/state.ts'
  ];
  const detailMountRuntime = detailMountFiles.map((path) => source(path)).join('\n');
  const detailMountRuntimeWithoutComments = detailMountRuntime.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const touchedRuntimeFiles = [viewportRuntime, viewportCssScaleRuntime, detailRuntime, panRuntime, invalidationRuntime, ...detailMountFiles.map((path) => source(path))];
  assert.match(viewportRuntime, /--inverse-viewport-scale/);
  assert.match(viewportRuntime, /resolveDetailModeCssScale\(state\.viewport\.scale, state\.viewport\.scale < 0\.35\)/);
  assert.match(viewportRuntime, /getPropertyValue\('--viewport-scale'\) !== viewportScale/);
  assert.match(viewportCssScaleRuntime, /lowDetailMinimumScale = 0\.08/);
  assert.match(viewportCssScaleRuntime, /if \(!lowDetail\) \{/);
  assert.match(viewportCssScaleRuntime, /Math\.max\(lowDetailMinimumScale, safeScale\)/);
  assert.match(invalidationRuntime, /export function invalidateDetailModeCardSizeCache/);
  assert.doesNotMatch(detailRuntime, /offsetWidth|offsetHeight|getBoundingClientRect|scrollHeight/);
  assert.match(detailRuntime, /const shouldUseLowDetail = state\.viewport\.scale < 0\.35/);
  assert.doesNotMatch(detailRuntime, /0\.45|lowDetailThreshold|zoom-grid-suppressed/);
  assert.doesNotMatch(css, /zoom-grid-suppressed/);
  assert.doesNotMatch(detailMountRuntimeWithoutComments, /offsetWidth|offsetHeight|getBoundingClientRect|scrollHeight/);
  assert.match(detailRuntime, /clearMountedLedgerCardDetails\(\)/);
  assert.match(detailRuntime, /queryEnablesWorldResetDebug\(\)/);
  assert.match(detailRuntime, /scheduleMountedLedgerCardDetailsSync\(true\)/);
  assert.match(detailRuntime, /scheduleMountedLedgerCardDetailsSync\(\)/);
  assert.match(panRuntime, /scheduleMountedLedgerCardDetailsSync\(\)/);
  assert.match(detailMountConstants, /DETAIL_MOUNT_SETTLE_MS = 120/);
  assert.match(detailMountConstants, /DETAIL_MOUNT_OPACITY_MS = 160/);
  assert.match(detailMountRuntime, /viewportWorldBounds/);
  assert.match(detailMountRuntime, /activeLedgerCardMap/);
  assert.match(detailMountRuntime, /requestAnimationFrame/);
  assert.match(detailMountRuntime, /window\.setTimeout/);
  assert.match(zoomDebugQuery, /params\.has\('detailMountDebug'\)/);
  assert.match(zoomDebugQuery, /params\.get\('debug'\) === 'detail-mount'/);
  assert.match(worldResetDebugQuery, /params\.has\('worldResetDebug'\)/);
  assert.match(worldResetDebugQuery, /params\.get\('debug'\) === 'world-reset'/);
  assert.match(zoomDebugRuntime, /countLedgerCardDetailStates\(\)/);
  assert.match(zoomDebugRuntime, /countZoomDebugSurvivorStates\(\)/);
  assert.match(zoomDebugRuntime, /markZoomDebugDetailExposure\(\)/);
  assert.match(zoomDebugRuntime, /`detail-dom \$\{detailStates\.detailLayers\}`/);
  assert.match(zoomDebugRuntime, /`mounted \$\{detailStates\.mounted\}`/);
  assert.match(zoomDebugRuntime, /`mounting \$\{detailStates\.mounting\}`/);
  assert.match(zoomDebugRuntime, /`unmounting \$\{detailStates\.unmounting\}`/);
  assert.match(zoomDebugRuntime, /`overview \$\{survivorStates\.overviewLayers\}\/\$\{survivorStates\.overviewSawDetail\}`/);
  assert.match(zoomDebugRuntime, /`pan-text \$\{survivorStates\.textShadowTargets\}`/);
  assert.match(zoomDebugCounts, /\.ledger-card-detail-host > \.ledger-card-detail-layer/);
  assert.match(zoomDebugCounts, /detailMounted === 'mounted'/);
  assert.match(zoomDebugSurvivors, /\.ledger-card-overview-layer\[data-debug-saw-detail="1"\]/);
  assert.match(zoomDebugSurvivors, /\.relationships text/);
  assert.match(zoomDebugSurvivors, /detailRevealAttrs/);
  assert.match(zoomDebugMarkDetail, /dataset\.debugSawDetail = '1'/);
  for (const runtime of touchedRuntimeFiles) {
    assert.match(runtime, /^\/\*\*[\s\S]*WHAT:[\s\S]*WHY:[\s\S]*\*\//);
    assert.ok((runtime.match(/export function /g) ?? []).length <= 1);
    const branchCount = (runtime.match(/\/\/ Branch:/g) ?? []).length;
    const ifCount = (runtime.match(/\bif \(/g) ?? []).length;
    assert.ok(branchCount >= ifCount);
  }
  assert.match(objectsCss, /\.ledger-card-detail-layer\s*{[^}]*transition:\s*opacity 160ms ease-out;/s);
  assert.match(objectsCss, /\.ledger-card-overview-layer\s*{[^}]*transition:\s*opacity 160ms ease-out;/s);
  assert.match(objectsCss, /\.card\[data-detail-mounted="mounting"\] \.ledger-card-detail-layer,[\s\S]{0,120}\.card\[data-detail-mounted="unmounting"\] \.ledger-card-detail-layer\s*{[^}]*opacity:\s*0;/s);
  assert.doesNotMatch(css, /content-visibility:\s*hidden/);
  assert.match(detailRuntime, /if \(hasLowDetail !== shouldUseLowDetail\) \{/);
  assert.doesNotMatch(detailRuntime, /overview-detail/);
  assert.doesNotMatch(css, /\.canvas\.overview-detail/);
  assert.match(css, /\.canvas\.low-detail \.grid\s*{[^}]*display:\s*none;/s);
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
