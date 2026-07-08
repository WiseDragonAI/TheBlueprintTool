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

test('ctrl and middle-button drag always derive pan intent without selection side effects', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.activeTool = 'select';
  state.selection = { cardIds: ['card-a'], zoneIds: ['zone-a'], groupIds: ['group-a'] };

  try {
    const event = { shiftKey: false, ctrlKey: true, button: 0, buttons: 1, target: { closest: () => null } } as unknown as PointerEvent;
    const middleEvent = { shiftKey: false, ctrlKey: false, button: 1, buttons: 4, target: { closest: () => null } } as unknown as PointerEvent;
    const shiftEvent = { shiftKey: true, ctrlKey: false, target: { closest: () => null } } as unknown as PointerEvent;
    const resizeHandle = { className: 'resize-handle se' } as HTMLElement;
    assert.equal(ctrlPanOnlySpec, '9f04b1c2');
    assert.equal(derivePointerIntent(event, 'card', null), 'pan');
    assert.equal(derivePointerIntent(event, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(event, 'group', null), 'pan');
    assert.equal(derivePointerIntent(event, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(event, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'card', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'zone', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'group', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'canvas', null), 'pan');
    assert.equal(derivePointerIntent(middleEvent, 'card', resizeHandle), 'pan');
    assert.equal(derivePointerIntent(shiftEvent, 'canvas', null), 'marquee');

    const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
    const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
    assert.match(pointerDown, /const forcedPan = isForcedPanPointer\(event\)/);
    assert.match(pointerDown, /ctrlPan:\s*event\.ctrlKey,\s*forcedPan/);
    assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
    assert.match(pointerUp, /const pointerSession = state\.pointer/);
    assert.match(pointerUp, /const isForcedPan = Boolean\(pointerSession\.forcedPan \|\| pointerSession\.ctrlPan\)/);
    assert.match(pointerUp, /!isForcedPan && pointerIntent === 'pan'/);
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card tool draws over zone and group backgrounds while select mode keeps zone pan precedence', () => {
  const previousTool = state.activeTool;
  const previousSelection = state.selection;
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };

  try {
    const zoneEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-zone-id]' ? { dataset: { zoneId: 'zone-a' } } : null } } as unknown as PointerEvent;
    const groupEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-group-id]' ? { dataset: { groupId: 'group-a' } } : null } } as unknown as PointerEvent;
    const ctrlZoneEvent = { shiftKey: false, ctrlKey: true, target: zoneEvent.target } as unknown as PointerEvent;

    state.activeTool = 'card';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'draw-card');
    assert.equal(derivePointerIntent(groupEvent, 'group', null), 'draw-card');
    assert.equal(derivePointerIntent(ctrlZoneEvent, 'zone', null), 'pan');

    state.activeTool = 'select';
    assert.equal(derivePointerIntent(zoneEvent, 'zone', null), 'pan');
  } finally {
    state.activeTool = previousTool;
    state.selection = previousSelection;
  }
});

test('card creation preserves canvas x and y instead of clamping to positive space', () => {
  const createCard = source('frontend/src/runtime/card/effect/create-card-from-rect.ts');
  assert.match(createCard, /x:\s*rect\.x/);
  assert.match(createCard, /y:\s*rect\.y/);
  assert.doesNotMatch(createCard, /x:\s*Math\.max\(0,\s*rect\.x\)/);
  assert.doesNotMatch(createCard, /y:\s*Math\.max\(0,\s*rect\.y\)/);
});

test('direct canvas pointer down clears selection before pointer up', () => {
  const pointerDown = source('frontend/src/runtime/gesture/controller/handle-pointer-down.ts');
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  const specs = source('documentation/specs.json');

  assert.match(specs, /7d2c8b91/);
  assert.match(pointerDown, /intent === 'pan' && targetKind === 'canvas' && !forcedPan/);
  assert.match(pointerDown, /canvas-background-pointer-down/);
  assert.match(pointerDown, /renderSelectionState\(\)/);
  assert.doesNotMatch(pointerUp, /canvas-background-click/);
  assert.doesNotMatch(pointerUp, /targetKind === 'canvas' && moved < 4[\s\S]*clear-transient-selection/);
});

