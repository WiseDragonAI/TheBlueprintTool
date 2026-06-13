import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewportWorldBounds, visibleLedgerCards } from '../../src/runtime/card/helper/visible-ledger-cards.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('visible card quality refresh computes viewport card candidates from ledger geometry', () => {
  const bounds = viewportWorldBounds({ x: -200, y: -100, scale: 2 }, { width: 800, height: 600 });
  assert.deepEqual(bounds, { x: 100, y: 50, width: 400, height: 300 });
  const visible = visibleLedgerCards([
    { id: 'left', x: 0, y: 0, w: 80, h: 80 },
    { id: 'inside', x: 120, y: 80, w: 100, h: 100 },
    { id: 'edge', x: 490, y: 330, w: 40, h: 40 },
    { id: 'right', x: 540, y: 80, w: 100, h: 100 }
  ], bounds);
  assert.deepEqual(visible.map((card) => card.id), ['inside', 'edge']);
});

test('zoomed card media promotes the native carousel into an untransformed overlay', () => {
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const transform = source('frontend/src/runtime/canvas/effect/apply-viewport-transform.ts');
  const panTransform = source('frontend/src/runtime/canvas/effect/apply-pan-viewport-transform.ts');
  const renderLedgerSurface = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');
  const media = source('frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts');
  const mediaComponent = source('frontend/src/runtime/ledger/component/render-ledger-card-media.ts');
  const mediaLayout = source('frontend/src/runtime/ledger/helper/sync-ledger-card-media-layout.ts');
  const canvasCss = source('frontend/assets/canvas/canvas-layer.css');
  const objectCss = source('frontend/assets/canvas/objects.css');

  assert.match(transform, /scheduleCanvasMediaOverlayRender\(\)/);
  assert.match(transform, /clearCanvasMediaOverlay\(\)/);
  assert.match(transform, /!settled \|\| Number\(state\.viewport\.scale\) < canvasMediaOverlayScaleThreshold/);
  assert.match(panTransform, /applyCanvasMediaOverlayPanTransform\(\)/);
  assert.match(renderLedgerSurface, /scheduleCanvasMediaOverlayRender\(\)/);
  assert.match(wheel, /scheduleCanvasMediaOverlayRender\(\)/);
  assert.doesNotMatch(wheel, /noteZoomForVisibleCardQualityRefresh/);
  assert.match(mediaComponent, /track\.addEventListener\('scroll', \(\) => \{[\s\S]*scheduleCanvasMediaOverlayRender\(\);[\s\S]*\}/);
  assert.match(mediaComponent, /dataset\.mediaPromotionScale/);
  assert.match(mediaComponent, /element\.offsetWidth \/ dimensionScale/);
  assert.match(mediaLayout, /captureLedgerCardMediaHandoffState/);
  assert.match(mediaLayout, /restoreLedgerCardMediaHandoffState/);
  assert.match(media, /canvasMediaOverlayScaleThreshold = 1/);
  assert.match(media, /export function clearCanvasMediaOverlay\(options: MediaOverlayDemotionOptions = \{\}\)/);
  assert.match(media, /export function suspendCanvasMediaOverlay\(\)/);
  assert.match(media, /export function resumeCanvasMediaOverlay\(\)/);
  assert.match(media, /let mediaOverlaySuspended = false/);
  assert.match(media, /const mediaZoomSurrogates = new Map<string, MediaZoomSurrogate>\(\)/);
  assert.match(media, /const hiddenZoomMediaShells = new Map<HTMLElement, string>\(\)/);
  assert.match(media, /function captureMediaZoomSurrogates\(overlay: HTMLElement \| null\): void/);
  assert.match(media, /element\.className = 'canvas-media-zoom-surrogate'/);
  assert.match(media, /hideDemotedMedia\?: boolean/);
  assert.match(media, /if \(options\.hideDemotedMedia\) hideZoomMediaShell\(promotion\.shell\)/);
  assert.match(media, /if \(options\.preserveZoomSurrogates\) syncMediaZoomSurrogates\(\)/);
  assert.match(media, /clearMediaOverlay\(overlay, \{ reconcilePromotedGeometry: false, hideDemotedMedia: true, preserveZoomSurrogates: true \}\)/);
  assert.match(media, /if \(mediaOverlaySuspended\) \{[\s\S]*clearMediaOverlay\(overlay, \{ reconcilePromotedGeometry: false, preserveZoomSurrogates: true \}\);[\s\S]*return;/);
  assert.match(media, /if \(mediaOverlaySuspended\) return/);
  assert.match(media, /mediaOverlaySuspended[\s\S]*reconcilePromotedGeometry: false, preserveZoomSurrogates: true/);
  assert.match(media, /const promotedMediaShells = new Map<string, MediaPromotion>\(\)/);
  assert.match(media, /if \(Number\(state\.viewport\.scale\) < canvasMediaOverlayScaleThreshold\) \{[\s\S]*clearCanvasMediaOverlay\(\);[\s\S]*return;/);
  assert.match(media, /visibleLedgerCards\(cards, bounds\)\.slice\(0, maxCanvasMediaOverlayCards\)/);
  assert.match(media, /ledger-card-media-placeholder\[data-media-promotion-key\]/);
  assert.match(media, /pendingHandoffState\?: LedgerCardMediaHandoffState/);
  assert.match(media, /localMediaMaxWidth\(promotion\)/);
  assert.match(media, /promotion\.shell\.style\.maxWidth = `\$\{maxPromotedWidth\}px`/);
  assert.match(media, /if \(handoffState\) restoreLedgerCardMediaHandoffState\(promotion\.shell, handoffState\)/);
  assert.match(media, /getComputedStyle\(cardElement\)\.getPropertyValue\('--card-zone-color'\)/);
  assert.match(media, /overlay\.append\(shell\)/);
  assert.match(media, /placeholder\.replaceWith\(promotion\.shell\)/);
  assert.match(media, /getBoundingClientRect\(\)/);
  assert.match(media, /lastRenderedViewport/);
  assert.match(media, /shell\.style\.transform = transform/);
  assert.match(media, /setTimeout\(\(\) => \{[\s\S]*scheduleCanvasMediaOverlayRender\(\);[\s\S]*\}, 80\)/);
  assert.match(canvasCss, /\.canvas-media-overlay\s*{[^}]*position:\s*absolute;[^}]*z-index:\s*80;[^}]*pointer-events:\s*none;/s);
  assert.match(canvasCss, /\.canvas-media-zoom-surrogate\s*{[^}]*position:\s*absolute;[^}]*object-fit:\s*contain;/s);
  assert.doesNotMatch(canvasCss, /canvas-media-overlay-image/);
  assert.match(objectCss, /\.canvas-media-overlay \.ledger-card-media-shell\s*{[^}]*max-width:\s*none;[^}]*pointer-events:\s*auto;/s);
  assert.match(objectCss, /\.ledger-card-media-placeholder\s*{[^}]*aspect-ratio:\s*var\(--ledger-card-media-aspect-ratio, 4 \/ 3\);[^}]*visibility:\s*hidden;/s);
  assert.doesNotMatch(objectCss, /data-media-overlay-active/);
  assert.doesNotMatch(objectCss, /data-quality-promoted/);
  assert.doesNotMatch(objectCss, /--media-quality-scale/);
});