test('plain pan pointer up does not force a full canvas rerender', () => {
  const pointerUp = source('frontend/src/runtime/gesture/controller/handle-pointer-up.ts');
  assert.match(pointerUp, /const pointerIntent = pointerSession\.intent/);
  assert.match(pointerUp, /let releaseRendered = false/);
  assert.match(pointerUp, /releaseRendered = await commitSelectedLedgerGeometry\(\)/);
  assert.match(pointerUp, /if \(pointerIntent !== 'pan' && !releaseRendered\) renderCanvasSurface\(\)/);
  assert.match(pointerUp, /isClickMovement\(moved\)/);
});

test('wheel zoom stays transform-only and does not reroute relationships', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const scheduler = source('frontend/src/runtime/canvas/effect/schedule-viewport-transform.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const density = source('frontend/src/runtime/canvas/helper/render-density.ts');
  const ledgerRenderer = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const canvasPoint = source('frontend/src/runtime/canvas/helper/canvas-point.ts');
  const visibleCards = source('frontend/src/runtime/card/helper/visible-ledger-cards.ts');
  assert.match(wheel, /scheduleViewportTransform\(!event\.ctrlKey\)/);
  assert.match(density, /lowZoomRenderDensityThreshold = 0\.2/);
  assert.match(density, /lowZoomRenderDensity = 4/);
  assert.match(density, /state\.activeLedger && scale < lowZoomRenderDensityThreshold/);
  assert.match(density, /currentRenderDensity\(\): number \{[\s\S]*state\.activeLedger \? activeRenderDensity : 1/);
  assert.match(density, /effectiveViewportScale\(scale = Number\(state\.viewport\.scale\)\): number \{[\s\S]*scale \* currentRenderDensity\(\)/);
  assert.match(scheduler, /const animated = frameAnimated/);
  assert.match(scheduler, /const densityChanged = syncRenderDensity\(\)/);
  assert.match(scheduler, /if \(densityChanged\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*renderLedgerSurface\(\);[\s\S]*renderSelectionState\(\);[\s\S]*renderZoneLabelOverlay\(\);[\s\S]*renderRelationshipOverlay\(\);[\s\S]*\}/);
  assert.match(scheduler, /const detailModeChanged = updateDetailMode\(\)/);
  assert.match(scheduler, /if \(densityChanged \|\| detailModeChanged\) syncViewportCardDetails\(\)/);
  assert.match(scheduler, /const animated = frameAnimated && !densityChanged/);
  assert.match(scheduler, /applyViewportTransform\(settled, animated\)/);
  assert.match(scheduler, /import \{ hideCanvasControlOverlay \} from '\.\/render-canvas-control-overlay\.js'/);
  assert.match(scheduler, /import \{ resumeCanvasMediaOverlay, suspendCanvasMediaOverlay \} from '\.\/render-canvas-media-overlay\.js'/);
  assert.match(scheduler, /if \(zooming\) \{\s*suspendCanvasMediaOverlay\(\);[\s\S]*hideCanvasControlOverlay\(\);[\s\S]*settleTimer = setTimeout\(finishZoomSettle, 120\)/);
  assert.match(scheduler, /settleTimer = setTimeout\(finishZoomSettle, 120\)/);
  assert.match(scheduler, /applyViewportSettledEffects\(\);[\s\S]*resumeCanvasMediaOverlay\(\)/);
  assert.doesNotMatch(scheduler, /syncScaleCssVars|applyViewportScaleCssVars/);
  assert.doesNotMatch(scheduler, /is-zooming|state\.viewport\.scale < 0\.35|classList\.add|classList\.remove/);
  assert.match(viewport, /export function applyViewportSettledEffects\(\)/);
  assert.match(viewport, /viewportTransformTransition = 'transform 90ms cubic-bezier/);
  assert.match(viewport, /export function applyViewportTransform\(settled = true, animated = false\)/);
  assert.match(viewport, /applyViewportTransformTransition\(animated\)/);
  assert.match(viewport, /content\.style\.transform = `translate\(\$\{x\}px, \$\{y\}px\) scale\(\$\{effectiveViewportScale\(\)\}\)`/);
  assert.match(ledgerRenderer, /syncRenderDensity\(\)/);
  assert.match(canvasPoint, /state\.viewport\.scale/);
  assert.doesNotMatch(canvasPoint, /effectiveViewportScale|currentRenderDensity|renderDensity/);
  assert.match(visibleCards, /const scale = Math\.max\(0\.0001, finiteNumber\(viewport\.scale, 1\)\)/);
  assert.doesNotMatch(visibleCards, /effectiveViewportScale|currentRenderDensity|renderDensity/);
  assert.doesNotMatch(wheel, /renderRelationshipOverlay/);
});

test('canvas debug overlay is URL-param gated and reports zoom density state', () => {
  const debugRuntime = source('frontend/src/runtime/debug/effect/render-canvas-debug-overlay.ts');
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const pan = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const surface = source('frontend/src/runtime/canvas/effect/render-canvas-surface.ts');
  const canvasCss = source('frontend/assets/canvas.css');
  const debugCss = source('frontend/assets/canvas/debug.css');

  assert.match(canvasCss, /@import url\('\.\/canvas\/debug\.css'\)/);
  assert.match(debugRuntime, /params\.has\('canvasDebug'\)/);
  assert.match(debugRuntime, /params\.get\('debug'\) === 'canvas'/);
  assert.match(debugRuntime, /params\.get\('debugCanvas'\) === '1'/);
  assert.match(debugRuntime, /if \(!canvasDebugEnabled\(\)\) return/);
  assert.match(debugRuntime, /className = 'canvas-debug-overlay'/);
  assert.match(debugRuntime, /row\('raw zoom', formatNumber\(state\.viewport\.scale, 4\)\)/);
  assert.match(debugRuntime, /row\('effective zoom', formatNumber\(effectiveViewportScale\(\), 4\)\)/);
  assert.match(debugRuntime, /row\('render density', String\(currentRenderDensity\(\)\)\)/);
  assert.match(debugRuntime, /row\('detail mode', detailMode\(\)\)/);
  assert.match(debugRuntime, /row\('detail DOM', String\(count\(':scope > \.card \.ledger-card-detail-layer'\)\)\)/);
  assert.match(debugRuntime, /row\('transform', content\?\.style\.transform \|\| 'none'\)/);
  assert.doesNotMatch(debugRuntime, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(viewport, /renderCanvasDebugOverlay\(settled \? 'viewport-settled' : 'viewport-frame'\)/);
  assert.match(pan, /renderCanvasDebugOverlay\('pan'\)/);
  assert.match(surface, /renderCanvasDebugOverlay\('surface'\)/);
  assert.match(surface, /options: \{ renderThreadPanel\?: boolean \} = \{\}/);
  assert.match(surface, /if \(options\.renderThreadPanel !== false\) renderThreadPanel\(\)/);
  assert.match(debugCss, /\.canvas-debug-overlay\s*{[^}]*position:\s*fixed;[^}]*z-index:\s*10000;/s);
  assert.match(debugCss, /\.canvas-debug-overlay table\s*{[^}]*border-collapse:\s*collapse;/s);
});

test('normal detail reveal is viewport-local and layout-free', () => {
  const viewport = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const pan = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const sync = source('frontend/src/runtime/canvas/effect/sync-viewport-card-details.ts');
  const cardRenderer = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const detailRenderer = source('frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts');
  const detailMode = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  const cardPatch = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const zonePatch = source('frontend/src/runtime/ledger/component/patch-ledger-zone.ts');
  const relationships = source('frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts');
  const css = source('frontend/assets/canvas/canvas-layer.css');
  const objects = source('frontend/assets/canvas/objects.css');

  assert.match(viewport, /syncViewportCardDetails\(\)/);
  assert.match(pan, /syncViewportCardDetails\(\)/);
  assert.match(pan, /content\.style\.transition !== 'none'/);
  assert.match(pan, /scale\(\$\{effectiveViewportScale\(\)\}\)/);
  assert.match(cardPatch, /const renderedGeometry = renderGeometry\(geometry\)/);
  assert.match(cardPatch, /element\.style\.left = `\$\{renderedGeometry\.x\}px`/);
  assert.match(cardPatch, /element\.style\.minHeight = `\$\{renderedGeometry\.height\}px`/);
  assert.match(zonePatch, /const renderedGeometry = renderGeometry\(geometry\)/);
  assert.match(zonePatch, /element\.style\.minHeight = `\$\{renderedGeometry\.height\}px`/);
  assert.match(relationships, /overlay\.setAttribute\('viewBox', `0 0 \$\{bounds\.width\} \$\{bounds\.height\}`\)/);
  assert.match(relationships, /overlay\.style\.width = `\$\{renderLength\(bounds\.width\)\}px`/);
  assert.match(sync, /const detailedCardIds = new Set<string>\(\)/);
  assert.match(sync, /activeLedgerCardMap\(\)/);
  assert.match(sync, /viewportWorldBounds\(state\.viewport, viewportCanvasSize\(\)\)/);
  assert.match(sync, /canvasBoundsIntersect\(ledgerCardBounds\(ledgerCard\), bounds\)/);
  assert.match(sync, /renderLedgerCardDetailLayer\(ledgerCard\)/);
  assert.match(sync, /directChildByClass\(card, 'ledger-card-detail-layer'\)/);
  assert.match(sync, /directChildByClass\(card, 'ledger-card-detail-layer'\)\?\.remove\(\)/);
  assert.match(sync, /export function clearViewportCardDetails\(\)/);
  assert.match(sync, /content\.querySelectorAll\(':scope > \.card\.detail-visible, :scope > \.card > \.ledger-card-detail-layer'\)/);
  assert.match(sync, /detailedCardIds\.clear\(\)/);
  assert.match(sync, /if \(canvas\.classList\.contains\('low-detail'\)\) \{[\s\S]*clearViewportCardDetails\(\);[\s\S]*return;/);
  assert.match(detailMode, /export function updateDetailMode\(\): boolean/);
  assert.match(detailMode, /return hasLowDetail !== shouldUseLowDetail \|\| hasOverviewDetail !== shouldUseOverviewDetail/);
  assert.doesNotMatch(detailMode, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(sync, /classList\.add\('detail-visible'\)/);
  assert.match(sync, /classList\.remove\('detail-visible'\)/);
  assert.doesNotMatch(sync, /querySelectorAll<HTMLElement>\(':scope > \.card\[data-card-id\]'\)/);
  assert.doesNotMatch(sync, /classList\.toggle\('detail-visible'/);
  assert.match(cardRenderer, /const detailVisible = element\.className\.split\(\/\\s\+\/\)\.includes\('detail-visible'\)/);
  assert.match(cardRenderer, /card ledger-node\$\{detailVisible \? ' detail-visible' : ''\}/);
  assert.match(cardRenderer, /mountedDetail \? renderLedgerCardDetailLayer\(card, mountedDetail\) : null/);
  assert.doesNotMatch(cardRenderer, /renderLedgerCardMarkdown\(ledgerCardBody\(card\)/);
  assert.match(detailRenderer, /renderLedgerCardMarkdown\(ledgerCardBody\(card\)/);
  assert.match(detailRenderer, /renderLedgerCardTabFrame\(card, fields, activeTab\)/);
  assert.doesNotMatch(sync, /getBoundingClientRect|offsetWidth|offsetHeight|scrollWidth|scrollHeight/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-detail-layer/);
  assert.match(css, /\.canvas \.card:not\(\.detail-visible\) \.ledger-card-overview-layer/);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-detail-layer/);
  assert.match(objects, /\.ledger-card-detail-layer\s*{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s);
  assert.match(objects, /\.card\.detail-visible \.ledger-card-detail-layer\s*{[^}]*opacity:\s*1;[^}]*transition:\s*opacity 160ms ease-out;/s);
  assert.match(objects, /\.card:not\(\.detail-visible\),\s*\.card\.connected:not\(\.detail-visible\)\s*{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(cardRenderer, /const body = hasFieldTabs/);
});
